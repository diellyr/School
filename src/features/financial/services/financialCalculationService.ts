import type { Installment, InstallmentStatus } from '../../../domain';

/**
 * Cálculos financeiros puros — sem acesso a repositório/IndexedDB, só dados em
 * memória, para poderem ser testados por fixtures (mesmo padrão de
 * `src/features/alerts/alertEngine.ts` e dos serviços de `src/features/pedagogical/`).
 * Todo valor monetário é inteiro em CENTAVOS; nenhuma conta usa ponto flutuante.
 */

/** A partir de quantos dias antes do vencimento uma parcela pendente passa a exibir
 *  "Vence em breve" — o mesmo limiar usado para o primeiro alerta de vencimento. */
export const DUE_SOON_THRESHOLD_DAYS = 7;

/** Diferença em dias inteiros entre duas datas ISO (aceita "AAAA-MM-DD" ou datetime). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso.slice(0, 10) + 'T00:00:00.000Z');
  const to = Date.parse(toIso.slice(0, 10) + 'T00:00:00.000Z');
  return Math.round((to - from) / 86_400_000);
}

/** valorDescontoBolsa = valorOriginal × percentualBolsa ÷ 100 (seção 3.4). */
export function calculateScholarshipDiscountCents(originalAmountCents: number, percentage: number): number {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  return Math.round((originalAmountCents * clamped) / 100);
}

/** valorFinal = valorOriginal - valorDescontoBolsa - outrosDescontos + acréscimos, nunca negativo. */
export function calculateFinalAmountCents(input: {
  originalAmountCents: number;
  scholarshipDiscountCents?: number;
  otherDiscountCents?: number;
  additionalAmountCents?: number;
}): number {
  const total =
    input.originalAmountCents -
    (input.scholarshipDiscountCents ?? 0) -
    (input.otherDiscountCents ?? 0) +
    (input.additionalAmountCents ?? 0);
  return Math.max(0, total);
}

export function remainingAmountCents(installment: Pick<Installment, 'finalAmountCents' | 'paidAmountCents'>): number {
  return Math.max(0, installment.finalAmountCents - installment.paidAmountCents);
}

/**
 * Status exibido de uma parcela. Estados "manuais/terminais" (paga, parcialmente paga,
 * cancelada, isenta) nunca são sobrescritos pela passagem do tempo — uma parcela paga
 * jamais aparece como atrasada. Os demais estados (pendente/vence em breve/vence
 * hoje/atrasada) são sempre recalculados a partir da data de hoje, nunca lidos "congelados"
 * do banco — por isso esta função deve ser chamada tanto ao gravar quanto ao exibir.
 */
export function computeInstallmentStatus(
  installment: Pick<Installment, 'installmentStatus' | 'dueDate' | 'finalAmountCents' | 'paidAmountCents'>,
  todayIso: string,
): InstallmentStatus {
  if (installment.installmentStatus === 'cancelled') return 'cancelled';
  if (installment.installmentStatus === 'exempt') return 'exempt';

  if (installment.paidAmountCents > 0) {
    return installment.paidAmountCents >= installment.finalAmountCents ? 'paid' : 'partially_paid';
  }

  const diffDays = daysBetween(todayIso, installment.dueDate);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due_today';
  if (diffDays <= DUE_SOON_THRESHOLD_DAYS) return 'due_soon';
  return 'pending';
}
