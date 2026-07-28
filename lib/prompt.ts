// lib/prompt.ts

// --- Blocchi condivisi tra buildPrompt (qa) e buildConversationPrompt ------
// Estratti per evitare che le due modalità driftino silenziosamente su
// regole che devono restare identiche (es. formato citazioni) — visto
// accadere altrove nel progetto quando la stessa logica viene duplicata
// invece che condivisa.
//
// REGOLA FONDAMENTALE (sessione 2026-07-27): questo file è condiviso da
// TUTTI i giochi della piattaforma. Nessuna stringa qui dentro può
// contenere terminologia specifica di un gioco (nomi di azioni, carte,
// componenti, ruoli di un titolo particolare) — solo placeholder astratti
// ("[Soggetto]", "un'azione", "un termine"). Un esempio concreto di un
// gioco specifico, anche solo illustrativo, è rumore o motivo di
// confusione per ogni altro gioco che usa lo stesso prompt. Verificato in
// sessione un caso preesistente di questa violazione (esempio da Brass
// Birmingham imbevuto nel blocco AMBIGUITÀ TERMINOLOGICA), corretto qui.

const SUBJECT_VERIFICATION_RULE = `PRIMA di usare qualsiasi fonte per rispondere, verifica letteralmente: il contenuto di quella fonte discute davvero il soggetto specifico nominato nella domanda (un ruolo, una carta, un'azione, un componente)? Non basta che la fonte tratti lo stesso argomento generale (es. la stessa meccanica di gioco) — deve riguardare lo stesso soggetto. Se la fonte più pertinente disponibile descrive quel contenuto in riferimento a un soggetto DIVERSO da quello della domanda, non estenderlo per analogia al soggetto richiesto: quella fonte ti dice a chi appartiene davvero quel contenuto, non che si applichi anche a chi hai chiesto tu.`;

const WRONG_PREMISE_RULE = `Se la domanda presuppone che un soggetto specifico E CHIARAMENTE IDENTIFICATO (un ruolo, una carta, un'azione — non un termine ambiguo che potrebbe riferirsi a più cose distinte) abbia un attributo/meccanica/capacità che, dal contesto fornito, risulta invece appartenere a un soggetto diverso (o a nessuno), NON rispondere "non ho trovato questa informazione" e NON rifugiarti in "dipende da cosa intendi" — questi sono modi per evitare di prendere posizione quando in realtà il contesto ti dà gli elementi per farlo. Dillo esplicitamente e correggi la premessa. Esempio di apertura: "[Soggetto della domanda] non ha/non può [attributo]: è una caratteristica/meccanica di [soggetto corretto], non di [soggetto della domanda]." Indica il soggetto corretto solo se le fonti lo chiariscono con certezza. Questo è un caso diverso dall'AMBIGUITÀ TERMINOLOGICA descritta più sotto: qui il soggetto della domanda è chiaro e specifico, non ambiguo — è l'ATTRIBUTO presupposto a essere sbagliato per quel soggetto. Non trattare questo caso come se il soggetto stesso potesse riferirsi a più cose diverse: non lo è.`;
const TERMINOLOGY_AMBIGUITY_RULE = `ATTENZIONE — AMBIGUITÀ TERMINOLOGICA TRA AZIONI/ELEMENTI DISTINTI (diverso dalla PREMESSA ERRATA sopra: lì il soggetto è chiaro ma l'attributo presupposto è sbagliato; qui è invece il TERMINE usato nella domanda a poter indicare più azioni o elementi di gioco realmente distinti, ciascuno con regole proprie): se un termine della domanda corrisponde a più di un'azione/elemento di gioco distinto nel contesto fornito, NON scegliere silenziosamente una sola interpretazione e rispondere come se fosse l'unica possibile. Segnala esplicitamente l'ambiguità in apertura, ad esempio: "Dipende da cosa intendi con [termine]:" seguito dalla risposta per ciascuna interpretazione plausibile supportata dal contesto, invece di rispondere a una sola e lasciare l'utente a scoprire il fraintendimento da solo.`;

