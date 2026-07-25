import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

/**
 * Estrae un sotto-insieme di pagine fisiche da un PDF e lo restituisce
 * come nuovo PDF in memoria (base64), pronto per l'input multimodale
 * di Gemini. Nessun file temporaneo su disco.
 */
export async function extractPdfPagesAsBase64(
    pdfPath: string,
    physicalPageIndices: number[],
): Promise<string> {
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const srcDoc = await PDFDocument.load(existingPdfBytes);
    const subDoc = await PDFDocument.create();

    const uniqueSortedIndices = [...new Set(physicalPageIndices)].sort((a, b) => a - b);
    const copiedPages = await subDoc.copyPages(srcDoc, uniqueSortedIndices);
    copiedPages.forEach((page) => subDoc.addPage(page));

    const bytes = await subDoc.save();
    return Buffer.from(bytes).toString('base64');
}

/**
 * Mappa un range di pagine LOGICHE (dall'outline) all'insieme di pagine
 * FISICHE corrispondenti (per il taglio del PDF), usando il JSON prodotto
 * da extract-pdf.py.
 */
export function logicalRangeToPhysicalPages(
    pages: { page: number; physicalPage: number }[],
    startPage: number,
    endPage: number,
): number[] {
    return pages
        .filter((p) => p.page >= startPage && p.page <= endPage)
        .map((p) => p.physicalPage);
}