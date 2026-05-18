import exifr from 'exifr';
import type { ExifFlag, ExifResult } from '../types.js';

const SCORE_MAP: Record<ExifFlag['code'], number> = {
    NO_EXIF: 60,
    EDITING_SOFTWARE: 50,
    DATE_ANOMALY: 20,
    NO_CAMERA_INFO: 15,
};

const EDITING_SOFTWARE_PATTERNS = [
    'photoshop',
    'gimp',
    'lightroom',
    'affinity',
    'snapseed',
    'pixelmator',
    'acorn',
    'preview',
    'paint.net',
    'capture one',
];

export function computeExifScore(flags: ExifFlag[]): number {
    const total = flags.reduce((acc, f) => acc + (SCORE_MAP[f.code] ?? 0), 0);
    return Math.min(100, total);
}

export async function analyzeExif(img: HTMLImageElement): Promise<ExifResult> {
    let raw: Record<string, unknown> | null = null;

    try {
        raw = (await exifr.parse(img.src, {
            pick: ['Make', 'Model', 'Software', 'DateTime', 'DateTimeOriginal', 'GPSLatitude'],
        })) as Record<string, unknown> | null;
    } catch {
        raw = null;
    }

    const flags: ExifFlag[] = [];

    if (!raw) {
        flags.push({
            code: 'NO_EXIF',
            message: 'Sem metadados EXIF — possível screenshot ou imagem editada',
        });
        return {
            hasExif: false,
            software: null,
            camera: null,
            dateTime: null,
            gpsPresent: false,
            flags,
            score: computeExifScore(flags),
        };
    }

    const software = typeof raw.Software === 'string' ? raw.Software : null;
    const make = typeof raw.Make === 'string' ? raw.Make : null;
    const model = typeof raw.Model === 'string' ? raw.Model : null;
    const dateStr = raw.DateTimeOriginal ?? raw.DateTime;
    const dateTime = dateStr ? String(dateStr) : null;
    const gpsPresent = raw.GPSLatitude !== undefined && raw.GPSLatitude !== null;
    const camera = make && model ? `${make} ${model}` : (make ?? model ?? null);

    if (software) {
        const sl = software.toLowerCase();
        if (EDITING_SOFTWARE_PATTERNS.some((p) => sl.includes(p))) {
            flags.push({
                code: 'EDITING_SOFTWARE',
                message: `Software de edição detectado: ${software}`,
            });
        }
    }

    if (!make && !model) {
        flags.push({ code: 'NO_CAMERA_INFO', message: 'Sem informação de câmara (Make/Model)' });
    }

    if (dateTime) {
        // EXIF dates use "YYYY:MM:DD HH:MM:SS" format
        const isoDate = dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        const ts = new Date(isoDate).getTime();
        const now = Date.now();
        const tenYearsAgo = now - 10 * 365.25 * 24 * 3600 * 1000;
        if (!Number.isNaN(ts) && (ts > now || ts < tenYearsAgo)) {
            flags.push({ code: 'DATE_ANOMALY', message: `Data suspeita: ${dateTime}` });
        }
    }

    return {
        hasExif: true,
        software,
        camera,
        dateTime,
        gpsPresent,
        flags,
        score: computeExifScore(flags),
    };
}
