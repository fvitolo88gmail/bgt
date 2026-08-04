/**
 * Etichette leggibili e descrizioni per i call_type interni (v. schema
 * gemini_calls) — un solo posto invece di duplicare la mappa in ogni
 * componente che mostra il tipo di operazione (tabella per tipo operazione,
 * dettaglio top 10 richieste).
 */
export interface CallTypeInfo {
    label: string;
    description: string;
}

export const CALL_TYPE_INFO: Record<string, CallTypeInfo> = {
    embedding: {
        label: 'Embedding',
        description: 'Trasforma la domanda in un vettore numerico per la ricerca semantica tra i chunk del manuale.',
    },
    generation: {
        label: 'Generazione',
        description: 'Genera la risposta finale in linguaggio naturale a partire dal contesto recuperato.',
    },
    query_contextualization: {
        label: 'Contestualizzazione query',
        description:
            'Riscrive la domanda in forma standalone tenendo conto della cronologia della conversazione, prima del retrieval.',
    },
    query_enhancement: {
        label: 'Query enhancement',
        description: 'Arricchisce o riformula la domanda per migliorare il recupero dei chunk pertinenti.',
    },
    reranking: {
        label: 'Reranking',
        description: 'Riordina i chunk recuperati per rilevanza rispetto alla domanda, prima di costruire il contesto.',
    },
    title_generation: {
        label: 'Generazione titolo',
        description: 'Genera il titolo della conversazione a partire dal primo turno di domanda e risposta.',
    },
};

export function getCallTypeLabel(callType: string): string {
    return CALL_TYPE_INFO[callType]?.label ?? callType;
}

export function getCallTypeDescription(callType: string): string | null {
    return CALL_TYPE_INFO[callType]?.description ?? null;
}
