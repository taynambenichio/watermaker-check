import type { MrzResult } from './mrz.js';

export interface MrzAuthenticityCheck {
    name: string;
    description: string;
    passed: boolean;
    severity: 'error' | 'warning' | 'info';
}

export interface MrzAuthenticityResult {
    authentic: boolean;
    /** True when OCR ran but no valid MRZ structure was found */
    notFound: boolean;
    suspicionScore: number; // 0–100, 100 = highly suspicious
    checks: MrzAuthenticityCheck[];
    recommendation: string;
}

// ISO 3166-1 alpha-3 country codes (subset of common document issuers)
const VALID_ISSUING_STATES = new Set([
    'ABW',
    'AFG',
    'AGO',
    'AIA',
    'ALA',
    'ALB',
    'AND',
    'ARE',
    'ARG',
    'ARM',
    'ASM',
    'ATA',
    'ATF',
    'ATG',
    'AUS',
    'AUT',
    'AZE',
    'BDI',
    'BEL',
    'BEN',
    'BES',
    'BFA',
    'BGD',
    'BGR',
    'BHR',
    'BHS',
    'BIH',
    'BLM',
    'BLR',
    'BLZ',
    'BMU',
    'BOL',
    'BRA',
    'BRB',
    'BRN',
    'BTN',
    'BVT',
    'BWA',
    'CAF',
    'CAN',
    'CCK',
    'CHE',
    'CHL',
    'CHN',
    'CIV',
    'CMR',
    'COD',
    'COG',
    'COK',
    'COL',
    'COM',
    'CPV',
    'CRI',
    'CUB',
    'CUW',
    'CXR',
    'CYM',
    'CYP',
    'CZE',
    'DEU',
    'DJI',
    'DMA',
    'DNK',
    'DOM',
    'DZA',
    'ECU',
    'EGY',
    'ERI',
    'ESH',
    'ESP',
    'EST',
    'ETH',
    'FIN',
    'FJI',
    'FLK',
    'FRA',
    'FRO',
    'FSM',
    'GAB',
    'GBR',
    'GEO',
    'GGY',
    'GHA',
    'GIB',
    'GIN',
    'GLP',
    'GMB',
    'GNB',
    'GNQ',
    'GRC',
    'GRD',
    'GRL',
    'GTM',
    'GUF',
    'GUM',
    'GUY',
    'HKG',
    'HMD',
    'HND',
    'HRV',
    'HTI',
    'HUN',
    'IDN',
    'IMN',
    'IND',
    'IOT',
    'IRL',
    'IRN',
    'IRQ',
    'ISL',
    'ISR',
    'ITA',
    'JAM',
    'JEY',
    'JOR',
    'JPN',
    'KAZ',
    'KEN',
    'KGZ',
    'KHM',
    'KIR',
    'KNA',
    'KOR',
    'KWT',
    'LAO',
    'LBN',
    'LBR',
    'LBY',
    'LCA',
    'LIE',
    'LKA',
    'LSO',
    'LTU',
    'LUX',
    'LVA',
    'MAC',
    'MAF',
    'MAR',
    'MCO',
    'MDA',
    'MDG',
    'MDV',
    'MEX',
    'MHL',
    'MKD',
    'MLI',
    'MLT',
    'MMR',
    'MNE',
    'MNG',
    'MNP',
    'MOZ',
    'MRT',
    'MSR',
    'MTQ',
    'MUS',
    'MWI',
    'MYS',
    'MYT',
    'NAM',
    'NCL',
    'NER',
    'NFK',
    'NGA',
    'NIC',
    'NIU',
    'NLD',
    'NOR',
    'NPL',
    'NRU',
    'NZL',
    'OMN',
    'PAK',
    'PAN',
    'PCN',
    'PER',
    'PHL',
    'PLW',
    'PNG',
    'POL',
    'PRI',
    'PRK',
    'PRT',
    'PRY',
    'PSE',
    'PYF',
    'QAT',
    'REU',
    'ROU',
    'RUS',
    'RWA',
    'SAU',
    'SDN',
    'SEN',
    'SGP',
    'SGS',
    'SHN',
    'SJM',
    'SLB',
    'SLE',
    'SLV',
    'SMR',
    'SOM',
    'SPM',
    'SRB',
    'SSD',
    'STP',
    'SUR',
    'SVK',
    'SVN',
    'SWE',
    'SWZ',
    'SXM',
    'SYC',
    'SYR',
    'TCA',
    'TCD',
    'TGO',
    'THA',
    'TJK',
    'TKL',
    'TKM',
    'TLS',
    'TON',
    'TTO',
    'TUN',
    'TUR',
    'TUV',
    'TWN',
    'TZA',
    'UGA',
    'UKR',
    'UMI',
    'URY',
    'USA',
    'UZB',
    'VAT',
    'VCT',
    'VEN',
    'VGB',
    'VIR',
    'VNM',
    'VUT',
    'WLF',
    'WSM',
    'YEM',
    'ZAF',
    'ZMB',
    'ZWE',
]);

