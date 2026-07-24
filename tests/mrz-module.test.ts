import { describe, expect, it } from 'vitest';
import { getMrzValidationState } from '../src/components/forensics/modules/MrzModule.tsx';

describe('MRZ module state', () => {
    it('marks missing MRZ as inconclusive instead of suspicious', () => {
        const state = getMrzValidationState(true, {
            authentic: false,
            notFound: true,
            suspicionScore: 50,
            checks: [],
            recommendation:
                'MRZ não detectada — leitura inconclusiva; isso não indica falsificação por si só.',
        });

        expect(state.statusText).toBe('Leitura inconclusiva');
    });

    it('keeps authentic MRZ clearly labeled', () => {
        const state = getMrzValidationState(true, {
            authentic: true,
            notFound: false,
            suspicionScore: 0,
            checks: [],
            recommendation: 'MRZ válida — documento aparenta ser autêntico.',
        });

        expect(state.statusText).toBe('Autêntica ✓');
    });
});
