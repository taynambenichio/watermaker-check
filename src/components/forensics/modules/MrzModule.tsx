import { useMemo, useState } from 'react';
import { parseMrz } from '../../../../js/forensics/mrz.js';
import { recognizeMrzFromImage } from '../../../../js/forensics/mrz-ocr.js';
import { COLOR_BAD, COLOR_OK, COLOR_WARN } from '../scoreColor.ts';

const SAMPLE_MRZ = [
    'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
    'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

function Field({ label, value }: { label: string; value: string | string[] | null }) {
    const text = Array.isArray(value) ? value.join(' ') : value;
    return (
        <div className="flex items-center justify-between gap-2 border-b border-border-soft py-1">
            <span className="text-xs text-text-3">{label}</span>
            <span className="max-w-[190px] truncate font-mono text-xs text-text-2">
                {text || '—'}
            </span>
        </div>
    );
}

interface MrzModuleProps {
    imageElement: HTMLImageElement | null;
}

export function MrzModule({ imageElement }: MrzModuleProps) {
    const [text, setText] = useState('');
    const [isReading, setIsReading] = useState(false);
    const [ocrStatus, setOcrStatus] = useState<string | null>(null);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const result = useMemo(() => parseMrz(text), [text]);
    const hasInput = text.trim().length > 0;
    const statusColor = !hasInput ? COLOR_WARN : result.valid ? COLOR_OK : COLOR_BAD;
    const statusText = !hasInput
        ? 'A aguardar MRZ'
        : result.valid
          ? 'Checksums válidos'
          : 'MRZ inválida';

    return (
        <div className="flex flex-col gap-3">
            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                spellCheck={false}
                rows={3}
                placeholder="Cole aqui as linhas MRZ"
                className="min-h-20 w-full resize-y rounded-sm border border-border bg-bg px-2 py-2 font-mono text-xs text-text outline-none transition-colors placeholder:text-text-3 focus:border-amber"
            />

            <button
                type="button"
                disabled={!imageElement || isReading}
                onClick={() => {
                    if (!imageElement) return;
                    setIsReading(true);
                    setOcrError(null);
                    setOcrStatus('Preparando OCR');
                    void recognizeMrzFromImage(imageElement, ({ status, progress }) => {
                        setOcrStatus(`${status} ${Math.round(progress * 100)}%`);
                    })
                        .then(({ rawText }) => {
                            setText(rawText);
                            setOcrStatus(null);
                        })
                        .catch((error: unknown) => {
                            setOcrError(error instanceof Error ? error.message : String(error));
                            setOcrStatus(null);
                        })
                        .finally(() => setIsReading(false));
                }}
                className="h-8 rounded-sm border border-border text-xs font-syne font-bold text-text-2 transition-colors hover:border-amber hover:text-amber disabled:cursor-not-allowed disabled:opacity-40"
            >
                {isReading ? 'Lendo MRZ…' : 'Ler MRZ da imagem'}
            </button>

            {ocrStatus && <p className="font-mono text-xs text-amber">{ocrStatus}</p>}
            {ocrError && (
                <div className="rounded-sm border border-red/40 bg-red-dim px-2 py-1.5 text-xs text-red">
                    OCR falhou: {ocrError}
                </div>
            )}

            <div className="flex items-center justify-between gap-2">
                <span className="font-syne text-xs font-bold uppercase tracking-wide text-text-3">
                    Validação
                </span>
                <span className="font-mono text-xs font-bold" style={{ color: statusColor }}>
                    {statusText}
                </span>
            </div>

            {hasInput && (
                <>
                    {result.errors.length > 0 && (
                        <div className="rounded-sm border border-red/40 bg-red-dim px-2 py-1.5 text-xs text-red">
                            {result.errors.join(' · ')}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-3">
                        <Field label="Tipo" value={result.documentType} />
                        <Field label="Emissor" value={result.fields.issuingState} />
                        <Field label="Número" value={result.fields.documentNumber} />
                        <Field label="Nacionalidade" value={result.fields.nationality} />
                        <Field label="Nascimento" value={result.fields.birthDate} />
                        <Field label="Validade" value={result.fields.expiryDate} />
                        <Field label="Sexo" value={result.fields.sex} />
                        <Field label="Apelido" value={result.fields.surname} />
                    </div>
                    <Field label="Nomes" value={result.fields.givenNames} />

                    {result.checks.length > 0 && (
                        <div className="flex flex-col gap-1">
                            {result.checks.map((check) => (
                                <div
                                    key={check.label}
                                    className="flex items-center justify-between rounded-sm bg-bg px-2 py-1 text-xs"
                                >
                                    <span className="text-text-3">{check.label}</span>
                                    <span
                                        className="font-mono font-bold"
                                        style={{ color: check.valid ? COLOR_OK : COLOR_BAD }}
                                    >
                                        {check.actual}/{check.expected}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {!hasInput && (
                <button
                    type="button"
                    onClick={() => setText(SAMPLE_MRZ)}
                    className="h-8 rounded-sm border border-border text-xs font-syne font-bold text-text-2 transition-colors hover:border-amber hover:text-amber"
                >
                    Carregar exemplo TD3
                </button>
            )}
        </div>
    );
}
