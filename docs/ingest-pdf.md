# Procedura di ingest di un manuale PDF

Guida passo-passo per aggiungere un nuovo gioco a BGT: dalla creazione del
record in Supabase fino ai chunk salvati e pronti per il retrieval.

Prerequisiti: `.venv` Python attivo, `.env` (symlink a `.env.local`)
configurato, dipendenze npm installate.

---

## 0. Crea il record del gioco in Supabase

Dal SQL Editor di Supabase (o via script):

```sql
insert into games (name, visibility, manual_ready, forum_ready)
values ('Nome Gioco', 'private', false, false)
returning id;
```

- `visibility = 'private'` è il default (D16): il gioco è visibile solo a
  chi ha lo stesso `owner_token` nel browser. Per un test rapido senza
  gestire il token, usa `'shared'`.
- `bgg_id` può essere lasciato vuoto per ora (verrà popolato quando sarà
  implementato S3.3 — ricerca su BGG).
- Copia l'`id` (uuid) restituito: serve in tutti gli step successivi.

---

## 1. Il manuale è fotografato o è già un PDF testuale?

**Verifica prima di procedere**, perché cambia il flusso:

```bash
python3 -c "
import pdfplumber
with pdfplumber.open('manuals/nome-gioco.pdf') as pdf:
    p = pdf.pages[0]
    print('parole trovate:', len(p.extract_words()))
    print('immagini nella pagina:', len(p.images))
"
```

- `parole trovate: 0` e presenza di immagini → **PDF scansionato/fotografato**, serve OCR (step 1a).
- `parole trovate` > 0 → PDF con testo nativo, salta allo step 2.

### 1a. OCR (solo se il manuale è fotografato)

`extract-pdf.py` legge solo testo nativo (via `pdfplumber`), non fa OCR.
Se il PDF è composto da foto delle pagine, va prima passato per
`ocrmypdf`, che aggiunge un layer di testo invisibile sopra le immagini
mantenendo l'impaginazione (necessario per il rilevamento colonne/spread
di `extract-pdf.py`).

**Installazione (una tantum, macOS/Homebrew):**

```bash
brew install tesseract        # motore OCR
brew install tesseract-lang   # pacchetti lingua aggiuntivi (es. italiano)
```

Verifica che la lingua che ti serve sia disponibile:

```bash
tesseract --list-langs
```

**Esecuzione OCR:**

```bash
ocrmypdf -l ita --force-ocr manuals/nome-gioco.pdf manuals/nome-gioco-ocr.pdf
```

- `-l ita`: fondamentale se il manuale è in italiano — senza, tesseract
  usa l'inglese come default e produce molti più errori di riconoscimento
  (es. `è` → `@`, `Il` → `|`, apostrofi non riconosciuti). Usa il codice
  lingua corretto se il manuale è in un'altra lingua (`eng`, `fra`, ecc.),
  o più lingue separate da `+` (es. `-l ita+eng`).
- `--force-ocr`: riscrive il layer OCR anche se il PDF ne ha già uno
  (utile se stai rifacendo l'OCR con la lingua giusta dopo un primo
  tentativo sbagliato).
- Opzionale, se le foto sono storte o con luce irregolare:
  `--deskew --clean`.

Da qui in avanti, usa `manuals/nome-gioco-ocr.pdf` come input dello step 2
al posto del PDF originale.

**Nota:** anche con OCR corretto restano piccoli artefatti (es. icone o
simboli grafici del gioco interpretati come lettere/numeri a caso). È
normale — vengono in gran parte filtrati nello step 3 (pulizia Gemini) e
non compromettono l'embedding semantico.

---

## 2. Estrazione PDF → JSON

```bash
python scripts/extract-pdf.py manuals/nome-gioco.pdf manuals/nome-gioco.json
```

(Argomenti posizionali, non flag: `<pdf_path> <output_json>`.)

Lo script rileva automaticamente pagine "spread" a doppia pagina fisica
(D19/D20) e colonne multiple, e stampa a fine esecuzione il numero di
pagine logiche estratte.

**Controlli prima di proseguire:**
- Il conteggio di pagine logiche dovrebbe essere vicino al numero di
  pagine fisiche del manuale (non ~2x o ~0.5x — se lo è, l'euristica di
  rilevamento spread ha probabilmente sbagliato su questo PDF).
