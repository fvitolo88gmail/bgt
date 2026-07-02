import pdfplumber
import json
import sys
import re
from pathlib import Path


def clean_text(text: str) -> str:
    import re
    # rimuovi testo spaziato tipo "S V O L G I M E N T O" (singole lettere separate da spazio)
    text = re.sub(r'\b([A-Z]) (?=[A-Z]\b)', r'\1', text)
    # normalizza spazi multipli e newline
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_pdf(pdf_path: str) -> list[dict]:
    pages = []
    seen_contents = set()

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(layout=False)
            if not text:
                continue

            content = clean_text(text)
            if len(content) < 50:
                continue

            # deduplicazione: salta pagine con contenuto identico
            content_hash = content[:200]
            if content_hash in seen_contents:
                continue
            seen_contents.add(content_hash)

            pages.append({
                "page": page_num,
                "content": content,
            })

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

    print(f"Estrazione da {pdf_path}...")
    pages = extract_pdf(pdf_path)
    print(f"Estratte {len(pages)} pagine")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=2)

    print(f"Output salvato in {output_path}")


if __name__ == "__main__":
    main()