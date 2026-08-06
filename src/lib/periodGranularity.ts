export type Granularity = 'year' | 'semester' | 'bimester';

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  year: 'Anual',
  semester: 'Semestral',
  bimester: 'Bimestral',
};

interface ParsedPeriod {
  year: string;
  semester: 1 | 2 | null;
}

/**
 * O período de uma atividade/nota é texto livre digitado pelo usuário (ex.: "2026-B1", "2026-S2",
 * "2026-03", só "2026") — não existe um formato único imposto no cadastro. Para montar os gráficos
 * anual/semestral, extraímos o ano sempre que possível e o semestre quando o período segue a
 * convenção de bimestre (B1-B4) ou semestre (S1/S2) já usada no restante do app; quando não dá para
 * identificar o semestre com confiança, o período fica de fora do gráfico semestral em vez de
 * arriscar agrupar errado.
 */
function parsePeriod(period: string): ParsedPeriod {
  const yearMatch = period.match(/(20\d{2})/);
  const year = yearMatch ? yearMatch[1] : period;
  const sMatch = period.match(/S(\d)/i);
  const bMatch = period.match(/B(\d)/i);
  let semester: 1 | 2 | null = null;
  if (sMatch) semester = Number(sMatch[1]) <= 1 ? 1 : 2;
  else if (bMatch) semester = Number(bMatch[1]) <= 2 ? 1 : 2;
  return { year, semester };
}

/** Retorna null quando o período não pode ser agrupado com confiança nessa granularidade (ex.:
 *  semestre não identificável) — o chamador deve descartar a linha em vez de adivinhar. */
export function periodLabelForGranularity(period: string, granularity: Granularity): string | null {
  const { year, semester } = parsePeriod(period);
  if (granularity === 'year') return year;
  if (granularity === 'semester') return semester ? `${year}-S${semester}` : null;
  return period;
}

export function evolutionByGranularity<T>(
  rows: T[],
  granularity: Granularity,
  getPeriod: (row: T) => string,
  getValue: (row: T) => number | null,
): { period: string; avg: number; count: number }[] {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const value = getValue(row);
    if (value === null) continue;
    const key = periodLabelForGranularity(getPeriod(row), granularity);
    if (key === null) continue;
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, values]) => ({ period, avg: values.reduce((s, v) => s + v, 0) / values.length, count: values.length }));
}
