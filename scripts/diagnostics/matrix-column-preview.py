import importlib.util
import sys
from pathlib import Path

"""
scripts/diagnose/matrix-column-preview.py

Uso: python3 scripts/diagnose/matrix-column-preview.py ingest/hegemony/manual.pdf 16

Ispeziona il rilevamento colonne su una singola pagina, riusando
DIRETTAMENTE cluster_columns/group_words_into_lines da extract-pdf.py
(import dinamico via importlib, dato il trattino nel nome file) — nessuna
riimplementazione parallela della logica, per evitare che diverga in
silenzio da quella usata in produzione.
"""

_SCRIPT_DIR = Path(__file__).resolve().parent.parent  # scripts/diagnose/ -> scripts/
_spec = importlib.util.spec_from_file_location("extract_pdf", _SCRIPT_DIR / "extract-pdf.py")
extract_pdf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(extract_pdf)

import pdfplumber


def main():
    if len(sys.argv) < 3:
        print("Uso: python3 scripts/diagnose/matrix-column-preview.py <pdf_path> <page_number>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    page_number = int(sys.argv[2])

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_number - 1]
        words = extract_pdf.extract_page_words(page)

        lines = extract_pdf.group_words_into_lines(words)
        gaps = extract_pdf.cluster_columns(words, 0.0, page.width)

        print(f"Pagina {page_number}: {len(words)} parole, {len(lines)} righe rilevate, width={page.width:.1f}\n")
        print(f"Confini colonna rilevati (cluster_columns, incluso max_x finale): {gaps}")

        n_columns = len(gaps)
        print(f"-> {n_columns} colonna/e rilevata/e")

        columns = extract_pdf.assign_words_to_columns(words, sorted(set(gaps)))
        for i, col in enumerate(columns):
            if not col:
                continue
            text = extract_pdf.words_to_text(col)
            preview = text[:200].replace("\n", " | ")
            print(f"\n--- Colonna {i + 1} ({len(col)} parole) ---")
            print(preview + ("..." if len(text) > 200 else ""))


if __name__ == "__main__":
    main()