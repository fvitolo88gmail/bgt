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
(D19/D20), colonne multiple (rilevamento a quorum riga-per-riga, D33), e
stampa a fine esecuzione il numero di pagine logiche estratte. Ogni pagina
nel JSON include anche `physicalPage` (indice 0-based nel PDF originale),
necessario allo step 3 (vision) per estrarre le pagine fisiche corrette.

**Controlli prima di proseguire:**
- Il conteggio di pagine logiche dovrebbe essere vicino al numero di
  pagine fisiche del manuale (non ~2x o ~0.5x — se lo è, l'euristica di
  rilevamento spread ha probabilmente sbagliato su questo PDF).
- Apri il JSON e controlla visivamente 2-3 pagine campione, specialmente
  se il manuale ha layout a colonne o box laterali.

---

## 3. Ingest manuale via vision (D36) — `scripts/manual-parser/`

Sostituisce la vecchia pipeline testuale (`markdown-from-json.ts`, ancora
presente nel repo ma superata). Genera il Markdown finale leggendo
direttamente le pagine PDF reali (vision), non il testo pre-estratto —
risolve alla radice i problemi di colonne/icone che l'estrazione testuale
non può ricostruire in modo affidabile.

**3a. Generazione (Fase 1 outline testuale + Fase 2 vision per-sezione):**

```bash
npx ts-node --project scripts/tsconfig.json scripts/manual-parser/ingest-manual.ts \
  --json manuals/nome-gioco.json \
  --pdf manuals/nome-gioco.pdf \
  --out manuals/nome-gioco.md
```

Stampa in console l'elenco delle sezioni identificate (Fase 1) e un
controllo di copertura pagine (segnala esplicitamente eventuali pagine
non coperte da nessuna sezione — verificane la causa: intenzionale, es.
indice/crediti, o bug reale). Al termine mostra il rapporto parole
markdown/testo-grezzo (un valore basso può segnalare contenuto perso).

**3b. Verifica completezza (Fase 3, obbligatoria prima della revisione manuale):**

```bash
npx ts-node --project scripts/tsconfig.json scripts/manual-parser/verify-completeness.ts \
  --json manuals/nome-gioco.json \
  --md manuals/nome-gioco.md
```

Confronta l'intero testo grezzo con l'intero markdown finale e restituisce
una lista mirata di omissioni sospette (severità alta/bassa) — usala per
guidare la revisione manuale, non sostituirla. Nota: può segnalare falsi
positivi quando un'informazione è presente altrove nel documento, in una
sezione diversa da quella di riferimento incrociato nel grezzo — verifica
sempre con una ricerca testuale prima di considerarla un'omissione reale.

**3c. Correzioni mirate (se 3a/3b rivelano problemi isolati a poche sezioni):**

```bash
npx ts-node --project scripts/tsconfig.json scripts/manual-parser/regenerate-section.ts \
  --json manuals/nome-gioco.json --pdf manuals/nome-gioco.pdf \
  --title "Nome Sezione" --start N --end N > /tmp/fix.md
```

Rigenera una sola sezione senza rifare l'intera Fase 1+2 — stampa il
markdown su stdout, da incollare a mano nel punto giusto del file finale
(mantieni tu il controllo su cosa entra nel documento).

**Controlli prima di proseguire (obbligatori):**
- Copertura pagine ✅ (3a) e nessuna omissione "alta gravità" non
  investigata (3b).
- **Revisiona comunque `nome-gioco.md` a mano contro il PDF originale** —
  3b non sostituisce la revisione umana, la rende solo più mirata.
- Nota aperta (D39): sezioni con azioni marcate in modo incoerente dalla
  vision (a volte `###`, a volte `####`, a volte solo **grassetto** senza
  header) possono ancora finire nel fallback meccanico a 500 parole in
  `ingest-pdf.ts` — verifica a campione che i chunk risultanti abbiano
  titoli specifici (`Sezione — Sottosezione`), non generici `(parte N)`.

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