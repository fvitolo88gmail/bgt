import { decodeHtmlEntities } from '@/lib/bgg/service/bgg-clean';

export interface Source {
    source: 'manual' | 'forum';
    page: number | null;
    section: string | null;
    threadSubject: string | null;
    isDesignerResponse: boolean | null;
    similarity: number;
    bggUrl: string | null;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
    // presente solo per risposte assistant salvate (modalità conversation) —
    // serve ad agganciare il pollice su/giù al messaggio corretto in DB.
    messageId?: string | null;
    feedback?: 'good' | 'bad' | null;
}

export function sourceLabel(s: Source): string {
    if (s.source === 'forum') {
        // Decodifica difensiva: i thread ingested prima del fix in lib/bgg.ts
        // hanno subject con entità HTML grezze (es. "one&#039;s") già in DB —
        // qui si corregge la visualizzazione senza richiedere un backfill.
        return s.threadSubject ? `Forum — ${decodeHtmlEntities(s.threadSubject)}` : 'Forum';
    }
    // La pagina va sempre inclusa insieme alla sezione quando disponibile,
    // non solo come fallback (stesso bug già corretto in lib/retrieval.ts
    // per il testo passato al modello — qui è la stessa etichetta ma per la
    // UI, le due implementazioni sono separate).
    const sectionPart = s.section ?? 'Manuale';
    return s.page != null ? `${sectionPart}, pagina ${s.page}` : sectionPart;
}
