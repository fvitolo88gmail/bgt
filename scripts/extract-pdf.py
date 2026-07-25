import pdfplumber
import json
import re
import sys
from pathlib import Path

LINE_TOLERANCE = 3.0       # px — tolleranza verticale per raggruppare parole nella stessa riga
GAP_MIN_WIDTH = 6.0        # px — larghezza minima di una banda per essere considerata gap candidato
GAP_MAX_OCCUPANCY = 0.05   # frazione massima di righe che possono "invadere" la banda perché sia gap
BUCKET_STEP = 2.0          # risoluzione bucket in px


def clean_text(text: str) -> str:
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def group_words_into_lines(words: list[dict], tolerance: float = LINE_TOLERANCE) -> list[list[dict]]:
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: (round(w['top'] / tolerance) * tolerance, w['x0']))
    lines: list[list[dict]] = []
    current_line: list[dict] = []
    current_top = None
    for w in sorted_words:
        if current_top is None or abs(w['top'] - current_top) <= tolerance:
            current_line.append(w)
            current_top = w['top'] if current_top is None else current_top
        else:
            lines.append(current_line)
            current_line = [w]
            current_top = w['top']
    if current_line:
        lines.append(current_line)
    return lines


def cluster_columns(
        words: list[dict],
        min_x: float,
        max_x: float,
        gap_min_width: float = GAP_MIN_WIDTH,
        gap_max_occupancy: float = GAP_MAX_OCCUPANCY,
        step: float = BUCKET_STEP,
) -> list[float]:
    """
    Rileva i confini delle colonne votando riga per riga (matrice riga x
    posizione), non sull'intera altezza pagina in blocco. Una banda
    verticale è un vero gap tra colonne se resta vuota nella stragrande
    maggioranza delle righe (occupancy <= gap_max_occupancy), non
    necessariamente su TUTTE — tollera righe-eccezione (header a piena
    larghezza, giustificazione estrema di una singola riga) senza far
    collassare il rilevamento per l'intera pagina.

    Non richiede calibrazione manuale della larghezza gap per documento:
    una banda con occupancy ~0% è un segnale forte indipendentemente
    dalla larghezza esatta o dalla tipografia (a differenza di un
    confronto assoluto in px contro la spaziatura normale tra parole,
    che varia per font/documento — vedi sessione diagnostica manuale
    Hegemony: gutter reale di soli 10px, quasi indistinguibile dalla
    spaziatura normale tra parole in termini di larghezza assoluta).

    I gap che toccano i bordi del range [min_x, max_x] sono margini di
    pagina, non separatori di colonna interni — vengono scartati.
    """
    if not words:
        return [max_x]

    lines = group_words_into_lines(words)
    total_lines = len(lines)
    if total_lines == 0:
        return [max_x]

    n_buckets = int((max_x - min_x) / step) + 2
    occupied_line_count = [0] * n_buckets

    for line in lines:
        line_occupied = [False] * n_buckets
        for w in line:
            if w['x1'] < min_x or w['x0'] > max_x:
                continue
            start_bucket = max(0, int((w['x0'] - min_x) / step))
            end_bucket = min(n_buckets - 1, int((w['x1'] - min_x) / step))
            for b in range(start_bucket, end_bucket + 1):
                line_occupied[b] = True
        for b in range(n_buckets):
            if line_occupied[b]:
                occupied_line_count[b] += 1

    occupancy = [c / total_lines for c in occupied_line_count]

    gaps = []
    gap_start = None
    for i, occ in enumerate(occupancy):
        is_gap = occ <= gap_max_occupancy
        if is_gap and gap_start is None:
            gap_start = i
        elif not is_gap and gap_start is not None:
            width = (i - gap_start) * step
            if width >= gap_min_width and gap_start > 0:
                gaps.append(min_x + (gap_start + i) / 2 * step)
            gap_start = None

    if not gaps:
        return [max_x]

    return gaps + [max_x]


def assign_words_to_columns(words: list[dict], column_bounds: list[float]) -> list[list[dict]]:
    columns: list[list[dict]] = [[] for _ in column_bounds]
    for w in words:
        for i, bound in enumerate(column_bounds):
            if w['x0'] < bound:
                columns[i].append(w)
                break
        else:
            columns[-1].append(w)
    return columns


