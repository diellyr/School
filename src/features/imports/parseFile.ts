import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line import/no-unresolved
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import { pickBestOrientation } from './imageOrientation';
import { TESSERACT_LOCAL_OPTIONS } from './tesseractAssets';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export type ImportSource = 'structured' | 'pdf' | 'ocr';

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  source: ImportSource;
  /** Confiança 0–1 por linha. Ausente para CSV/XLSX (leitura estruturada, sem incerteza de extração). */
  rowConfidences?: number[];
}

export function parseCsvFile(file: File): Promise<ParsedTable> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        resolve({ headers, rows: results.data, source: 'structured' });
      },
      error: (err: Error) => reject(err),
    });
  });
}

export async function parseXlsxFile(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    headers,
    rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))),
    source: 'structured',
  };
}

/** Divide uma linha de texto livre em "colunas" por sequências de 2+ espaços ou tabulação. */
function splitRowCells(line: string): string[] {
  return line.split(/\s{2,}|\t/).map((c) => c.trim()).filter((c) => c.length > 0);
}

function linesToTable(lines: string[], source: ImportSource, lineConfidences?: number[]): ParsedTable {
  const nonEmpty = lines.map((l, i) => ({ line: l.trim(), confidence: lineConfidences?.[i] })).filter((l) => l.line.length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [], source };

  const headerCells = splitRowCells(nonEmpty[0].line);
  const multiColumn = headerCells.length > 1;
  const headers = multiColumn ? headerCells : ['Texto'];

  const dataLines = nonEmpty.slice(1);
  const rows = dataLines.map(({ line }) => {
    if (!multiColumn) return { [headers[0]]: line };
    const cells = splitRowCells(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
  const rowConfidences = lineConfidences ? dataLines.map((l) => l.confidence ?? 0.5) : undefined;

  return { headers, rows, source, rowConfidences };
}

/**
 * Extração de texto de PDF (não-escaneado) via PDF.js. Reconstrói linhas agrupando
 * fragmentos de texto por coordenada Y e ordenando por X, depois tenta separar
 * "colunas" por espaçamento — funciona bem para PDFs gerados a partir de planilhas,
 * não para PDFs escaneados (que não têm texto real; use a importação por imagem/OCR
 * nesse caso). Confiança fixa em 0.75: o texto extraído é exato, mas a reconstrução
 * de colunas é heurística.
 */
export async function extractPdfLines(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const lines: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const byY = new Map<number, { x: number; str: string }[]>();

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3; // agrupa fragmentos próximos na mesma linha visual
      const arr = byY.get(y) ?? [];
      arr.push({ x: item.transform[4], str: item.str });
      byY.set(y, arr);
    }

    const pageLines = [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' '));
    lines.push(...pageLines);
  }
  return lines;
}

export async function parsePdfFile(file: File): Promise<ParsedTable> {
  const lines = await extractPdfLines(file);
  if (lines.length === 0) {
    throw new Error('Nenhum texto encontrado neste PDF. Se for um documento escaneado (imagem), use a importação por foto/OCR.');
  }
  return linesToTable(lines, 'pdf');
}

/**
 * OCR de imagem (JPEG/PNG) via Tesseract.js. Antes do reconhecimento, testa as 4 rotações
 * possíveis (fotos de celular nem sempre têm a orientação correta aplicada) e usa a versão de
 * maior confiança — ver `imageOrientation.ts`. A confiança por linha vem diretamente do motor de
 * reconhecimento (0–100, normalizada para 0–1 aqui) — nunca inventada. O chamador (ImportWizard)
 * exige revisão humana explícita antes de confirmar qualquer linha vinda de OCR, por mais alta
 * que seja a confiança.
 */
export async function parseImageFile(file: File, onProgress?: (progress: number) => void): Promise<ParsedTable> {
  // Reporta progresso desde o início (não só na etapa final de reconhecimento) — carregar o motor
  // de OCR e testar as 4 rotações da imagem também demora, e sem retorno visual nesse trecho o app
  // parece travado numa foto grande ou num celular mais lento.
  onProgress?.(0);
  let reportProgress = false;
  const worker = await createWorker('por', undefined, {
    ...TESSERACT_LOCAL_OPTIONS,
    logger: (m) => {
      if (reportProgress && m.status === 'recognizing text' && onProgress) onProgress(0.5 + 0.5 * m.progress);
    },
  });
  try {
    const { blob } = await pickBestOrientation(worker, file, (fraction) => onProgress?.(0.5 * fraction));
    reportProgress = true;
    const { data } = await worker.recognize(blob, {}, { blocks: true, text: true });
    const ocrLines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
    const texts = ocrLines.map((l) => l.text);
    const confidences = ocrLines.map((l) => l.confidence / 100);
    if (texts.length === 0) throw new Error('Não foi possível reconhecer texto nesta imagem.');
    return linesToTable(texts, 'ocr', confidences);
  } finally {
    await worker.terminate();
  }
}

export async function parseTabularFile(file: File, onProgress?: (progress: number) => void): Promise<ParsedTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseCsvFile(file);
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseXlsxFile(file);
  if (name.endsWith('.pdf')) return parsePdfFile(file);
  if (name.endsWith('.jpeg') || name.endsWith('.jpg') || name.endsWith('.png')) return parseImageFile(file, onProgress);
  throw new Error('Formato de arquivo não suportado para esta importação.');
}
