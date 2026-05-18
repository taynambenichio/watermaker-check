export const COLOR_OK = '#5cb87a';
export const COLOR_WARN = '#e8a800';
export const COLOR_BAD = '#d95f5f';

export function scoreColor(score: number): string {
    return score > 70 ? COLOR_OK : score >= 40 ? COLOR_WARN : COLOR_BAD;
}
