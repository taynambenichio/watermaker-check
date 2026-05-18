import { scoreColor } from './scoreColor.ts';

interface ScoreRingProps {
    score: number;
    size?: number;
}

export function ScoreRing({ score, size = 100 }: ScoreRingProps) {
    const sw = 7;
    const r = (size - sw * 2) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - score / 100);
    const color = scoreColor(score);

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                style={{ transform: 'rotate(-90deg)' }}
                aria-hidden="true"
            >
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2a26" strokeWidth={sw} />
                <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={sw}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
            </svg>
            <div
                role="img"
                className="absolute inset-0 flex flex-col items-center justify-center"
                aria-label={`Score ${score} de 100`}
            >
                <span
                    aria-hidden="true"
                    className="font-mono font-bold leading-none"
                    style={{ fontSize: size * 0.26, color }}
                >
                    {score}
                </span>
                <span
                    aria-hidden="true"
                    className="font-mono text-text-3"
                    style={{ fontSize: size * 0.1 }}
                >
                    /100
                </span>
            </div>
        </div>
    );
}
