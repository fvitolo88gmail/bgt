// lib/chat/prompt/title.ts
//
// Prompt per generare il titolo di una conversazione dal suo primo turno
// (domanda + risposta) — v. lib/chat/service/title-generation.ts.

export function buildTitlePrompt(question: string, answer: string): string {
    return `Genera un titolo breve per una conversazione di chat su regole di un gioco da tavolo, a partire dal primo scambio riportato sotto.

DOMANDA:
${question}

RISPOSTA:
${answer}

Regole per il titolo:
- Massimo 6 parole, nella stessa lingua della domanda.
- Riassumi l'argomento della domanda, non la risposta.
- Nessuna punteggiatura finale, nessuna virgoletta, nessun prefisso tipo "Titolo:".

Rispondi SOLO con il titolo, una singola riga di testo.`;
}
