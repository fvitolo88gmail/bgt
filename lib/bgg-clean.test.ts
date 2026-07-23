import { describe, it, expect } from 'vitest';
import { cleanForumBody } from './bgg-clean';

describe('cleanForumBody', () => {
    it('rimuove un blocco CDATA di solo embed immagine', () => {
        const raw =
            "If I want to sell 2 items&lt;br/&gt;&lt;br/&gt;" +
            "<![CDATA[<div style=''><a href=\"https://boardgamegeek.com/image/9256088\"><img src=\"x\" border=0></a></div>]]>";
        const { bodyClean } = cleanForumBody(raw);
        expect(bodyClean).toContain('If I want to sell 2 items');
        expect(bodyClean).not.toContain('img');
    });

    it('estrae il quotedAuthor e rimuove interamente il blocco citato', () => {
        const raw =
            "&lt;font color=#2121A4&gt;&lt;div class='quote'&gt;&lt;div class='quotetitle'&gt;&lt;p&gt;&lt;b&gt;Jeanboucher wrote:&lt;/b&gt;&lt;/p&gt;&lt;/div&gt;" +
            "&lt;div class='quotebody'&gt;&lt;i&gt;Thank you for the clarification.&lt;/i&gt;&lt;/div&gt;&lt;/div&gt;&lt;/font&gt;&lt;br/&gt;" +
            "You still need two beers.";
        const { bodyClean, quotedAuthor } = cleanForumBody(raw);
        expect(quotedAuthor).toBe('Jeanboucher');
        expect(bodyClean).toBe('You still need two beers.');
        expect(bodyClean).not.toContain('Thank you');
    });

    it('gestisce citazioni annidate rimuovendo tutti i livelli senza frammenti residui', () => {
        const raw =
            "&lt;font color=#2121A4&gt;&lt;div class='quote'&gt;&lt;div class='quotetitle'&gt;&lt;p&gt;&lt;b&gt;Froggy_Steve wrote:&lt;/b&gt;&lt;/p&gt;&lt;/div&gt;" +
            "&lt;div class='quotebody'&gt;Hi Hamko, whilst theft is tempting... " +
            "&lt;font color=#2121A4&gt;&lt;div class='quote'&gt;&lt;div class='quotetitle'&gt;&lt;p&gt;&lt;b&gt;Hamko wrote:&lt;/b&gt;&lt;/p&gt;&lt;/div&gt;" +
            "&lt;div class='quotebody'&gt;Totally agree.&lt;/div&gt;&lt;/div&gt;&lt;/font&gt;" +
            "&lt;/div&gt;&lt;/div&gt;&lt;/font&gt;&lt;br/&gt;" +
            "Don't forget to remind the person that gifted you Brass that they are a thief.";

        const { bodyClean, quotedAuthor } = cleanForumBody(raw);
        expect(quotedAuthor).toBe('Froggy_Steve');
        expect(bodyClean).toBe("Don't forget to remind the person that gifted you Brass that they are a thief.");
        expect(bodyClean).not.toContain('Hamko');
        expect(bodyClean).not.toContain('Totally agree');
    });

    it('nessuna citazione: quotedAuthor è null, testo invariato', () => {
        const { bodyClean, quotedAuthor } = cleanForumBody('New player here, question about setup.');
        expect(quotedAuthor).toBeNull();
        expect(bodyClean).toBe('New player here, question about setup.');
    });
});