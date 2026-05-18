export const COLOR_OK = '#5cb87a';
export const COLOR_WARN = '#e8a800';
export const COLOR_BAD = '#d95f5f';

export function scoreColor(score: number): string {
    return score < 30 ? COLOR_OK : score <= 60 ? COLOR_WARN : COLOR_BAD;
}
