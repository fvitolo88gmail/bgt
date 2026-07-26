import { decodeHtmlEntities } from '@/lib/bgg-clean';

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
}

export function sourceLabel(s: Source): string {
    if (s.source === 'forum') {
        // Decodifica difensiva: i thread ingested prima del fix in lib/bgg.ts
        // hanno subject con entità HTML grezze (es. "one&#039;s") già in DB —
        // qui si corregge la visualizzazione senza richiedere un backfill.
        return s.threadSubject ? `Forum — ${decodeHtmlEntities(s.threadSubject)}` : 'Forum';
    }
    return s.section ?? (s.page != null ? `Pagina ${s.page}` : 'Manuale');
}