- Apri il JSON e controlla visivamente 2-3 pagine campione, specialmente
  se il manuale ha layout a colonne o box laterali.

---

## 3. Trasformazione JSON → Markdown (pulizia strutturale via Gemini)

```bash
npx ts-node --project scripts/tsconfig.json scripts/markdown-from-json.ts \
  --json manuals/nome-gioco.json \
  --out manuals/nome-gioco.md
```

Processo in due fasi (D19): prima identifica i confini di sezione
sull'intero documento, poi genera il markdown sezione per sezione, con
istruzione esplicita di non riassumere/interpretare il contenuto delle
regole.

**Se colpisci un rate limit Gemini** durante questo step, nel file
`scripts/markdown-from-json.ts` aumenta la pausa tra le chiamate di Fase 2:

```ts
// pausa per evitare rate limit Gemini
await new Promise((res) => setTimeout(res, 5000)); // invece di 300
```

**Controlli prima di proseguire (obbligatori, D19):**
- Leggi l'output console: rapporto parole markdown/parole grezzo (un
  valore sotto il 50% viene segnalato in automatico, ma va comunque
  verificato — può essere normale rimozione di rumore/crediti, o un
  segnale di contenuto perso).
- Leggi i warning di deduplicazione sezioni (outline sovrapposti o
  contenuto quasi identico) — la deduplicazione automatica non è
  infallibile, controlla i falsi positivi/negativi.
- **Revisiona `nome-gioco.md` a mano contro il PDF originale.** Cerca in
  particolare i commenti `<!-- OCR illeggibile, verificare manualmente -->`
  e verifica che nessuna regola sia stata compressa perdendo dettagli
  (numeri, elenchi di opzioni/bonus, eccezioni).

---

## 4. Ingest: chunking + embedding + salvataggio in Supabase

```bash
npx ts-node --project scripts/tsconfig.json scripts/ingest-pdf.ts \
  --md manuals/nome-gioco.md \
  --game-id {uuid-del-gioco}
```

Ogni sezione (`## Titolo [p. N]`) diventa un chunk; le sezioni più lunghe
di 500 parole vengono sub-divise con overlap di 50 parole (D19-D20:
chunking semantico header-based, non più meccanico a pagina).

Al termine, lo script imposta `games.manual_ready = true` **anche se ci
sono stati errori** su alcuni chunk — controlla sempre il log
`saved`/`errori` stampato a fine esecuzione.

---

## 5. Verifica finale

```sql
-- conteggio chunk effettivamente salvati
select count(*) from chunks where game_id = '{uuid-del-gioco}' and source = 'manual';

-- stato del gioco
select manual_ready, visibility, owner_token from games where id = '{uuid-del-gioco}';
```

- Confronta il conteggio SQL con i "chunk totali" stampati da
  `ingest-pdf.ts` — se non coincidono, `manual_ready = true` è comunque
  stato settato: non fidarti solo del flag.
- Se `visibility = 'private'`, ricordati che per vedere il gioco in UI
  serve lo stesso `owner_token` nel cookie/localStorage del browser di
  test — altrimenti impostalo su `'shared'` per un test rapido.

Prova poi su `https://bgt-lemon.vercel.app/game/{uuid-del-gioco}` con
qualche domanda di regolamento.

---

## Riepilogo comandi

```bash
# 0. crea record games su Supabase, copia l'id

# 1. (solo se PDF fotografato) OCR
ocrmypdf -l ita --force-ocr manuals/nome-gioco.pdf manuals/nome-gioco-ocr.pdf

# 2. estrazione
python scripts/extract-pdf.py manuals/nome-gioco.pdf manuals/nome-gioco.json

# 3. markdown
npx ts-node --project scripts/tsconfig.json scripts/markdown-from-json.ts \
  --json manuals/nome-gioco.json --out manuals/nome-gioco.md
# → revisiona nome-gioco.md a mano prima di continuare

# 4. ingest
npx ts-node --project scripts/tsconfig.json scripts/ingest-pdf.ts \
  --md manuals/nome-gioco.md --game-id {uuid}

# 5. verifica su Supabase, poi test in UI
```