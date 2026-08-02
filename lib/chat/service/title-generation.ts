/**
 * Titolo di una conversazione, generato dal primo turno (domanda + risposta)
 * in modalità "conversation" — v. app/api/chat/route.ts.
 *
 * Fail-soft: se la generazione fallisce, la conversazione resta senza
 * titolo (la sidebar ricadrà su un fallback, es. la prima domanda) invece
 * di far fallire l'intera risposta.
 */

import { geminiClient } from '../../shared/gemini';
import { buildTitlePrompt } from '../prompt';

const TITLE_MAX_LENGTH = 80;

export async function generateSessionTitle(
    question: string,
    answer: string,
    userRequestId?: string | null,
): Promise<string | null> {
    try {
        const raw = await geminiClient.generate(
            buildTitlePrompt(question, answer),
            userRequestId ? { userRequestId, callType: 'title_generation' } : undefined,
        );
        const title = raw.trim().replace(/^["']|["']$/g, '').slice(0, TITLE_MAX_LENGTH);
        if (!title) {
            throw new Error('titolo generato vuoto');
        }
        return title;
    } catch (err) {
        console.error('[title-generation] generazione titolo fallita, la conversazione resta senza titolo:', err);
        return null;
    }
}
