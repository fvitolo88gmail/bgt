// lib/bgg-clean.test.ts
//
// Fixture prese direttamente dal thread BGG 3620195 ("Selling to a merchant",
// Brass Birmingham) recuperato durante lo sviluppo — dati reali, non sintetici.

import { describe, it, expect } from 'vitest';
import { cleanForumBody } from './bgg-clean';

describe('cleanForumBody', () => {
    it('rimuove un blocco CDATA di solo embed immagine', () => {
        const raw =
            "If I want to sell 2 differents items to a merchant do I need to used 2 beers or for the action of selling just 1 beer is enough ?&lt;br/&gt;&lt;br/&gt;" +
            "Since this merchant (the one with the avilable beer) only buy Cottons, do I have to use the beer available on the board to sell the Goods to the other merchant ?&lt;br/&gt;&lt;br/&gt;" +
            "<![CDATA[<div style=''><a href=\"https://boardgamegeek.com/image/9256088\"><img src=\"https://cf.geekdo-images.com/...\" border=0></a></div>]]>";

        const result = cleanForumBody(raw);

        expect(result).toContain('If I want to sell 2 differents items');
        expect(result).not.toContain('CDATA');
        expect(result).not.toContain('<img');
        expect(result).not.toContain('geekdo-images');
    });

    it('converte il blocco di citazione in prefisso [citando NOME]', () => {
        const raw =
            "&lt;font color=#2121A4&gt;&lt;div class='quote'&gt;&lt;div class='quotetitle'&gt;&lt;p&gt;&lt;b&gt;Jeanboucher wrote:&lt;/b&gt;&lt;/p&gt;&lt;/div&gt;" +
            "&lt;div class='quotebody'&gt;&lt;i&gt;Thank you for the clarification.&lt;br/&gt;&lt;br/&gt;Now, if it was the other merchant who had the beer ?&lt;/i&gt;&lt;/div&gt;&lt;/div&gt;&lt;/font&gt;&lt;br/&gt;" +
            "You still need two beers.";

        const result = cleanForumBody(raw);

        expect(result).toContain('[citando Jeanboucher] Thank you for the clarification');
        expect(result).toContain('You still need two beers.');
        expect(result).not.toContain('<div');
        expect(result).not.toContain('quotetitle');
    });

    it('decodifica le entità HTML base senza lasciare tag residui', () => {
        const raw =
            "The rules state &quot;Beer &lt;b&gt;&lt;u&gt;may &lt;/u&gt;&lt;/b&gt;be consumed from any of the following sources'.";

        const result = cleanForumBody(raw);

        expect(result).toBe("The rules state \"Beer may be consumed from any of the following sources'.");
    });

    it('non introduce righe vuote multiple dopo lo strip dei <br/>', () => {
        const raw = 'Prima riga.&lt;br/&gt;&lt;br/&gt;Seconda riga.';
        const result = cleanForumBody(raw);
        expect(result).toBe('Prima riga.\n\nSeconda riga.');
    });
});