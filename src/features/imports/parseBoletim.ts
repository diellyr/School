import { createWorker } from 'tesseract.js';
import type { Block, Word } from 'tesseract.js';
import { extractPdfLines } from './parseFile';
import { pickBestOrientation } from './imageOrientation';
import { TESSERACT_LOCAL_OPTIONS } from './tesseractAssets';
import { BNCC_FIELD_LABELS, type BnccField, type RboLevel } from '../../domain';

/**
 * Interpretador dedicado ao "Boletim por habilidades" (formato checklist BNCC): uma linha por
 * habilidade/descritor × colunas de semestre, com escola/turma/aluno identificados uma única vez
 * no cabeçalho da folha — diferente de uma planilha comum, onde cada linha tem seu próprio aluno.
 *
 * Testado contra fotos reais de boletim impresso: a extração do CABEÇALHO (escola, aluno, turma,
 * data de nascimento, ano letivo) e a detecção de quais categorias BNCC aparecem no documento são
 * razoavelmente confiáveis. A leitura individual de cada nível R/B/O por habilidade é bem menos
 * confiável — testamos célula a célula (recorte + OCR restrito a "O/B/R") e, mesmo na melhor
 * orientação, boa parte das marcações não é sequer reconhecida ou vem com posição/valor incertos
 * (fotos com inclinação/desfoque chegam a duplicar palavras lidas). Por isso `extractSkillRows`
 * tenta reconstruir a tabela (habilidade → nível por semestre) a partir da posição de cada palavra
 * na página, mas todo resultado é tratado como RASCUNHO — nunca publicado automaticamente. O
 * ImportWizard sempre exige revisão humana, linha a linha ou em lote, antes de publicar.
 */

export interface BoletimHeaderFields {
  schoolName: string;
  studentName: string;
  className: string;
  birthDate: string; // ISO aaaa-mm-dd, ou '' se não encontrado
  academicYear: string;
}

export interface BoletimCategoryFound {
  bnccField: BnccField;
  label: string;
}

/** Uma linha da tabela (uma habilidade) com o nível lido por semestre, quando encontrado. */
export interface BoletimSkillRow {
  description: string;
  semester1: RboLevel | null;
  semester2: RboLevel | null;
  /** 0–1, confiança média do(s) caractere(s) de marcação usados nesta linha — nunca do texto. */
  confidence: number;
}

