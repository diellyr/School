import { createWorker } from 'tesseract.js';
import { extractPdfLines } from './parseFile';
import { pickBestOrientation } from './imageOrientation';
import { TESSERACT_LOCAL_OPTIONS } from './tesseractAssets';
import { BNCC_FIELD_LABELS, type BnccField } from '../../domain';

/**
 * Interpretador dedicado ao "Boletim por habilidades" (formato checklist BNCC): uma linha por
 * habilidade/descritor × colunas de semestre, com escola/turma/aluno identificados uma única vez
 * no cabeçalho da folha — diferente de uma planilha comum, onde cada linha tem seu próprio aluno.
 *
 * Testado contra fotos reais de boletim impresso: a extração do CABEÇALHO (escola, aluno, turma,
 * data de nascimento, ano letivo) e a detecção de quais categorias BNCC aparecem no documento são
 * razoavelmente confiáveis. A leitura individual de cada nível R/B/O por habilidade NÃO é —
 * testamos o reconhecimento célula a célula (recorte + OCR restrito a "O/B/R") e mesmo na melhor
 * orientação a confiança fica baixa demais para preencher avaliações de uma criança sem revisão.
 * Por isso este interpretador cadastra o que consegue ler com confiança (escola/turma/aluno, sem
 * exigir nenhum pré-cadastro) e anexa o arquivo original ao aluno para o lançamento manual das
 * avaliações em Avaliações — nunca inventa um nível R/B/O que não leu de verdade.
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

export interface BoletimParseResult {
  header: BoletimHeaderFields;
  categoriesFound: BoletimCategoryFound[];
  rawText: string;
  /** 0–1. Para PDF é uma estimativa fixa (extração de texto é exata, mas não há "confiança" de OCR); para imagem vem do Tesseract. */
  confidence: number;
  rotationDeg?: 0 | 90 | 180 | 270;
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
    return { header: buildHeaderFields(rawText), categoriesFound: detectCategories(rawText), rawText, confidence: 0.85 };
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
      const { data } = await worker.recognize(blob, {}, { text: true });
      const rawText = data.text;
      if (!rawText.trim()) throw new Error('Não foi possível reconhecer texto nesta imagem.');
      return {
        header: buildHeaderFields(rawText),
        categoriesFound: detectCategories(rawText),
        rawText,
        confidence: data.confidence / 100,
        rotationDeg,
      };
    } finally {
      await worker.terminate();
    }
  }

  throw new Error('Formato não suportado para boletim por habilidades — use PDF, JPEG ou PNG.');
}
