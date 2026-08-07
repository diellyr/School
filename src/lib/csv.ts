function toCsvValue(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Monta e baixa um CSV a partir de cabeçalho + linhas — usado pelas exportações do
 *  módulo financeiro (parcelas, pagamentos, bolsas, alertas). */
export function downloadCsv(filenamePrefix: string, header: string[], rows: (string | number)[][]): void {
  const csv = [header, ...rows].map((row) => row.map((v) => toCsvValue(String(v))).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
