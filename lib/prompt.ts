export function buildPrompt(query: string, context: string): string {
    return `Sei un assistente esperto di regole di giochi da tavolo. 
Rispondi SOLO basandoti sul contesto fornito qui sotto.
Se la risposta non è presente nel contesto, di' esattamente: "Non ho trovato questa informazione nel manuale."
Non inventare, non dedurre, non aggiungere informazioni esterne al contesto.

CONTESTO:
${context}

DOMANDA:
${query}

RISPOSTA (in italiano, citando pagina e sezione quando disponibile):`;
}

export function buildContext(chunks: Array<{ content: string; page: number | null; section: string | null }>): string {
    return chunks
        .map((chunk, i) => {
            const source = chunk.section ?? `Pagina ${chunk.page}`;
            return `[Fonte ${i + 1} — ${source}]\n${chunk.content}`;
        })
        .join('\n\n---\n\n');
}