import pdfplumber
import sys

"""
Uso: python3 scripts/diagnose-spread-hypothesis.py manuals/brass.pdf 10
Verifica l'ipotesi: la pagina N (pari) contiene lo spread intero,
splittabile a metà larghezza reale (max_x1 / 2) in sinistra+destra,
poi sotto-clusterizzata per gap orizzontali dentro ciascuna metà.
"""


def cluster_by_gap(words, min_x, max_x, gap_threshold=15.0, step=5.0):
    if not words:
        return []
    n_buckets = int((max_x - min_x) / step) + 2
    occupied = [False] * n_buckets

    for w in words:
        start_bucket = max(0, int((w['x0'] - min_x) / step))
        end_bucket = min(n_buckets - 1, int((w['x1'] - min_x) / step))
        for b in range(start_bucket, end_bucket + 1):
            occupied[b] = True

    gaps = []
    gap_start = None
    for i, occ in enumerate(occupied):
        if not occ and gap_start is None:
            gap_start = i
        elif occ and gap_start is not None:
            gap_width = (i - gap_start) * step
            if gap_width >= gap_threshold:
                gaps.append(min_x + (gap_start + i) / 2 * step)
            gap_start = None

    return gaps


def main():
    pdf_path = sys.argv[1]
    page_number = int(sys.argv[2])

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_number - 1]
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False)

        max_x1 = max((w['x1'] for w in words), default=0)
        min_x0 = min((w['x0'] for w in words), default=0)
        midpoint = max_x1 / 2

        left_words = [w for w in words if w['x0'] < midpoint]
        right_words = [w for w in words if w['x0'] >= midpoint]

        left_gaps = cluster_by_gap(left_words, min_x0, midpoint)
        right_gaps = cluster_by_gap(right_words, midpoint, max_x1)

        print(f"Gap trovati nella metà SINISTRA (range {min_x0:.0f}-{midpoint:.0f}): {left_gaps}")
        print(f"Gap trovati nella metà DESTRA (range {midpoint:.0f}-{max_x1:.0f}): {right_gaps}")

        def to_text(ws):
            sorted_ws = sorted(ws, key=lambda w: (round(w['top'] / 3) * 3, w['x0']))
            return ' '.join(w['text'] for w in sorted_ws[:50])

        # Sotto-split sinistra usando il primo gap trovato, se esiste
        if left_gaps:
            sub_bound = left_gaps[0]
            sub_left = [w for w in left_words if w['x0'] < sub_bound]
            sub_right = [w for w in left_words if w['x0'] >= sub_bound]
            print(f"\n--- Metà sinistra, SOTTO-colonna A (x<{sub_bound:.0f}) ---")
            print(to_text(sub_left))
            print(f"\n--- Metà sinistra, SOTTO-colonna B (x>={sub_bound:.0f}) ---")
            print(to_text(sub_right))
        else:
            print("\nNessun gap interno trovato nella metà sinistra.")


if __name__ == "__main__":
    main()