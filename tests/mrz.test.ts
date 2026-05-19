import { describe, expect, it } from 'vitest';
import { mrzCheckDigit, parseMrz } from '../js/forensics/mrz.js';

describe('mrzCheckDigit', () => {
    it('computes ICAO 9303 check digits', () => {
        expect(mrzCheckDigit('L898902C3')).toBe('6');
        expect(mrzCheckDigit('740812')).toBe('2');
        expect(mrzCheckDigit('120415')).toBe('9');
    });
});

describe('parseMrz', () => {
    const td3 = [
        'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
        'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
    ].join('\n');

    it('parses and validates a TD3 passport MRZ', () => {
        const result = parseMrz(td3);

        expect(result.valid).toBe(true);
        expect(result.documentType).toBe('TD3');
        expect(result.fields.documentNumber).toBe('L898902C3');
        expect(result.fields.issuingState).toBe('UTO');
        expect(result.fields.nationality).toBe('UTO');
        expect(result.fields.birthDate).toBe('740812');
        expect(result.fields.expiryDate).toBe('120415');
        expect(result.fields.surname).toBe('ERIKSSON');
        expect(result.fields.givenNames).toEqual(['ANNA', 'MARIA']);
        expect(result.checks.every((check) => check.valid)).toBe(true);
    });

    it('detects invalid check digits', () => {
        const result = parseMrz(td3.replace('L898902C36', 'L898902C30'));

        expect(result.valid).toBe(false);
        expect(result.checks.find((check) => check.label === 'Número do documento')?.valid).toBe(
            false,
        );
    });

    it('parses and validates a TD1 identity-card MRZ', () => {
        const result = parseMrz(
            [
                'I<UTOD231458907<<<<<<<<<<<<<<<',
                '7408122F1204159UTO<<<<<<<<<<<6',
                'ERIKSSON<<ANNA<MARIA<<<<<<<<<<',
            ].join('\n'),
        );

        expect(result.valid).toBe(true);
        expect(result.documentType).toBe('TD1');
        expect(result.fields.documentNumber).toBe('D23145890');
        expect(result.fields.surname).toBe('ERIKSSON');
        expect(result.fields.givenNames).toEqual(['ANNA', 'MARIA']);
    });

    it('rebuilds TD1 MRZ from OCR text split into extra fragments', () => {
        const result = parseMrz(
            [
                'IDSWEXA410316229401122984',
                '<<<<<',
                '9401127M2908018SWE',
                '<<<<<<<<<<',
                '02',
                'STROOBANTS',
                '<<BRUNO',
                '<<<<<<<<<<<<<',
            ].join('\n'),
        );

        expect(result.valid).toBe(true);
        expect(result.documentType).toBe('TD1');
        expect(result.fields.documentNumber).toBe('XA4103162');
        expect(result.fields.surname).toBe('STROOBANTS');
        expect(result.fields.givenNames).toEqual(['BRUNO']);
    });

    it('rebuilds TD1 MRZ from continuous OCR text with a missing trailing filler', () => {
        const result = parseMrz(
            'I<LVAST94239024948510<<<<<<<<<9401220M2906243LVA10125<<<<<<2RAMON<<STALMANS<<<<<<<<<<<<<<',
        );

        expect(result.valid).toBe(true);
        expect(result.documentType).toBe('TD1');
        expect(result.normalizedLines).toEqual([
            'I<LVAST94239024948510<<<<<<<<<',
            '9401220M2906243LVA10125<<<<<<2',
            'RAMON<<STALMANS<<<<<<<<<<<<<<<',
        ]);
        expect(result.fields.documentNumber).toBe('ST9423902');
    });

    it('rejects unsupported MRZ shapes', () => {
        const result = parseMrz('ABC');

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Formato MRZ não suportado ou comprimento inválido');
    });
});
