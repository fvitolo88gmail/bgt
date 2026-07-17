/**
 * Client per l'API XML di BoardGameGeek (BGG XMLAPI2).
 *
 * Richiede autenticazione Bearer token (BGG_TOKEN) — BGG ha introdotto la
 * registrazione app obbligatoria, in deroga alla vecchia documentazione
 * pubblica che indicava l'API come open (D26). BGG segnala il throttling con
 * risposte 500/503 ("server troppo occupato"), non con 429 — rispettiamo un
 * intervallo minimo di RATE_LIMIT_MS tra richieste consecutive e ritentiamo
 * con backoff esponenziale su questi due codici.
 *
 * Ogni funzione pubblica restituisce dati già tipizzati e "piatti" — il
 * parsing XML grezzo resta interno a questo file.
 */

import { XMLParser } from 'fast-xml-parser';

const bggToken = process.env.BGG_TOKEN;
if (!bggToken) throw new Error('Missing BGG_TOKEN');

const BGG_BASE_URL = 'https://boardgamegeek.com/xmlapi2';
const RATE_LIMIT_MS = 5000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 2000;

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    // Tag che possono ripetersi: forziamo sempre un array, anche con 0/1 occorrenze,
    // per non dover distinguere object-vs-array a valle nel codice di parsing.
    isArray: (tagName) =>
        ['item', 'link', 'name', 'forum', 'thread', 'article'].includes(tagName),
});

export class BggApiError extends Error {
    constructor(
        message: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'BggApiError';
    }
}

export interface BggSearchResult {
    bggId: number;
    name: string;
    yearPublished: number | null;
}

export interface BggThingDetails {
    bggId: number;
    name: string;
    designers: string[];
}

export interface BggForumSummary {
    forumId: number;
    title: string;
    numThreads: number;
}

export interface BggThreadSummary {
    threadId: number;
    subject: string;
    replyCount: number;
    postDate: string;
}

export interface BggPost {
    postId: number;
    authorUsername: string;
    postDate: string;
    body: string;
}

export interface BggThreadDetails {
    threadId: number;
    subject: string;
    posts: BggPost[];
}

let lastRequestTimestamp = 0;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimit(): Promise<void> {
    const elapsed = Date.now() - lastRequestTimestamp;
    const remaining = RATE_LIMIT_MS - elapsed;
    if (remaining > 0) {
        await sleep(remaining);
    }
}

/**
 * Esegue una GET verso BGG XMLAPI2, rispettando il rate limit e ritentando
 * con backoff esponenziale su 500/503. Isolata in questa funzione così da
 * essere mockabile nei test (basta mockare il `fetch` globale).
 */
async function fetchBggXml(
    path: string,
    params: Record<string, string> = {}
): Promise<string> {
    const url = new URL(`${BGG_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    let attempt = 0;

    while (true) {
        await waitForRateLimit();
        lastRequestTimestamp = Date.now();

        let response: Response;
        try {
            response = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${bggToken}` },
            });
        } catch (error) {
            throw new BggApiError(
                `Errore di rete verso BGG (${url.toString()}): ${(error as Error).message}`
            );
        }

        // BGG segnala il throttling con 500/503 ("server occupato"), non con 429
        // (fonte: https://boardgamegeek.com/wiki/page/BGG_XML_API2, sezione "Rate Limit").
        if (response.status === 500 || response.status === 503) {
            attempt += 1;
            if (attempt > MAX_RETRIES) {
                throw new BggApiError(
                    `BGG occupato (status ${response.status}) dopo ${MAX_RETRIES} tentativi su ${url.toString()}`,
                    response.status
                );
            }
            const backoffMs = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
            await sleep(backoffMs);
            continue;
        }

        if (!response.ok) {
            throw new BggApiError(
                `BGG ha risposto ${response.status} per ${url.toString()}`,
                response.status
            );
        }

        return response.text();
    }
}

