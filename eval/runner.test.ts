/**
 * eval/runner.ts
 *
 * Esegue ogni domanda di una fixture contro l'endpoint /api/chat del RAG,
 * valuta la risposta con un LLM-as-judge (Gemini) confrontandola con
 * expected_answer, e stampa accuratezza % + log dei fallimenti.
 *
 * Uso:
 *   EVAL_FIXTURE=<nome> npx vitest run eval/runner.ts
 *
 * Richiede in .env.local:
 *   GEMINI_API_KEY
 *   EVAL_BASE_URL         (es. http://localhost:3000, default)
 *   EVAL_FIXTURE          (nome file senza .json in eval/fixtures/, obbligatorio)
 *   EVAL_GAME_ID          (uuid del gioco in Supabase — default noto per le fixture
 *                          registrate in DEFAULT_GAME_IDS; obbligatorio per fixture nuove)
 */
import 'dotenv/config';
import { describe, it, expect } from "vitest";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

// --- Config -----------------------------------------------------------

const BASE_URL = process.env.EVAL_BASE_URL ?? "http://localhost:3000";

if (!process.env.EVAL_FIXTURE) {
    throw new Error("EVAL_FIXTURE non impostata — indica esplicitamente quale fixture eseguire.");
}
const FIXTURE_NAME = process.env.EVAL_FIXTURE;
const FIXTURE_PATH = path.join(__dirname, "fixtures", `${FIXTURE_NAME}.json`);
const JUDGE_MODEL = "gemini-3.1-flash-lite";

// game_id di default per le fixture note (evita di dover passare sempre
// EVAL_GAME_ID a mano) — per una fixture nuova non elencata qui, va passato
// esplicitamente via env, altrimenti lo script si ferma con un errore chiaro.
const DEFAULT_GAME_IDS: Record<string, string> = {
    hegemony: "d17ebf75-284a-4a4d-b3fa-0cc16287fce4",
};

function resolveGameId(): string {
    if (process.env.EVAL_GAME_ID) return process.env.EVAL_GAME_ID;
    const known = DEFAULT_GAME_IDS[FIXTURE_NAME];
    if (known) return known;
    throw new Error(
        `Nessun game_id di default per la fixture "${FIXTURE_NAME}" — passa EVAL_GAME_ID esplicitamente.`
    );
}

const GAME_ID = resolveGameId();

// Soglia indicativa: 16/20 = 80%
const ACCEPTABLE_THRESHOLD = 0.8;

// Timeout per domanda: ~3 chiamate Gemini (embedding+generate dentro
// /api/chat, più generate del judge) + pausa di 15s per il rate limit free
// tier (15 richieste/minuto). Usato per calcolare il timeout totale del test.
const MS_PER_QUESTION = 45_000;

// --- Tipi ---------------------------------------------------------------

interface FixtureItem {
    id: string;
    question: string;
    expected_answer: string;
    source_page?: number;
    source_thread?: number; // id thread BGG, per fixture forum-dipendenti (es. hegemony.json)
}

interface ChatApiResponse {
    answer: string;
    sources: Array<{ page?: number; section?: string; [key: string]: unknown }>;
}

interface EvalResult {
    id: string;
    question: string;
    expected_answer: string;
    actual_answer: string;
    correct: boolean;
    judge_reasoning: string;
}

const FIXTURE: FixtureItem[] = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));

// --- Judge (LLM-as-judge) -------------------------------------------------

/**
 * Chiede a Gemini se actual_answer è semanticamente equivalente a
 * expected_answer rispetto alla domanda data. Isolata e mockabile,
 * come richiesto da CLAUDE.md per le chiamate LLM.
 */
async function judgeAnswer(
    ai: GoogleGenAI,
    question: string,
    expectedAnswer: string,
    actualAnswer: string,
): Promise<{ correct: boolean; reasoning: string }> {
    const prompt = `Sei un giudice imparziale che valuta risposte di un assistente RAG per regole di giochi da tavolo.

Domanda: ${question}

Risposta attesa (ground truth): ${expectedAnswer}

Risposta effettiva del sistema: ${actualAnswer}

Valuta se la risposta effettiva è corretta rispetto alla risposta attesa. La risposta effettiva NON deve essere identica parola per parola: è corretta se comunica la stessa informazione fattuale rilevante per la domanda, anche con parole diverse o con dettagli aggiuntivi non contraddittori. È SBAGLIATA se omette l'informazione chiave richiesta, la contraddice, o dichiara di non trovare la risposta quando invece era disponibile.

Rispondi ESCLUSIVAMENTE in JSON, senza markdown, con questo formato esatto:
{"correct": true o false, "reasoning": "una frase breve che spiega la valutazione"}`;

    const response = await ai.models.generateContent({
        model: JUDGE_MODEL,
        contents: prompt,
    });

    const text = (response.text ?? "").trim();

    try {
        const cleaned = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as { correct: boolean; reasoning: string };
        return { correct: parsed.correct, reasoning: parsed.reasoning };
    } catch (err) {
        throw new Error(
            `Judge ha restituito output non parsabile come JSON: "${text}". Errore: ${err}`,
        );
    }
}