export interface BoletimParseResult {
  header: BoletimHeaderFields;
  categoriesFound: BoletimCategoryFound[];
  rawText: string;
  /** 0–1. Para PDF é uma estimativa fixa (extração de texto é exata, mas não há "confiança" de OCR); para imagem vem do Tesseract. */
  confidence: number;
  rotationDeg?: 0 | 90 | 180 | 270;
  /** Melhor esforço de leitura célula a célula — sempre rascunho, nunca publicado sem revisão. */
  skillRows: BoletimSkillRow[];
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractBirthDate(text: string): string {
  // toLowerCase() (não normalize()) preserva o comprimento da string — ver comentário em
  // extractAfterLabel sobre o desalinhamento de índice que o accent-stripping causaria aqui.
  const nearIdx = text.toLowerCase().indexOf('nascimento');
  const window = nearIdx >= 0 ? text.slice(nearIdx, nearIdx + 60) : '';
  const match = window.match(/(\d{2})\/(\d{2})\/(\d{4})/) ?? text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function extractAcademicYear(text: string): string {
  const nearIdx = text.toLowerCase().indexOf('letivo');
  // Numa foto o valor pode cair numa "linha" reconstruída diferente do rótulo — janela generosa.
  // Sem "não inventar": se não achar um ano perto do rótulo, assume o ano corrente em vez de
  // arriscar pegar outro número de 4 dígitos do documento (ex.: o ano de nascimento do aluno).
  const window = nearIdx >= 0 ? text.slice(nearIdx, nearIdx + 150) : '';
  const match = window.match(/\b(20\d{2})\b/);
  return match ? match[1] : String(new Date().getFullYear());
}

const STOP_LABELS = /\n|turma|numero|número|serie|série|data de nascimento|matricula|matrícula|filiacao|filiação/i;

function extractAfterLabel(text: string, labelVariants: string[], maxLen = 60): string {
  // Só minúsculas (preserva o comprimento da string) — usar normalize() aqui é um bug real:
  // remover acentos MUDA o comprimento do texto, desalinhando o índice encontrado na versão sem
  // acento com a fatia pega do texto original (que ainda tem os acentos), pegando um trecho
  // deslocado sempre que houver alguma palavra acentuada antes do rótulo procurado.
  const lower = text.toLowerCase();
  for (const label of labelVariants) {
    const idx = lower.indexOf(label.toLowerCase());
    if (idx === -1) continue;
    const chunk = text.slice(idx + label.length, idx + label.length + maxLen);
    const cutMatch = chunk.match(STOP_LABELS);
    const cut = cutMatch?.index;
    const value = cut !== undefined && cut > 0 ? chunk.slice(0, cut) : chunk;
    const cleaned = value.replace(/^[:\s|.\-\u2013\u2014]+/, '').replace(/[:\s|.\-\u2013\u2014]+$/, '').trim();
    if (cleaned.length >= 2) return cleaned;
  }
  return '';
}

/** Nomes de escola em rótulos de OCR ruidosos: em vez de "achar a primeira linha", ancora num
 *  termo institucional conhecido — bem mais confiável do que assumir que a primeira linha do
 *  documento é sempre o cabeçalho (testado contra fotos reais: a primeira linha reconhecida às
 *  vezes é ruído do logotipo, não o nome da escola). */
const SCHOOL_KEYWORD = /(col[eé]gio|escola|centro educacional|instituto educacional|creche|e\.?m\.?e\.?i\.?|e\.?m\.?e\.?f\.?|cmei|cei)\b[^\n]*/i;

function extractSchoolName(text: string): string {
  for (const line of text.split('\n')) {
    const match = line.match(SCHOOL_KEYWORD);
    if (match) {
      const cleaned = match[0].replace(/[|:;,.\-–—]+$/, '').trim();
      if (cleaned.length >= 4) return cleaned;
    }
  }
  return '';
}

/** "Nome do aluno" quase nunca sobrevive ao OCR nesse layout (rótulo pequeno, perto da dobra da
 *  foto). Como fallback, usa "Turma" como âncora — esse rótulo aparece de forma confiável — e
 *  extrai o texto antes dele na mesma linha, que nesse tipo de formulário é o nome do aluno. */
function extractStudentNameNearTurma(text: string): string {
  const lines = text.split('\n');
  const turmaIdx = lines.findIndex((l) => /\bturma\b/i.test(l));
  if (turmaIdx === -1) return '';
  const before = lines[turmaIdx].split(/\bturma\b/i)[0];
  const cleaned = before
    .replace(/^\S{1,8}\s+/, '') // remove um primeiro fragmento curto e ruidoso, se houver
    .replace(/[|:;,.\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 4) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function detectCategories(text: string): BoletimCategoryFound[] {
  const norm = normalize(text);
  const found: BoletimCategoryFound[] = [];
  for (const [field, label] of Object.entries(BNCC_FIELD_LABELS) as [BnccField, string][]) {
    // Compara só os primeiros termos do rótulo — o OCR às vezes corta o final da linha.
    const probe = normalize(label).split(',')[0];
    if (norm.includes(probe)) found.push({ bnccField: field, label });
  }
  return found;
}

const MARK_TEXT = /^[BRO0]$/i;

function levelFromMarkText(text: string): RboLevel | null {
  const c = text.trim().toUpperCase();
  if (c === 'B') return 'B';
  if (c === 'R') return 'R';
  if (c === 'O' || c === '0') return 'O';
  return null;
}

/** Agrupa palavras em "linhas de texto" pela posição vertical (centro do bbox), independente do
 *  agrupamento de parágrafo do Tesseract — que embaralha colunas nesse tipo de tabela. */
function groupWordsIntoLines(words: Word[]): { text: string; y0: number; y1: number }[] {
  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const lines: { words: Word[]; y0: number; y1: number }[] = [];
  for (const w of sorted) {
    const center = (w.bbox.y0 + w.bbox.y1) / 2;
    const line = lines.find((l) => center >= l.y0 - 10 && center <= l.y1 + 10);
    if (line) {
      line.words.push(w);
      line.y0 = Math.min(line.y0, w.bbox.y0);
      line.y1 = Math.max(line.y1, w.bbox.y1);
    } else {
      lines.push({ words: [w], y0: w.bbox.y0, y1: w.bbox.y1 });
    }
  }
  return lines
    .sort((a, b) => a.y0 - b.y0)
    .map((l) => ({
      text: l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((w) => w.text).join(' '),
      y0: l.y0,
      y1: l.y1,
    }));
}

/**
 * Melhor esforço para reconstruir a tabela do boletim (habilidade → nível por semestre) a partir
 * da posição das palavras na página — nenhum resultado aqui é publicado sem revisão humana (ver
 * comentário no topo do arquivo). Estratégia: separa palavras da "zona de marcação" (coluna direita
 * da folha, texto curto batendo com B/R/O) do texto descritivo (resto da página), agrupa o texto em
 * linhas e depois em "linhas de tabela" (juntando quebras de linha da mesma habilidade), e associa
 * cada marcação encontrada à linha de tabela mais próxima verticalmente.
 */
function extractSkillRows(blocks: Block[]): BoletimSkillRow[] {
  const allWords = blocks.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
  if (allWords.length === 0) return [];

  const pageWidth = Math.max(...allWords.map((w) => w.bbox.x1));
  const markZoneStart = pageWidth * 0.55;

  const markWords = allWords.filter((w) => w.bbox.x0 >= markZoneStart && MARK_TEXT.test(w.text.trim()));
  const descWords = allWords.filter((w) => w.bbox.x0 < markZoneStart && w.text.trim().length > 1);
  if (markWords.length === 0 || descWords.length === 0) return [];

  // Separa as marcações em até 2 colunas (1º/2º semestre) pelo maior vão horizontal entre elas.
  const byX = [...markWords].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  let gapIdx = -1;
  let maxGap = 0;
  for (let i = 1; i < byX.length; i++) {
    const gap = byX[i].bbox.x0 - byX[i - 1].bbox.x1;
    if (gap > maxGap) { maxGap = gap; gapIdx = i; }
  }
  const semester1Marks = maxGap > 20 && gapIdx > 0 ? byX.slice(0, gapIdx) : byX;
  const semester2Marks = maxGap > 20 && gapIdx > 0 ? byX.slice(gapIdx) : [];

  const descLines = groupWordsIntoLines(descWords);
  if (descLines.length === 0) return [];
  const avgLineHeight = descLines.reduce((s, l) => s + (l.y1 - l.y0), 0) / descLines.length;

  // Junta linhas quebradas (descrição de uma habilidade que ocupa 2-3 linhas) numa única "linha de
  // tabela" — uma linha nova só começa quando o vão vertical para a anterior é grande o bastante.
  const rows: { text: string; y0: number; y1: number }[] = [];
  for (const line of descLines) {
    const prev = rows[rows.length - 1];
    if (prev && line.y0 - prev.y1 < avgLineHeight * 0.6) {
      prev.text += ' ' + line.text;
      prev.y1 = line.y1;
    } else {
      rows.push({ ...line });
    }
  }

  function nearestRowIndex(mark: Word): number {
    const markY = (mark.bbox.y0 + mark.bbox.y1) / 2;
    let best = -1;
    let bestDist = Infinity;
    rows.forEach((row, i) => {
      const dist = Math.abs((row.y0 + row.y1) / 2 - markY);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return bestDist < avgLineHeight * 2 ? best : -1;
  }

  const result: BoletimSkillRow[] = rows.map((r) => ({ description: r.text.trim(), semester1: null, semester2: null, confidence: 0 }));
  const confSum = new Array(rows.length).fill(0);
  const confCount = new Array(rows.length).fill(0);

  for (const [marks, key] of [[semester1Marks, 'semester1'], [semester2Marks, 'semester2']] as const) {
    for (const mark of marks) {
      const level = levelFromMarkText(mark.text);
      if (!level) continue;
      const idx = nearestRowIndex(mark);
      if (idx === -1) continue;
      result[idx][key] = level;
      confSum[idx] += mark.confidence;
      confCount[idx]++;
    }
  }

  return result
    .map((r, i) => ({ ...r, confidence: confCount[i] > 0 ? confSum[i] / confCount[i] / 100 : 0 }))
    .filter((r) => r.semester1 !== null || r.semester2 !== null);
}

function buildHeaderFields(rawText: string): BoletimHeaderFields {
  // "Turma" como âncora primeiro: testado contra fotos reais, dá resultado melhor que buscar
  // pelo rótulo "Nome do aluno" — esse rótulo é pequeno na folha e mesmo quando o OCR o reconhece
  // corretamente, o texto logo depois dele já pode vir de outra célula da tabela (a ordem de
  // leitura do Tesseract nem sempre acompanha o layout visual de um formulário rotacionado).
  const studentName =
    extractStudentNameNearTurma(rawText) ||
    extractAfterLabel(rawText, ['Nome do aluno', 'Nome do(a) aluno(a)', 'Nome da crianca', 'Nome da criança']);
  return {
    schoolName: extractSchoolName(rawText),
    studentName,
    className: extractAfterLabel(rawText, ['Turma'], 20),
    birthDate: extractBirthDate(rawText),
    academicYear: extractAcademicYear(rawText),
  };
}

export async function parseBoletimChecklist(file: File, onProgress?: (progress: number) => void): Promise<BoletimParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    const lines = await extractPdfLines(file);
    if (lines.length === 0) throw new Error('Nenhum texto encontrado neste PDF. Se for um documento escaneado, use uma foto (JPEG/PNG) em vez do PDF.');
    const rawText = lines.join('\n');
    // PDF: texto extraído diretamente, sem posição de cada palavra na página — reconstruir a
    // tabela exigiria a mesma lógica geométrica usada para imagem, que aqui não temos como aplicar.
    return { header: buildHeaderFields(rawText), categoriesFound: detectCategories(rawText), rawText, confidence: 0.85, skillRows: [] };
  }

  if (name.endsWith('.jpeg') || name.endsWith('.jpg') || name.endsWith('.png')) {
    // Reporta progresso desde o início (não só na etapa final de reconhecimento) — carregar o
    // motor de OCR e testar as 4 rotações da imagem também demora, e sem retorno visual nesse
    // trecho o app parece travado numa foto grande ou num celular mais lento.
    onProgress?.(0);
    let reportProgress = false;
    const worker = await createWorker('por', undefined, {
      ...TESSERACT_LOCAL_OPTIONS,
      logger: (m) => {
        if (reportProgress && m.status === 'recognizing text' && onProgress) onProgress(0.5 + 0.5 * m.progress);
      },
    });
    try {
      const { blob, rotationDeg } = await pickBestOrientation(worker, file, (fraction) => onProgress?.(0.5 * fraction));
      reportProgress = true;
      const { data } = await worker.recognize(blob, {}, { blocks: true, text: true });
      const rawText = data.text;
      if (!rawText.trim()) throw new Error('Não foi possível reconhecer texto nesta imagem.');
      return {
        header: buildHeaderFields(rawText),
        categoriesFound: detectCategories(rawText),
        rawText,
        confidence: data.confidence / 100,
        rotationDeg,
        skillRows: extractSkillRows(data.blocks ?? []),
      };
    } finally {
      await worker.terminate();
    }
  }

  throw new Error('Formato não suportado para boletim por habilidades — use PDF, JPEG ou PNG.');
}
