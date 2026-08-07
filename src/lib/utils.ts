import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Normaliza um nome para comparação: minúsculas, sem acentos, sem pontuação/espaços — usado para
 *  decidir se dois nomes digitados (escola, turma, aluno, categoria, disciplina...) se referem à
 *  mesma coisa, mesmo com diferença de acentuação, maiúsculas ou espaçamento. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Como `normalizeForMatch`, mas preserva espaços entre palavras — usado para casar frases
 *  inteiras (ex.: título de atividade × texto de habilidade cadastrada) por sobreposição de
 *  palavras, não só por igualdade exata do bloco inteiro. */
export function normalizeSentence(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

export function calculateAge(birthDateIso: string): number {
  const birth = new Date(birthDateIso);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** Formata um valor em CENTAVOS como moeda brasileira ("R$ 1.234,56"). Valores monetários
 *  nunca devem ser armazenados/calculados em ponto flutuante — sempre em centavos (inteiro). */
export function formatCurrencyBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Converte uma string digitada pelo usuário (ex.: "1.234,56" ou "1234.56") em centavos. */
export function parseCurrencyToCents(value: string): number {
  const cleaned = value.trim().replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const reais = Number.parseFloat(normalized);
  if (Number.isNaN(reais)) return 0;
  return Math.round(reais * 100);
}

/** Converte "AAAA-MM-DD" (ou datetime ISO) para "AAAA-MM" (competência). */
export function toCompetence(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/** Formata competência "AAAA-MM" como "mês/AAAA" (ex.: "agosto de 2026"). */
const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export function formatCompetence(competence: string): string {
  const [year, month] = competence.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return competence;
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
