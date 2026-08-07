import { describe, expect, it } from 'vitest';
import {
  buildInstallmentNotificationDraft,
  determineInstallmentEvent,
  determineScholarshipEvent,
  findInstallmentsWithStaleScholarshipDiscount,
} from './notificationRulesService';
import type { Installment, StudentScholarship } from '../../../domain';

const TODAY = '2026-08-15';
const BASE = { organizationId: 'org-1', createdAt: '', updatedAt: '', createdBy: 'u', updatedBy: 'u', version: 1, status: 'active' as const };

function installment(overrides: Partial<Installment> = {}): Installment {
  return {
    id: 'i1', ...BASE, studentId: 'student-1', schoolId: 'school-1', competence: '2026-08',
    description: 'Mensalidade', chargeType: 'mensalidade', installmentNumber: 1, originalAmountCents: 100_000,
    scholarshipDiscountCents: 0, otherDiscountCents: 0, additionalAmountCents: 0, finalAmountCents: 100_000,
    paidAmountCents: 0, dueDate: '2026-08-22', installmentStatus: 'pending', ...overrides,
  };
}

describe('notificationRulesService (cenários 17-20)', () => {
  it('cenário 17: gera evento "7 dias antes" quando faltam exatamente 7 dias para o vencimento', () => {
    const event = determineInstallmentEvent(installment({ dueDate: '2026-08-22' }), TODAY);
    expect(event?.eventLabel).toBe('7_dias_antes');
    expect(event?.priority).toBe('medio');
  });

  it('cenário 18: gera evento "vence hoje" com prioridade alta no dia do vencimento', () => {
    const event = determineInstallmentEvent(installment({ dueDate: TODAY }), TODAY);
    expect(event?.eventLabel).toBe('vence_hoje');
    expect(event?.priority).toBe('alto');
  });

  it('parcela atrasada gera evento urgente 1 dia após o vencimento, e depois a cada 7 dias', () => {
    expect(determineInstallmentEvent(installment({ dueDate: '2026-08-14' }), TODAY)?.eventLabel).toBe('1_dia_apos');
    expect(determineInstallmentEvent(installment({ dueDate: '2026-08-08' }), TODAY)?.eventLabel).toBe('atrasada_7d');
    // 6 dias de atraso não é múltiplo de 7 → não repete todo santo dia
    expect(determineInstallmentEvent(installment({ dueDate: '2026-08-09' }), TODAY)).toBeNull();
  });

  it('cenário 19: parcela paga nunca gera (nem mantém) evento de vencimento — o alerta se encerra', () => {
    const paid = installment({ dueDate: '2026-08-01', paidAmountCents: 100_000 });
    expect(determineInstallmentEvent(paid, TODAY)).toBeNull();
    const draft = buildInstallmentNotificationDraft(paid, 'Laura', TODAY, 'org-1');
    expect(draft).toBeNull();
  });

  it('parcela cancelada ou isenta também não gera evento de vencimento', () => {
    expect(determineInstallmentEvent(installment({ installmentStatus: 'cancelled', dueDate: TODAY }), TODAY)).toBeNull();
    expect(determineInstallmentEvent(installment({ installmentStatus: 'exempt', dueDate: TODAY }), TODAY)).toBeNull();
  });

  it('cenário 20: mesma parcela e mesmo evento sempre produz a mesma deduplicationKey (nunca duplica)', () => {
    const draftA = buildInstallmentNotificationDraft(installment({ dueDate: TODAY }), 'Laura', TODAY, 'org-1');
    const draftB = buildInstallmentNotificationDraft(installment({ dueDate: TODAY }), 'Laura', TODAY, 'org-1');
    expect(draftA?.deduplicationKey).toBe(draftB?.deduplicationKey);
    expect(draftA?.deduplicationKey).toContain('i1');
    expect(draftA?.deduplicationKey).toContain('vence_hoje');
  });

  it('gera evento de bolsa 30/15/7 dias antes e no dia do término', () => {
    const scholarship: StudentScholarship = {
      id: 'sch-1', ...BASE, studentId: 'student-1', scholarshipTypeId: 'type-1', percentage: 50,
      startDate: '2026-01-01', endDate: '2026-09-14', scholarshipStatus: 'active', approvedBy: 'admin-1',
      applyImmediately: true, applyToExistingPendingInstallments: true,
    };
    expect(determineScholarshipEvent(scholarship, TODAY)?.eventLabel).toBe('30_dias_antes');
    expect(determineScholarshipEvent({ ...scholarship, endDate: '2026-08-30' }, TODAY)?.eventLabel).toBe('15_dias_antes');
    expect(determineScholarshipEvent({ ...scholarship, endDate: '2026-08-22' }, TODAY)?.eventLabel).toBe('7_dias_antes');
    expect(determineScholarshipEvent({ ...scholarship, endDate: TODAY }, TODAY)?.eventLabel).toBe('dia_do_termino');
  });

  it('bolsa cancelada/suspensa nunca gera alerta de vencimento', () => {
    const scholarship: StudentScholarship = {
      id: 'sch-1', ...BASE, studentId: 'student-1', scholarshipTypeId: 'type-1', percentage: 50,
      startDate: '2026-01-01', endDate: TODAY, scholarshipStatus: 'cancelled', approvedBy: 'admin-1',
      applyImmediately: true, applyToExistingPendingInstallments: true,
    };
    expect(determineScholarshipEvent(scholarship, TODAY)).toBeNull();
  });

  it('detecta parcela com desconto de bolsa expirada ainda aplicado indevidamente', () => {
    const assignment = { id: 'sch-1', endDate: '2026-07-31' };
    const staleInstallment = installment({ competence: '2026-08', appliedScholarshipAssignmentId: 'sch-1', scholarshipDiscountCents: 50_000 });
    const found = findInstallmentsWithStaleScholarshipDiscount(assignment, [staleInstallment]);
    expect(found).toHaveLength(1);
  });

  it('não sinaliza como indevida uma parcela cuja competência ainda está dentro da vigência da bolsa', () => {
    const assignment = { id: 'sch-1', endDate: '2026-12-31' };
    const validInstallment = installment({ competence: '2026-08', appliedScholarshipAssignmentId: 'sch-1', scholarshipDiscountCents: 50_000 });
    expect(findInstallmentsWithStaleScholarshipDiscount(assignment, [validInstallment])).toHaveLength(0);
  });
});
