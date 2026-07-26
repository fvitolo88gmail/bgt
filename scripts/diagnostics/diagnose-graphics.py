import pdfplumber
import sys

"""
Uso: python3 scripts/diagnose-graphics.py manuals/brass.pdf 10
Verifica se la pagina ha linee/rettangoli grafici (page.lines, page.rects,
page.edges) che potrebbero delimitare i box delle sezioni, come segnale
più affidabile dei soli gap di spazio bianco.
"""


def main():
    pdf_path = sys.argv[1]
    page_number = int(sys.argv[2])

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_number - 1]

        print(f"Pagina {page_number} (indice pdfplumber, non logico) — width={page.width:.1f}\n")

        print(f"page.lines: {len(page.lines)}")
        for line in page.lines[:20]:
            print(f"  x0={line['x0']:.1f} x1={line['x1']:.1f} top={line['top']:.1f} bottom={line['bottom']:.1f}")

        print(f"\npage.rects: {len(page.rects)}")
        for rect in page.rects[:20]:
            print(f"  x0={rect['x0']:.1f} x1={rect['x1']:.1f} top={rect['top']:.1f} bottom={rect['bottom']:.1f}")

        print(f"\npage.edges: {len(page.edges)}")
        for edge in page.edges[:20]:
            print(f"  orientation={edge.get('orientation')} x0={edge['x0']:.1f} x1={edge['x1']:.1f} top={edge['top']:.1f}")

        print(f"\npage.curves: {len(page.curves)}")


if __name__ == "__main__":
    main()