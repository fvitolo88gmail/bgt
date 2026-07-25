export interface ExtractedPage {
    page: number;          // pagina logica (dopo split spread)
    physicalPage: number;  // indice 0-based nel PDF originale, per pdf-lib
    content: string;
}

export interface SectionOutline {
    title: string;
    startPage: number; // pagina logica
    endPage: number;   // pagina logica
}

export interface GeneratedSection {
    section: SectionOutline;
    body: string;
    pageLabel: string;
}