import { describe, it, expect } from 'vitest';
import { getDisplayName, getGreetingName, getInitials } from '../../../profile/service/profile-display';

describe('getDisplayName', () => {
    it('nome e cognome se entrambi presenti', () => {
        expect(getDisplayName({ firstName: 'Francesco', lastName: 'Vitolo' }, 'fra@example.com')).toBe(
            'Francesco Vitolo',
        );
    });

    it('solo nome se manca il cognome', () => {
        expect(getDisplayName({ firstName: 'Francesco', lastName: null }, 'fra@example.com')).toBe('Francesco');
    });

    it('parte locale email se nome/cognome assenti', () => {
        expect(getDisplayName({ firstName: null, lastName: null }, 'fra@example.com')).toBe('fra');
    });

    it('stringhe vuote/spazi trattate come assenti', () => {
        expect(getDisplayName({ firstName: '  ', lastName: '' }, 'fra@example.com')).toBe('fra');
    });
});

describe('getGreetingName', () => {
    it('solo il nome, mai il cognome', () => {
        expect(getGreetingName({ firstName: 'Francesco', lastName: 'Vitolo' }, 'fra@example.com')).toBe(
            'Francesco',
        );
    });

    it('parte locale email se manca il nome', () => {
        expect(getGreetingName({ firstName: null, lastName: 'Vitolo' }, 'fra@example.com')).toBe('fra');
    });
});

describe('getInitials', () => {
    it('iniziali di nome e cognome se entrambi presenti', () => {
        expect(getInitials({ firstName: 'Francesco', lastName: 'Vitolo' }, 'fra@example.com')).toBe('FV');
    });

    it('prime due lettere del nome visualizzato se manca il cognome', () => {
        expect(getInitials({ firstName: 'Francesco', lastName: null }, 'fra@example.com')).toBe('FR');
    });

    it('prime due lettere della parte locale email se nessun nome', () => {
        expect(getInitials({ firstName: null, lastName: null }, 'fra@example.com')).toBe('FR');
    });
});