function isValidIsoDate(dateStr: string, isBirthDate: boolean = false): boolean {
    if (!/^\d{6}$/.test(dateStr)) return false;
    const yy = parseInt(dateStr.slice(0, 2), 10);
    const mm = parseInt(dateStr.slice(2, 4), 10);
    const dd = parseInt(dateStr.slice(4, 6), 10);

    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;

    const currentYear = new Date().getFullYear();
    const cutoff = currentYear - 100; // Documents typically within 100 years
    const year = yy <= 50 ? 2000 + yy : 1900 + yy;

    if (isBirthDate) {
        // Birth date: should be in past, typically within 120 years
        return year > cutoff && year <= currentYear;
    }
    // Expiry date: should be in future or recently passed
    return year >= currentYear - 5;
}

function isValidSex(sex: string | null): boolean {
    if (!sex) return true; // Optional field
    return ['M', 'F', 'X'].includes(sex.toUpperCase());
}

function hasConsistentFormat(mrz: MrzResult): MrzAuthenticityCheck {
    const docType = mrz.documentType;
    const lines = mrz.normalizedLines;
    const isValid = !!(docType && lines.length > 0);

    return {
        name: 'Formato consistente',
        description: 'MRZ segue formato TD1, TD2 ou TD3 padrão',
        passed: isValid,
        severity: isValid ? 'info' : 'error',
    };
}

function hasValidCheckdigits(mrz: MrzResult): MrzAuthenticityCheck {
    const allChecksValid = mrz.checks.every((check) => check.valid);

    return {
        name: 'Checksums válidos',
        description: 'Todos os dígitos de verificação coincidem',
        passed: allChecksValid,
        severity: allChecksValid ? 'info' : 'error',
    };
}

function hasValidIssuer(mrz: MrzResult): MrzAuthenticityCheck {
    const issuer = mrz.fields.issuingState;
    const isValid = !!(issuer && VALID_ISSUING_STATES.has(issuer));

    return {
        name: 'Emissor válido',
        description: `Código de país "${issuer}" é reconhecido`,
        passed: isValid,
        severity: isValid ? 'info' : 'warning',
    };
}

function hasValidDates(mrz: MrzResult): MrzAuthenticityCheck {
    const birthDate = mrz.fields.birthDate;
    const expiryDate = mrz.fields.expiryDate;

    const birthValid = !birthDate || isValidIsoDate(birthDate, true);
    const expiryValid = !expiryDate || isValidIsoDate(expiryDate, false);
    const isValid = birthValid && expiryValid;

    return {
        name: 'Datas válidas',
        description: 'Data de nascimento e validade são plausíveis',
        passed: isValid,
        severity: isValid ? 'info' : 'warning',
    };
}

function hasValidGender(mrz: MrzResult): MrzAuthenticityCheck {
    const sex = mrz.fields.sex;
    const isValid = isValidSex(sex);

    return {
        name: 'Sexo válido',
        description: 'Campo de sexo contém valor reconhecido (M/F/X)',
        passed: isValid,
        severity: isValid ? 'info' : 'warning',
    };
}

function hasConsistentNames(mrz: MrzResult): MrzAuthenticityCheck {
    const surname = mrz.fields.surname;
    const givenNames = mrz.fields.givenNames;

    // Names should exist and contain only letters + spaces (+ hyphens)
    const hasNames = surname || (givenNames && givenNames.length > 0);
    const isAlphabetic =
        (!surname || /^[A-Za-z\s-]+$/.test(surname)) &&
        (!givenNames || givenNames.every((name) => /^[A-Za-z\s-]+$/.test(name)));

    const isValid = !!(hasNames && isAlphabetic);

    return {
        name: 'Nomes consistentes',
        description: 'Nome contém apenas letras (sem números/símbolos)',
        passed: isValid,
        severity: isValid ? 'info' : 'warning',
    };
}

