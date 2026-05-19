import { describe, expect, it } from 'vitest';
import { parseMrz } from '../js/forensics/mrz.js';
import { validateMrzAuthenticity } from '../js/forensics/mrz-authenticity.js';

describe('MRZ Authenticity Validation', () => {
    it('should mark authentic valid MRZ as authentic', () => {
        const mrz = [
            'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
            'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
        ].join('\n');
        const parsed = parseMrz(mrz);
        const auth = validateMrzAuthenticity(parsed);

        expect(auth.authentic).toBe(true);
        expect(auth.suspicionScore).toBeLessThan(25);
    });

    it('should detect invalid checksums as suspicious', () => {
        const mrz = [
            'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
            'L898902C36UTO7408122F1204159ZE184226B<<<<<11', // Wrong final checksum
        ].join('\n');
        const parsed = parseMrz(mrz);
        const auth = validateMrzAuthenticity(parsed);

        expect(auth.authentic).toBe(false);
        expect(auth.suspicionScore).toBeGreaterThan(25);
    });

    it('should detect invalid country code', () => {
        const mrz = [
            'P<XXXERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', // XXX is not a real country
            'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
        ].join('\n');
        const parsed = parseMrz(mrz);
        const auth = validateMrzAuthenticity(parsed);

        // Should have warning about invalid issuer
        const issuerCheck = auth.checks.find((c) => c.name === 'Emissor válido');
        expect(issuerCheck?.passed).toBe(false);
    });

    it('should detect invalid sex field', () => {
        const mrz = [
            'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
            'L898902C36UTO7408122Z1204159ZE184226B<<<<<10', // Z is invalid sex
        ].join('\n');
        const parsed = parseMrz(mrz);
        const auth = validateMrzAuthenticity(parsed);

        const sexCheck = auth.checks.find((c) => c.name === 'Sexo válido');
        expect(sexCheck?.passed).toBe(false);
    });

    it('should detect inconsistent names', () => {
        const mrz = [
            'P<UTO123456789<<1234567890<<<<<<<<<<<<<<<<<<',
            'L898902C36UTO7408122F1204159ZE184226B<<<<<10', // All numbers in name area
        ].join('\n');
        const parsed = parseMrz(mrz);
        const auth = validateMrzAuthenticity(parsed);

        const nameCheck = auth.checks.find((c) => c.name === 'Nomes consistentes');
        expect(nameCheck?.passed).toBe(false);
    });

    it('should detect suspicious padding patterns', () => {
        const mrz = [
            'P<UTO<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
            'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
        ].join('\n');
        const parsed = parseMrz(mrz);
        const auth = validateMrzAuthenticity(parsed);

        const editCheck = auth.checks.find((c) => c.name === 'Padrões de edição');
        // Should detect excessive padding as suspicious
        expect(editCheck?.passed).toBe(false);
    });

    it('should accept valid dates', () => {
        const currentYear = new Date().getFullYear();
        const yy = String(currentYear - 1950)
            .padStart(2, '0')
            .slice(-2);
        const mrz = [
            'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
            `L898902C36UTO${yy}08122F2404159ZE184226B<<<<<10`,
        ].join('\n');
        const parsed = parseMrz(mrz);
        const auth = validateMrzAuthenticity(parsed);

        const dateCheck = auth.checks.find((c) => c.name === 'Datas válidas');
        expect(dateCheck?.passed).toBe(true);
    });

    it('should recommend authenticity', () => {
        const mrz = [
            'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
            'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
        ].join('\n');
        const parsed = parseMrz(mrz);
        const auth = validateMrzAuthenticity(parsed);

        expect(auth.recommendation).toContain('autêntico');
    });

    it('should recommend suspicion for invalid MRZ', () => {
        const mrz = 'INVALID_MRZ_DATA';
        const parsed = parseMrz(mrz);
        const auth = validateMrzAuthenticity(parsed);

        expect(auth.authentic).toBe(false);
        expect(auth.recommendation).toContain('não detectada');
    });
});