def words_to_text(words: list[dict]) -> str:
    if not words:
        return ''
    lines = group_words_into_lines(words)
    text_lines = []
    for line in lines:
        line_sorted = sorted(line, key=lambda w: w['x0'])
        text_lines.append(' '.join(w['text'] for w in line_sorted))
    return '\n'.join(text_lines)


def extract_columns_text(words: list[dict], min_x: float, max_x: float) -> str:
    """Rileva ed estrae le colonne nel range [min_x, max_x], in ordine di lettura."""
    if not words:
        return ''

    gaps = cluster_columns(words, min_x, max_x)
    bounds = sorted(set(gaps))
    if not bounds or bounds[-1] != max_x:
        bounds.append(max_x)

    columns = assign_words_to_columns(words, bounds)
    column_texts = [words_to_text(col) for col in columns if col]
    return '\n\n'.join(column_texts)


def extract_page_words(page) -> list[dict]:
    return page.extract_words(use_text_flow=False, keep_blank_chars=False)


def is_full_spread(words: list[dict], declared_width: float) -> bool:
    """
    Una pagina è considerata uno "spread completo" (doppia pagina fisica
    con coordinate assolute) se il testo si estende ben oltre la larghezza
    di pagina dichiarata. Vedi decision-log.md D19/D20.
    """
    if not words:
        return False
    max_x1 = max(w['x1'] for w in words)
    return max_x1 > declared_width * 1.3


def extract_spread_as_two_pages(words: list[dict]) -> tuple[str, str]:
    """
    Data la lista di parole di uno spread a doppia pagina (coordinate
    assolute), calcola il punto medio reale e produce il testo delle
    due metà (sinistra, destra), ciascuna con rilevamento colonne interno
    come rifinitura.
    """
    max_x1 = max(w['x1'] for w in words)
    min_x0 = min(w['x0'] for w in words)
    midpoint = max_x1 / 2

    left_words = [w for w in words if w['x0'] < midpoint]
    right_words = [w for w in words if w['x0'] >= midpoint]

    left_text = extract_columns_text(left_words, min_x0, midpoint)
    right_text = extract_columns_text(right_words, midpoint, max_x1)

    return left_text, right_text


def extract_single_page(words: list[dict], page_width: float) -> str:
    """Estrazione con rilevamento colonne per una pagina normale (non spread)."""
    return extract_columns_text(words, 0.0, page_width)


def extract_pdf(pdf_path: str) -> list[dict]:
    pages = []
    logical_page_num = 0

    with pdfplumber.open(pdf_path) as pdf:
        i = 0
        raw_pages = pdf.pages
        while i < len(raw_pages):
            page = raw_pages[i]
            words = extract_page_words(page)

            if is_full_spread(words, page.width):
                left_text, right_text = extract_spread_as_two_pages(words)

                logical_page_num += 1
                content_left = clean_text(left_text)
                if len(content_left) >= 50:
                    pages.append({"page": logical_page_num, "physicalPage": i, "content": content_left})

                logical_page_num += 1
                content_right = clean_text(right_text)
                if len(content_right) >= 50:
                    pages.append({"page": logical_page_num, "physicalPage": i, "content": content_left})

                if i + 1 < len(raw_pages):
                    next_words = extract_page_words(raw_pages[i + 1])
                    if not is_full_spread(next_words, raw_pages[i + 1].width) and abs(
                            len(next_words) - len(words)
                    ) < max(10, len(words) * 0.1):
                        i += 1  # salta la gemella

            else:
                text = extract_single_page(words, page.width)
                content = clean_text(text)
                if len(content) >= 50:
                    logical_page_num += 1
                    pages.append({"page": logical_page_num, "physicalPage": i, "content": content})

            i += 1

    return pages


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 extract-pdf.py <pdf_path> <output_json>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2]

    if not Path(pdf_path).exists():
        print(f"Errore: file non trovato: {pdf_path}")
        sys.exit(1)

    print(f"Estrazione da {pdf_path} (rilevamento colonne a quorum riga-per-riga)...")
    pages = extract_pdf(pdf_path)
    print(f"Estratte {len(pages)} pagine logiche")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=2)

    print(f"Output salvato in {output_path}")
    print("\n⚠️  Verifica il conteggio pagine: se il documento originale ha N pagine fisiche,")
    print("    il numero di pagine logiche estratte dovrebbe essere vicino a N (non 2N o N/2).")
    print("    Controlla anche visivamente 2-3 pagine campione prima di procedere.")


if __name__ == "__main__":
    main()