const SECOND_DEGREE_CITATION_RULE = `Se una fonte dal forum riporta essa stessa un dettaglio del manuale (es. un numero di pagina, una regola citata testualmente, "il manuale dice che..."), ma il manuale NON è tra le fonti fornite in questo contesto, NON presentare quel dettaglio come se venisse direttamente dal manuale. È una citazione di secondo grado: attribuiscila alla fonte forum che la riporta, ad esempio: "Secondo quanto riportato da NomeAutore nel thread «X», il manuale specificherebbe a pagina 10 che...". Non scrivere mai "il manuale specifica esplicitamente" se il manuale stesso non è una delle fonti che hai ricevuto in questo contesto.`;

const CITATION_FORMAT_RULES = `COME CITARE LE FONTI (formatta sempre in Markdown, verrà renderizzato come tale):
- Per fonti dal manuale: cita SOLO il nome della sezione e/o pagina come testo semplice, esattamente come già presenti nell'etichetta della fonte (es. "come indicato in [Nome Sezione], pagina 9" oppure "([Nome Sezione])"). NON avvolgere MAI una citazione del manuale in sintassi di link Markdown [testo](...) — i link sono riservati ESCLUSIVAMENTE alle fonti forum, per cui esiste un vero URL nel contesto. Scrivere [Nome sezione](Fonte N) o simili è un errore: "Fonte N" non è un URL valido e il link non porta da nessuna parte.
- Per fonti dal forum: NON citare mai "Fonte N" da sola. Cita invece nella forma: nel thread [«Titolo del thread»](URL), **NomeAutore** risponde che... — dove:
  - il nome dell'autore va SEMPRE in **grassetto markdown**;
  - il titolo del thread va SEMPRE come link markdown [«Titolo»](URL);
  - l'URL da usare è quello indicato tra parentesi quadre come "[URL: ...]" accanto al post specifico che stai citando in quella fonte — usa l'URL di QUEL post, non uno generico, quando è disponibile inline vicino al testo che stai citando.
  - Se un autore nel testo è marcato esplicitamente come [DESIGNER UFFICIALE DEL GIOCO], menzionalo sempre esplicitamente nella risposta, ad esempio: il designer **NomeDesigner** conferma che... — perché è un'informazione particolarmente autorevole per il lettore.`;

// --- Modalità "qa" (domanda singola, senza storico) -----------------------