function detectEditionPatterns(mrz: MrzResult): MrzAuthenticityCheck {
    const lines = mrz.normalizedLines;
    if (lines.length === 0) {
        return {
            name: 'Padrões de edição',
            description: 'Nenhum padrão de manipulação detectado',
            passed: true,
            severity: 'info',
        };
    }

    // Flag suspicious patterns:
    // 1. Unusual abundance of '<' characters (padding anomalies)
    const paddingCount = lines.join('').split('<').length - 1;
    const totalChars = lines.join('').length;
    const paddingRatio = paddingCount / totalChars;

    const suspiciousPadding = paddingRatio > 0.4; // > 40% padding is suspicious

    // 2. Very short names (could indicate truncation or replacement)
    const surname = mrz.fields.surname;
    const givenNames = mrz.fields.givenNames?.join(' ');
    const combinedNames = `${surname || ''} ${givenNames || ''}`.trim();
    const tooShortName = combinedNames.length > 0 && combinedNames.length < 3;

    // 3. All same character name (clearly wrong)
    const uniformName =
        combinedNames.length > 0 && /^(.)\1+$/.test(combinedNames.replace(/\s+/g, ''));

    const passed = !suspiciousPadding && !tooShortName && !uniformName;

    return {
        name: 'Padrões de edição',
        description: 'Nenhum padrão de manipulação óbvia detectado',
        passed,
        severity: passed ? 'info' : 'error',
    };
}

function validateDocumentNumber(mrz: MrzResult): MrzAuthenticityCheck {
    const docNum = mrz.fields.documentNumber;
    const isValid = !!(docNum && /^[A-Z0-9]{1,20}$/.test(docNum));

    return {
        name: 'Número do documento',
        description: 'Número contém apenas letras e números',
        passed: isValid,
        severity: isValid ? 'info' : 'warning',
    };
}

export function validateMrzAuthenticity(mrz: MrzResult): MrzAuthenticityResult {
    // If MRZ could not be detected or parsed, return neutral result (score 50)
    if (mrz.documentType === null) {
        const notFound = mrz.errors.some(
            (e) => e.includes('vazia') || e.includes('inválidos') || e.includes('não suportado'),
        );
        return {
            authentic: false,
            notFound: true,
            suspicionScore: 50, // Neutral — absence of MRZ is not evidence of tampering
            checks: [],
            recommendation: notFound
                ? 'MRZ não detectada — leitura inconclusiva; isso não indica falsificação por si só.'
                : 'MRZ incompleta — formato não reconhecido.',
        };
    }

    const checks: MrzAuthenticityCheck[] = [
        hasConsistentFormat(mrz),
        hasValidCheckdigits(mrz),
        hasValidIssuer(mrz),
        hasValidDates(mrz),
        hasValidGender(mrz),
        hasConsistentNames(mrz),
        detectEditionPatterns(mrz),
        validateDocumentNumber(mrz),
    ];

    // Calculate suspicion score (0–100)
    const errorCount = checks.filter((c) => c.severity === 'error' && !c.passed).length;
    const warningCount = checks.filter((c) => c.severity === 'warning' && !c.passed).length;
    const suspicionScore = Math.min(100, errorCount * 25 + warningCount * 10);

    // Document is authentic if no errors and all checksums valid
    const authentic = errorCount === 0 && mrz.valid;

    // Generate recommendation
    let recommendation = 'MRZ válida — documento aparenta ser autêntico.';
    if (suspicionScore > 75) {
        recommendation = 'MRZ MUITO SUSPEITA — provável falsificação ou edição.';
    } else if (suspicionScore > 50) {
        recommendation = 'MRZ suspeita — múltiplas anomalias detectadas.';
    } else if (suspicionScore > 25) {
        recommendation = 'MRZ com possíveis inconsistências — requer verificação manual.';
    } else if (!mrz.valid) {
        recommendation = 'Checksums inválidos — documento rejeitado.';
    }

    return {
        authentic,
        notFound: false,
        suspicionScore,
        checks,
        recommendation,
    };
}
