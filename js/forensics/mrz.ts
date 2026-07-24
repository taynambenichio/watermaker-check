export type MrzDocumentType = 'TD1' | 'TD2' | 'TD3';

export interface MrzCheck {
    label: string;
    expected: string;
    actual: string;
    valid: boolean;
}

export interface MrzResult {
    valid: boolean;
    documentType: MrzDocumentType | null;
    errors: string[];
    checks: MrzCheck[];
    fields: {
        documentCode: string | null;
        issuingState: string | null;
        documentNumber: string | null;
        nationality: string | null;
        birthDate: string | null;
        sex: string | null;
        expiryDate: string | null;
        surname: string | null;
        givenNames: string[];
    };
    normalizedLines: string[];
}

const WEIGHTS = [7, 3, 1] as const;

function charValue(char: string): number {
    if (char === '<') return 0;
    const code = char.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48;
    if (code >= 65 && code <= 90) return code - 55;
    throw new Error(`Invalid MRZ character: ${char}`);
}

export function mrzCheckDigit(input: string): string {
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
        sum += charValue(input[i]) * WEIGHTS[i % WEIGHTS.length];
    }
    return String(sum % 10);
}

function cleanField(value: string): string {
    return value.replace(/</g, ' ').trim().replace(/\s+/g, ' ');
}

function cleanDocumentNumber(value: string): string {
    return value.replace(/<+$/g, '');
}

function parseNames(value: string): { surname: string | null; givenNames: string[] } {
    const [surname = '', given = ''] = value.split('<<');
    return {
        surname: cleanField(surname) || null,
        givenNames: given
            .split('<')
            .map((part) => part.trim())
            .filter(Boolean),
    };
}

function addCheck(checks: MrzCheck[], label: string, data: string, actual: string): void {
    const expected = mrzCheckDigit(data);
    checks.push({ label, expected, actual, valid: expected === actual });
}

function normalizeMrzText(text: string): string[] {
    const lines = text
        .toUpperCase()
        .replace(/[ \t]+/g, '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length === 1 && lines[0].length >= 88 && lines[0].length <= 90) {
        return [lines[0].slice(0, 30), lines[0].slice(30, 60), lines[0].slice(60).padEnd(30, '<')];
    }

    if (lines.length > 3) {
        const joined = lines.join('');
        if (joined.length >= 88 && joined.length <= 90) {
            return [joined.slice(0, 30), joined.slice(30, 60), joined.slice(60).padEnd(30, '<')];
        }
    }

    return lines;
}

function baseResult(lines: string[]): MrzResult {
    return {
        valid: false,
        documentType: null,
        errors: [],
        checks: [],
        fields: {
            documentCode: null,
            issuingState: null,
            documentNumber: null,
            nationality: null,
            birthDate: null,
            sex: null,
            expiryDate: null,
            surname: null,
            givenNames: [],
        },
        normalizedLines: lines,
    };
}

function parseTD3(lines: string[]): MrzResult {
    const result = baseResult(lines);
    result.documentType = 'TD3';
    const [line1, line2] = lines;

    const names = parseNames(line1.slice(5));
    result.fields = {
        documentCode: cleanField(line1.slice(0, 2)),
        issuingState: cleanField(line1.slice(2, 5)),
        documentNumber: cleanDocumentNumber(line2.slice(0, 9)),
        nationality: cleanField(line2.slice(10, 13)),
        birthDate: line2.slice(13, 19),
        sex: cleanField(line2.slice(20, 21)),
        expiryDate: line2.slice(21, 27),
        surname: names.surname,
        givenNames: names.givenNames,
    };

    addCheck(result.checks, 'Número do documento', line2.slice(0, 9), line2[9]);
    addCheck(result.checks, 'Data de nascimento', line2.slice(13, 19), line2[19]);
    addCheck(result.checks, 'Data de validade', line2.slice(21, 27), line2[27]);
    addCheck(result.checks, 'Campo opcional', line2.slice(28, 42), line2[42]);
    addCheck(
        result.checks,
        'Composto',
        line2.slice(0, 10) + line2.slice(13, 20) + line2.slice(21, 43),
        line2[43],
    );

    result.valid = result.checks.every((check) => check.valid);
    return result;
}

function parseTD2(lines: string[]): MrzResult {
    const result = baseResult(lines);
    result.documentType = 'TD2';
    const [line1, line2] = lines;

    const names = parseNames(line1.slice(5));
    result.fields = {
        documentCode: cleanField(line1.slice(0, 2)),
        issuingState: cleanField(line1.slice(2, 5)),
        documentNumber: cleanDocumentNumber(line2.slice(0, 9)),
        nationality: cleanField(line2.slice(10, 13)),
        birthDate: line2.slice(13, 19),
        sex: cleanField(line2.slice(20, 21)),
        expiryDate: line2.slice(21, 27),
        surname: names.surname,
        givenNames: names.givenNames,
    };

    addCheck(result.checks, 'Número do documento', line2.slice(0, 9), line2[9]);
    addCheck(result.checks, 'Data de nascimento', line2.slice(13, 19), line2[19]);
    addCheck(result.checks, 'Data de validade', line2.slice(21, 27), line2[27]);
    addCheck(
        result.checks,
        'Composto',
        line2.slice(0, 10) + line2.slice(13, 20) + line2.slice(21, 35),
        line2[35],
    );

    result.valid = result.checks.every((check) => check.valid);
    return result;
}

function parseTD1(lines: string[]): MrzResult {
    const result = baseResult(lines);
    result.documentType = 'TD1';
    const [line1, line2, line3] = lines;

    const names = parseNames(line3);
    result.fields = {
        documentCode: cleanField(line1.slice(0, 2)),
        issuingState: cleanField(line1.slice(2, 5)),
        documentNumber: cleanDocumentNumber(line1.slice(5, 14)),
        nationality: cleanField(line2.slice(15, 18)),
        birthDate: line2.slice(0, 6),
        sex: cleanField(line2.slice(7, 8)),
        expiryDate: line2.slice(8, 14),
        surname: names.surname,
        givenNames: names.givenNames,
    };

    addCheck(result.checks, 'Número do documento', line1.slice(5, 14), line1[14]);
    addCheck(result.checks, 'Data de nascimento', line2.slice(0, 6), line2[6]);
    addCheck(result.checks, 'Data de validade', line2.slice(8, 14), line2[14]);
    addCheck(
        result.checks,
        'Composto',
        line1.slice(5, 30) + line2.slice(0, 7) + line2.slice(8, 15) + line2.slice(18, 29),
        line2[29],
    );

    result.valid = result.checks.every((check) => check.valid);
    return result;
}

export function parseMrz(text: string): MrzResult {
    const lines = normalizeMrzText(text);
    const result = baseResult(lines);

    if (lines.length === 0) {
        result.errors.push('MRZ vazia');
        return result;
    }

    if (!lines.every((line) => /^[A-Z0-9<]+$/.test(line))) {
        result.errors.push('A MRZ contém caracteres inválidos');
        return result;
    }

    if (lines.length === 2 && lines.every((line) => line.length === 44)) {
        return parseTD3(lines);
    }

    if (lines.length === 2 && lines.every((line) => line.length === 36)) {
        return parseTD2(lines);
    }

    if (lines.length === 3 && lines.every((line) => line.length === 30)) {
        return parseTD1(lines);
    }

    result.errors.push('Formato MRZ não suportado ou comprimento inválido');
    return result;
}