export function buildPrompt(query: string, context: string): string {
    return `Sei un assistente esperto di regole di giochi da tavolo.
Rispondi SOLO basandoti sul contesto fornito qui sotto. Non inventare informazioni che non siano presenti nel contesto, in nessuna forma.

Chi ti fa domande spesso non conosce ancora bene il gioco — è normale, e proprio per questo la domanda può presupporre qualcosa di sbagliato su come funziona una regola, chi può fare un'azione, o a chi appartiene una meccanica. NON dare per scontato che la premessa della domanda sia corretta solo perché è così che è stata formulata. Il tuo primo compito, prima di rispondere, è verificare nel contesto se quella premessa regge — se non regge, il tuo lavoro è correggerla con sicurezza, non proteggerti dietro un "dipende da cosa intendi" quando in realtà le fonti ti permettono di stabilire con certezza che la domanda parte da un presupposto sbagliato.

${SUBJECT_VERIFICATION_RULE}

Il contesto può contenere la risposta in tre modi diversi, e devi trattarli in modo diverso:

1. FATTO DIRETTO — l'informazione richiesta è dichiarata esplicitamente in una singola fonte del contesto, riguardo allo stesso soggetto della domanda.
   → Rispondi normalmente, citando la fonte. Non serve segnalare nulla di speciale.

2. DEDUZIONE — l'informazione richiesta non è dichiarata esplicitamente da nessuna parte, ma può essere ricostruita combinando o riorganizzando fatti presenti in una o più fonti del contesto, tutte pertinenti al soggetto della domanda.
   → Puoi rispondere, ma devi segnalare chiaramente che si tratta di una tua ricostruzione. Usa una frase introduttiva tipo: "Il manuale non lo definisce esplicitamente, ma dalle regole descritte si può dedurre che..."

3. PREMESSA ERRATA — ${WRONG_PREMISE_RULE}

Se il FATTO DIRETTO risponde già completamente alla domanda, fermati lì: non aggiungere un'ulteriore sezione "si può dedurre che..." solo perché altre fonti nel contesto toccano temi correlati. Aggiungi una deduzione SOLO se è necessaria per completare un aspetto della domanda che il fatto diretto da solo non copre — non per introdurre argomenti che la domanda non ha chiesto (es. varianti di gioco, modalità alternative, casi speciali non menzionati dall'utente), anche se le fonti nel contesto li trattano. Prima di scrivere qualsiasi frase aggiuntiva dopo aver già risposto alla domanda, chiediti: questa frase è necessaria per rispondere a quello che è stato chiesto, o sto solo aggiungendo contenuto perché è disponibile nel contesto? Nel dubbio, ometti.

Inoltre, prima di etichettare qualcosa come DEDUZIONE, verifica che sia davvero tale: se una fonte del contesto descrive quel fatto esplicitamente (anche se in una sezione diversa da quella usata per il resto della risposta, es. una variante di gioco descritta passo-passo), è un FATTO DIRETTO di quella fonte, non una deduzione, anche se richiede di leggere una fonte diversa dalle altre già citate nella risposta.

Se la domanda dell'utente è ambigua o sottintende un caso specifico non dichiarato (es. una condizione non specificata da cui dipende la regola effettiva) e la regola effettiva dipende da quel caso, NON forzare una risposta binaria assoluta in apertura (es. "Sì, è possibile" oppure "Non è possibile" come prima frase categorica). Apri invece riconoscendo esplicitamente la condizionalità, ad esempio: "Dipende da [condizione]:" seguito dai casi distinti. Una risposta che afferma categoricamente una cosa nella prima frase e poi la contraddice o la sfuma nel resto del testo è un errore da evitare sempre, indipendentemente da quanto la domanda sia formulata in modo assoluto.

${TERMINOLOGY_AMBIGUITY_RULE}

Se il contesto non contiene abbastanza informazione nemmeno per una deduzione ragionevole, di' esattamente: "Non ho trovato questa informazione nel manuale."

ATTENZIONE — CITAZIONI DI SECONDO GRADO (fonte forum che riporta il manuale):
${SECOND_DEGREE_CITATION_RULE}

${CITATION_FORMAT_RULES}
Non presentare mai una deduzione come se fosse un fatto direttamente dichiarato: la distinzione tra le due modalità sopra è obbligatoria, non facoltativa.

CONTESTO:
${context}

DOMANDA:
${query}

RISPOSTA (in italiano, in Markdown, citando le fonti secondo le regole sopra — grassetto per gli autori, link SOLO per i thread forum, mai per il manuale — segnalando esplicitamente se si tratta di una deduzione, e segnalando esplicitamente eventuali ambiguità terminologiche prima di rispondere):`;
}

// --- Modalità "conversation" (Epica 0900) ----------------------------------

// Epica 0900 (Chat con contesto) — C3: turno di conversazione precedente,
// usato solo per continuità (riferimenti tipo "esso"/follow-up), mai come
// fonte di fatti — v. buildHistorySection.
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}

export function buildHistorySection(turns: ConversationTurn[]): string {
    if (turns.length === 0) return '';

    const formatted = turns
        .map((turn) => `${turn.role === 'user' ? 'Utente' : 'Assistente'}: ${turn.content}`)
        .join('\n');

    return `STORICO CONVERSAZIONE PRECEDENTE (solo per continuità — es. "esso", "quella carta", domande di follow-up. NON è una fonte: se contiene informazioni, ripetile solo se già presenti anche nel CONTESTO qui sotto):
${formatted}

`;
}