// --- Chiamata al RAG ------------------------------------------------------

async function askRag(question: string): Promise<ChatApiResponse> {
    const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, gameId: GAME_ID }),
    });

    if (!res.ok) {
        throw new Error(
            `Chiamata a /api/chat fallita: ${res.status} ${res.statusText}`,
        );
    }

    return (await res.json()) as ChatApiResponse;
}

// --- Runner principale ------------------------------------------------

async function runEval(): Promise<EvalResult[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY non impostata in .env.local");
    }

    const ai = new GoogleGenAI({ apiKey });

    const results: EvalResult[] = [];

    for (const item of FIXTURE) {
        console.log(`[${item.id}] domanda in corso...`);
        let actualAnswer: string;
        try {
            const ragResponse = await askRag(item.question);
            actualAnswer = ragResponse.answer;
        } catch (err) {
            results.push({
                id: item.id,
                question: item.question,
                expected_answer: item.expected_answer,
                actual_answer: `[ERRORE CHIAMATA RAG: ${(err as Error).message}]`,
                correct: false,
                judge_reasoning: "Chiamata a /api/chat fallita, nessuna valutazione possibile.",
            });
            continue;
        }

        let judgement: { correct: boolean; reasoning: string };
        try {
            judgement = await judgeAnswer(
                ai,
                item.question,
                item.expected_answer,
                actualAnswer,
            );
        } catch (err) {
            judgement = {
                correct: false,
                reasoning: `[ERRORE CHIAMATA JUDGE: ${(err as Error).message}] — nessuna valutazione affidabile possibile.`,
            };
        }
        console.log(`[${item.id}] ${judgement.correct ? "✅" : "❌"}`);

        results.push({
            id: item.id,
            question: item.question,
            expected_answer: item.expected_answer,
            actual_answer: actualAnswer,
            correct: judgement.correct,
            judge_reasoning: judgement.reasoning,
        });

        // Scrittura incrementale: se il processo crasha su una domanda
        // successiva (rete, quota), i risultati fin qui restano su disco
        // invece di essere persi insieme al processo in memoria.
        const partialPath = path.join(__dirname, "results", `${FIXTURE_NAME}-partial.json`);
        fs.mkdirSync(path.dirname(partialPath), { recursive: true });
        fs.writeFileSync(partialPath, JSON.stringify(results, null, 2), "utf-8");

        // Pausa tra domande per restare sotto il limite di 15 richieste/minuto
        // del piano free Gemini (gemini-3.1-flash-lite). Ogni iterazione
        // consuma circa 3 chiamate Gemini nel complesso (embedding + generate
        // dentro /api/chat, più generate del judge), quindi una pausa di
        // ~15s tiene il ritmo a un margine di sicurezza sotto soglia.
        await new Promise((res) => setTimeout(res, 15_000));
    }

    return results;
}

function printReport(results: EvalResult[]): void {
    const correctCount = results.filter((r) => r.correct).length;
    const total = results.length;
    const accuracy = total > 0 ? correctCount / total : 0;

    console.log(`\n=== EVAL REPORT — ${FIXTURE_NAME} ===\n`);
    console.log(`Accuratezza: ${correctCount}/${total} (${(accuracy * 100).toFixed(1)}%)`);
    console.log(
        `Soglia target: ${(ACCEPTABLE_THRESHOLD * 100).toFixed(0)}% → ${
            accuracy >= ACCEPTABLE_THRESHOLD ? "RAGGIUNTA ✅" : "NON RAGGIUNTA ❌"
        }\n`,
    );

    const failures = results.filter((r) => !r.correct);
    if (failures.length > 0) {
        console.log(`--- Domande fallite (${failures.length}) ---\n`);
        for (const f of failures) {
            console.log(`[${f.id}] ${f.question}`);
            console.log(`  Attesa:   ${f.expected_answer}`);
            console.log(`  Ottenuta: ${f.actual_answer}`);
            console.log(`  Motivo:   ${f.judge_reasoning}`);
            console.log("");
        }
    } else {
        console.log("Nessun fallimento.\n");
    }
}

// --- Entry point vitest -------------------------------------------------

describe(`Eval RAG — ${FIXTURE_NAME}`, () => {
    it(
        "esegue la fixture e stampa il report di accuratezza",
        async () => {
            const results = await runEval();
            printReport(results);

            const accuracy = results.filter((r) => r.correct).length / results.length;

            // Il test non fallisce sotto soglia: serve solo a documentare la
            // baseline. La soglia è un target, non un gate.
            expect(results.length).toBe(FIXTURE.length);
            if (accuracy < ACCEPTABLE_THRESHOLD) {
                console.warn(
                    `⚠️  Baseline sotto la soglia target (${(ACCEPTABLE_THRESHOLD * 100).toFixed(0)}%).`,
                );
            }
        },
        FIXTURE.length * MS_PER_QUESTION,
    );
});