function toNumber(value: unknown, fallback: number): number {
    const parsed =
        typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

// ---- /search ----

interface RawNameNode {
    type?: string;
    value?: string;
}

interface RawSearchItem {
    id?: string;
    name?: RawNameNode[];
    yearpublished?: { value?: string };
}

export async function searchGame(query: string): Promise<BggSearchResult[]> {
    const xml = await fetchBggXml('/search', { query, type: 'boardgame' });
    const parsed = xmlParser.parse(xml) as { items?: { item?: RawSearchItem[] } };
    const items = ensureArray(parsed.items?.item);

    return items
        .map((item): BggSearchResult | null => {
            const bggId = toNumber(item.id, Number.NaN);
            const primaryName = ensureArray(item.name)[0]?.value;
            if (!Number.isFinite(bggId) || !primaryName) return null;

            const yearRaw = item.yearpublished?.value;
            const year = yearRaw ? toNumber(yearRaw, Number.NaN) : Number.NaN;

            return {
                bggId,
                name: primaryName,
                yearPublished: Number.isFinite(year) ? year : null,
            };
        })
        .filter((result): result is BggSearchResult => result !== null);
}

// ---- /thing ----

interface RawLinkNode {
    type?: string;
    value?: string;
}

interface RawThingItem {
    id?: string;
    name?: RawNameNode[];
    link?: RawLinkNode[];
}

export async function getThing(bggId: number): Promise<BggThingDetails> {
    const xml = await fetchBggXml('/thing', { id: String(bggId) });
    const parsed = xmlParser.parse(xml) as { items?: { item?: RawThingItem[] } };
    const item = ensureArray(parsed.items?.item)[0];

    if (!item) {
        throw new BggApiError(`Nessun risultato BGG per thing id=${bggId}`);
    }

    const names = ensureArray(item.name);
    const primaryName =
        names.find((name) => name.type === 'primary')?.value ?? names[0]?.value;

    if (!primaryName) {
        throw new BggApiError(`Nome mancante nella risposta BGG per thing id=${bggId}`);
    }

    const designers = ensureArray(item.link)
        .filter((link) => link.type === 'boardgamedesigner')
        .map((link) => link.value)
        .filter((value): value is string => Boolean(value));

    return { bggId, name: primaryName, designers };
}

// ---- /forumlist ----

interface RawForumNode {
    id?: string;
    title?: string;
    numthreads?: string;
}

export async function getForumList(bggId: number): Promise<BggForumSummary[]> {
    const xml = await fetchBggXml('/forumlist', { id: String(bggId), type: 'thing' });
    const parsed = xmlParser.parse(xml) as { forums?: { forum?: RawForumNode[] } };
    const forums = ensureArray(parsed.forums?.forum);

    return forums
        .map((forum): BggForumSummary | null => {
            const forumId = toNumber(forum.id, Number.NaN);
            if (!Number.isFinite(forumId) || !forum.title) return null;
            return {
                forumId,
                title: forum.title,
                numThreads: toNumber(forum.numthreads, 0),
            };
        })
        .filter((forum): forum is BggForumSummary => forum !== null);
}

// ---- /forum (paginato) ----

interface RawThreadNode {
    id?: string;
    subject?: string;
    numarticles?: string;
    postdate?: string;
}

export async function getForumThreads(
    forumId: number,
    page = 1
): Promise<BggThreadSummary[]> {
    const xml = await fetchBggXml('/forum', {
        id: String(forumId),
        page: String(page),
    });
    const parsed = xmlParser.parse(xml) as {
        forum?: { threads?: { thread?: RawThreadNode[] } };
    };
    const threads = ensureArray(parsed.forum?.threads?.thread);

    return threads
        .map((thread): BggThreadSummary | null => {
            const threadId = toNumber(thread.id, Number.NaN);
            if (!Number.isFinite(threadId) || !thread.subject) return null;
            const numArticles = toNumber(thread.numarticles, 0);
            return {
                threadId,
                subject: thread.subject,
                // numarticles conta anche il post iniziale del thread.
                replyCount: Math.max(0, numArticles - 1),
                postDate: thread.postdate ?? '',
            };
        })
        .filter((thread): thread is BggThreadSummary => thread !== null);
}

// ---- /thread ----

interface RawArticleNode {
    id?: string;
    username?: string;
    postdate?: string;
    body?: string;
}

export async function getThread(threadId: number): Promise<BggThreadDetails> {
    const xml = await fetchBggXml('/thread', { id: String(threadId) });
    const parsed = xmlParser.parse(xml) as {
        thread?: {
            subject?: string;
            articles?: { article?: RawArticleNode[] };
        };
    };

    const thread = parsed.thread;
    if (!thread) {
        throw new BggApiError(`Nessun thread trovato per id=${threadId}`);
    }

    const posts = ensureArray(thread.articles?.article)
        .map((article): BggPost | null => {
            const postId = toNumber(article.id, Number.NaN);
            if (!Number.isFinite(postId) || !article.username) return null;
            return {
                postId,
                authorUsername: article.username,
                postDate: article.postdate ?? '',
                body: article.body ?? '',
            };
        })
        .filter((post): post is BggPost => post !== null);

    return { threadId, subject: thread.subject ?? '', posts };
}