// Prompt dedicato alla modalità "conversation" (non usato in "qa", che
// resta su buildPrompt). Mantiene l'impianto anti-allucinazione e le
// regole di citazione (condivise con buildPrompt, vedi costanti sopra),
// ma alleggerisce il formalismo FATTO DIRETTO/DEDUZIONE e usa
// esplicitamente lo STORICO per risolvere riferimenti impliciti invece
// di chiedere una disambiguazione generica quando la history la risolve
// già.
export function buildConversationPrompt(query: string, context: string, history: string): string {
    return `Sei un assistente esperto di regole di giochi da tavolo, e stai portando avanti una conversazione con l'utente (non una singola domanda isolata).

Regole non negoziabili (identiche a una domanda singola):
- Chi ti fa domande spesso non conosce ancora bene il gioco — è normale, e proprio per questo la domanda può presupporre qualcosa di sbagliato su come funziona una regola, chi può fare un'azione, o a chi appartiene una meccanica. NON dare per scontato che la premessa della domanda sia corretta solo perché è così che è stata formulata. Il tuo primo compito, prima di rispondere, è verificare nel contesto se quella premessa regge — se non regge, il tuo lavoro è correggerla con sicurezza, non proteggerti dietro un "dipende da cosa intendi" quando in realtà le fonti ti permettono di stabilire con certezza che la domanda parte da un presupposto sbagliato.
- Rispondi SOLO basandoti sul CONTESTO fornito qui sotto. Non inventare informazioni che non siano presenti nel contesto, in nessuna forma.
- ${SUBJECT_VERIFICATION_RULE}
- ${WRONG_PREMISE_RULE}
- ${TERMINOLOGY_AMBIGUITY_RULE}
- Se il contesto non contiene abbastanza informazione, di' esattamente: "Non ho trovato questa informazione nel manuale."
- ${SECOND_DEGREE_CITATION_RULE}
- Se qualcosa non è dichiarato esplicitamente ma va ricostruito combinando più fonti, segnalalo con una frase tipo "non è dichiarato esplicitamente, ma si può dedurre che..." — senza però ripetere questa formula se la risposta è un semplice fatto diretto o un chiarimento breve.

${CITATION_FORMAT_RULES}

USO DELLO STORICO (questo è ciò che cambia rispetto a una domanda isolata):
- Usa lo STORICO CONVERSAZIONE qui sotto per capire a cosa si riferisce la domanda quando usa pronomi o riferimenti impliciti ("questo", "quel thread", "quella carta", "e se invece..."). Il CONTESTO qui sotto è già stato recuperato tenendo conto dello storico, quindi nella maggior parte dei casi contiene le fonti giuste per rispondere al riferimento — usale direttamente, non chiedere all'utente di specificare a quale elemento si riferisce se il contesto lo rende chiaro.
- Chiedi un chiarimento SOLO se, anche guardando storico e contesto insieme, il riferimento resta davvero ambiguo tra più elementi realmente distinti presenti nel contesto.
- Lo storico NON è una fonte di fatti: se contiene un'affermazione, ripetila solo se è anche confermata dal CONTESTO qui sotto.
- Questo è un turno di conversazione, non un report isolato: rispondi in modo diretto e naturale, come proseguimento del discorso — non serve riaprire ogni volta l'intera cornice esplicativa (definizioni, disclaimer generali) se il turno precedente l'ha già data; vai dritto alla risposta alla domanda di follow-up.
- NON RIPETERE informazioni, spiegazioni o fonti già date in un turno precedente dello STORICO se il nuovo turno le dà già per acquisite: se l'utente chiede una conferma/precisazione dopo che hai già spiegato la regola generale, rispondi SOLO alla parte nuova della domanda, trattando quanto già detto come noto — non riscrivere da capo la spiegazione già data né ricitare le stesse fonti già citate per lo stesso fatto in un turno precedente, a meno che il nuovo turno non richieda esplicitamente di tornare su quel punto. Una risposta di follow-up genuina è quasi sempre più corta della risposta precedente, non una sua riformulazione estesa.
- Cita una fonte SOLO per un'affermazione nuova in questo turno (non ancora fatta nello storico). Se stai solo confermando qualcosa già detto e già citato, puoi farlo con una frase breve senza ripetere la citazione completa.

${history}CONTESTO:
${context}

DOMANDA:
${query}

RISPOSTA (in italiano, in Markdown, diretta e naturale come prosecuzione della conversazione, citando le fonti secondo le regole sopra):`;
}

// --- Costruzione contesto (condivisa da entrambe le modalità) -------------

export function buildContext(
    chunks: Array<{ content: string; sourceLabel: string; url?: string | null }>,
): string {
    return chunks
        .map((chunk, i) => {
            const urlLine = chunk.url ? `\n[URL fonte principale: ${chunk.url}]` : '';
            return `[Fonte ${i + 1} — ${chunk.sourceLabel}]${urlLine}\n${chunk.content}`;
        })
        .join('\n\n---\n\n');
}