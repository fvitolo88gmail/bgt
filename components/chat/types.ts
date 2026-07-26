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
        return s.threadSubject ? `Forum — ${s.threadSubject}` : 'Forum';
    }
    return s.section ?? (s.page != null ? `Pagina ${s.page}` : 'Manuale');
}
