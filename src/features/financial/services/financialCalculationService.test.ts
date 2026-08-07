import { describe, expect, it } from 'vitest';
import {
  calculateFinalAmountCents,
  calculateScholarshipDiscountCents,
  computeInstallmentStatus,
  remainingAmountCents,
} from './financialCalculationService';

const TODAY = '2026-08-15';

function installment(overrides: Partial<Parameters<typeof computeInstallmentStatus>[0]> = {}) {
  return {
    installmentStatus: 'pending' as const,
    dueDate: '2026-08-20',
    finalAmountCents: 100_000,
    paidAmountCents: 0,
    ...overrides,
  };
}

describe('financialCalculationService — cálculo (cenários 1, 8-14, 23-25)', () => {
  it('cenário 1: aluno sem bolsa — mensalidade de R$ 1.000,00 não sofre desconto', () => {
    const finalAmount = calculateFinalAmountCents({ originalAmountCents: 100_000 });
    expect(finalAmount).toBe(100_000);
  });

  it('cenário 24: bolsa de 100% zera o valor final', () => {
    const discount = calculateScholarshipDiscountCents(100_000, 100);
    expect(discount).toBe(100_000);
    const finalAmount = calculateFinalAmountCents({ originalAmountCents: 100_000, scholarshipDiscountCents: discount });
    expect(finalAmount).toBe(0);
  });

  it('cenário 25: percentual acima de 100 é sempre travado em 100 no cálculo (defesa em profundidade)', () => {
    const discount = calculateScholarshipDiscountCents(100_000, 150);
    expect(discount).toBe(100_000);
  });

  it('percentual negativo nunca gera desconto negativo (defesa em profundidade)', () => {
    const discount = calculateScholarshipDiscountCents(100_000, -20);
    expect(discount).toBe(0);
  });

  it('valor final nunca fica negativo mesmo com descontos maiores que o valor original', () => {
    const finalAmount = calculateFinalAmountCents({ originalAmountCents: 50_000, scholarshipDiscountCents: 50_000, otherDiscountCents: 20_000 });
    expect(finalAmount).toBe(0);
  });

  it('cenário 23: cálculo com centavos não sofre erro de ponto flutuante (33,33% de R$ 999,99)', () => {
    // 99999 centavos × 33.33 ÷ 100 = 33329,6667 → arredonda para 33330 (inteiro em centavos)
    const discount = calculateScholarshipDiscountCents(99_999, 33.33);
    expect(Number.isInteger(discount)).toBe(true);
    expect(discount).toBe(33_330);
    const finalAmount = calculateFinalAmountCents({ originalAmountCents: 99_999, scholarshipDiscountCents: discount });
    expect(finalAmount).toBe(99_999 - 33_330);
    expect(Number.isInteger(finalAmount)).toBe(true);
  });

  it('cenário 8: parcela paga antes do vencimento nunca aparece como atrasada', () => {
    const status = computeInstallmentStatus(
      installment({ dueDate: '2026-09-01', paidAmountCents: 100_000 }),
      TODAY,
    );
    expect(status).toBe('paid');
  });

  it('cenário 9: parcela paga no dia do vencimento fica "paga", não "vence hoje"', () => {
    const status = computeInstallmentStatus(installment({ dueDate: TODAY, paidAmountCents: 100_000 }), TODAY);
    expect(status).toBe('paid');
  });

  it('cenário 10: parcela paga após o vencimento nunca aparece como atrasada', () => {
    const status = computeInstallmentStatus(
      installment({ dueDate: '2026-07-01', paidAmountCents: 100_000 }),
      TODAY,
    );
    expect(status).toBe('paid');
  });

  it('cenário 11: pagamento parcial fica "parcialmente paga" e mostra o saldo restante', () => {
    const inst = installment({ dueDate: '2026-09-01', paidAmountCents: 40_000 });
    expect(computeInstallmentStatus(inst, TODAY)).toBe('partially_paid');
    expect(remainingAmountCents(inst)).toBe(60_000);
  });

  it('cenário 12 (desfazer pagamento): zerar paidAmountCents volta ao status calculado pela data', () => {
    const stillPending = installment({ dueDate: '2026-09-10', paidAmountCents: 0 });
    expect(computeInstallmentStatus(stillPending, TODAY)).toBe('pending');
    const nowOverdue = installment({ dueDate: '2026-08-01', paidAmountCents: 0 });
    expect(computeInstallmentStatus(nowOverdue, TODAY)).toBe('overdue');
  });

  it('cenário 13: parcela cancelada nunca muda de status, mesmo vencida ou com pagamento parcial', () => {
    const cancelled = installment({ installmentStatus: 'cancelled', dueDate: '2026-01-01', paidAmountCents: 500 });
    expect(computeInstallmentStatus(cancelled, TODAY)).toBe('cancelled');
  });

  it('cenário 14: parcela isenta nunca muda de status', () => {
    const exempt = installment({ installmentStatus: 'exempt', dueDate: '2026-01-01' });
    expect(computeInstallmentStatus(exempt, TODAY)).toBe('exempt');
  });

  it('parcela pendente com vencimento distante fica "pendente"', () => {
    expect(computeInstallmentStatus(installment({ dueDate: '2026-10-01' }), TODAY)).toBe('pending');
  });

  it('parcela vence em 3 dias fica "vence em breve"', () => {
    expect(computeInstallmentStatus(installment({ dueDate: '2026-08-18' }), TODAY)).toBe('due_soon');
  });

  it('parcela vence hoje fica "vence hoje"', () => {
    expect(computeInstallmentStatus(installment({ dueDate: TODAY }), TODAY)).toBe('due_today');
  });

  it('parcela vencida sem pagamento fica "atrasada"', () => {
    expect(computeInstallmentStatus(installment({ dueDate: '2026-08-01' }), TODAY)).toBe('overdue');
  });
});
