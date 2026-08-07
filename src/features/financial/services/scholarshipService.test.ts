import { describe, expect, it } from 'vitest';
import type { Installment, StudentScholarship } from '../../../domain';
import {
  competenceWithinScholarship,
  computeScholarshipStatus,
  findActiveScholarshipForCompetence,
  findOverlappingActiveScholarship,
  previewScholarshipChangeImpact,
  validateScholarshipPercentage,
} from './scholarshipService';
import { calculateFinalAmountCents, calculateScholarshipDiscountCents } from './financialCalculationService';

const BASE_ACTOR_FIELDS = {
  organizationId: 'org-1', createdAt: '', updatedAt: '', createdBy: 'u', updatedBy: 'u', version: 1, status: 'active' as const,
};

function scholarship(overrides: Partial<StudentScholarship> = {}): StudentScholarship {
  return {
    id: 's1',
    ...BASE_ACTOR_FIELDS,
    studentId: 'student-1',
    scholarshipTypeId: 'type-1',
    percentage: 50,
    startDate: '2026-08-01',
    endDate: '2026-12-31',
    scholarshipStatus: 'active',
    approvedBy: 'admin-1',
    applyImmediately: true,
    applyToExistingPendingInstallments: true,
    ...overrides,
  };
}

function installment(overrides: Partial<Installment> = {}): Installment {
  return {
    id: 'i1',
    ...BASE_ACTOR_FIELDS,
    studentId: 'student-1',
    schoolId: 'school-1',
    competence: '2026-08',
    description: 'Mensalidade',
    chargeType: 'mensalidade',
    installmentNumber: 1,
    originalAmountCents: 100_000,
    scholarshipDiscountCents: 0,
    otherDiscountCents: 0,
    additionalAmountCents: 0,
    finalAmountCents: 100_000,
    paidAmountCents: 0,
    dueDate: '2026-08-10',
    installmentStatus: 'pending',
    ...overrides,
  };
}

describe('scholarshipService (cenários 2-7, 15-16, 25)', () => {
  it('cenário 2: bolsa de 50% por 6 meses cobre exatamente as competências de agosto a dezembro (e não janeiro)', () => {
    const sch = scholarship({ startDate: '2026-08-01', endDate: '2026-12-31' });
    for (const month of ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12']) {
      expect(competenceWithinScholarship(month, sch.startDate, sch.endDate)).toBe(true);
    }
    expect(competenceWithinScholarship('2027-01', sch.startDate, sch.endDate)).toBe(false);
  });

  it('cenário 3: bolsa iniciando no meio do ano não cobre competências anteriores ao início', () => {
    const sch = scholarship({ startDate: '2026-08-01', endDate: undefined });
    expect(competenceWithinScholarship('2026-05', sch.startDate, sch.endDate)).toBe(false);
    expect(competenceWithinScholarship('2026-08', sch.startDate, sch.endDate)).toBe(true);
    expect(competenceWithinScholarship('2027-06', sch.startDate, sch.endDate)).toBe(true); // sem endDate = indefinida
  });

  it('cenário 4: bolsa expirando antes da última parcela — competência após o fim volta ao valor cheio', () => {
    const sch = scholarship({ startDate: '2026-01-01', endDate: '2026-06-30' });
    const assignments = [sch];
    expect(findActiveScholarshipForCompetence(assignments, 'student-1', '2026-06')).not.toBeNull();
    expect(findActiveScholarshipForCompetence(assignments, 'student-1', '2026-07')).toBeNull();
  });

  it('cenário 5: renovação — concessão nova sem lacuna não conflita com a anterior (adjacentes, não sobrepostas)', () => {
    const original = scholarship({ id: 'orig', startDate: '2026-02-01', endDate: '2026-07-31' });
    const renewal = { studentId: 'student-1', startDate: '2026-08-01', endDate: '2027-01-31' };
    const conflict = findOverlappingActiveScholarship([original], renewal.studentId, renewal.startDate, renewal.endDate);
    expect(conflict).toBeNull();

    // e cada uma continua sendo encontrada corretamente na sua própria janela
    const assignments = [original, scholarship({ id: 'renewal', startDate: renewal.startDate, endDate: renewal.endDate })];
    expect(findActiveScholarshipForCompetence(assignments, 'student-1', '2026-05')?.id).toBe('orig');
    expect(findActiveScholarshipForCompetence(assignments, 'student-1', '2026-09')?.id).toBe('renewal');
  });

  it('cenário 6: cancelamento antecipado remove a bolsa das competências futuras imediatamente', () => {
    const cancelled = scholarship({ scholarshipStatus: 'cancelled', startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(findActiveScholarshipForCompetence([cancelled], 'student-1', '2026-09')).toBeNull();
    expect(computeScholarshipStatus(cancelled, '2026-09-01')).toBe('cancelled');
  });

  it('cenário 7: tentar conceder uma segunda bolsa percentual simultânea é detectado como conflito', () => {
    const existing = scholarship({ id: 'first', startDate: '2026-01-01', endDate: '2026-12-31' });
    const conflict = findOverlappingActiveScholarship([existing], 'student-1', '2026-06-01', '2026-12-31');
    expect(conflict?.id).toBe('first');
  });

  it('bolsa suspensa/cancelada não conta como conflito para uma nova concessão', () => {
    const cancelled = scholarship({ id: 'old', scholarshipStatus: 'cancelled', startDate: '2026-01-01', endDate: '2026-12-31' });
    const conflict = findOverlappingActiveScholarship([cancelled], 'student-1', '2026-06-01', '2026-12-31');
    expect(conflict).toBeNull();
  });

  it('cenário 15: alteração de bolsa recalcula parcelas futuras/pendentes', () => {
    const pendingInstallments = [
      installment({ id: 'i-sep', competence: '2026-09', finalAmountCents: 50_000, scholarshipDiscountCents: 50_000, installmentStatus: 'pending' }),
      installment({ id: 'i-oct', competence: '2026-10', finalAmountCents: 50_000, scholarshipDiscountCents: 50_000, installmentStatus: 'pending' }),
    ];
    const preview = previewScholarshipChangeImpact(pendingInstallments, 70, calculateScholarshipDiscountCents, calculateFinalAmountCents);
    expect(preview.affectedInstallmentIds).toEqual(['i-sep', 'i-oct']);
    expect(preview.previousTotalCents).toBe(100_000);
    expect(preview.newTotalCents).toBe(60_000); // 100000 * 30% (novo valor final com 70% de desconto) cada uma
  });

  it('cenário 16: parcelas já pagas nunca entram na prévia de recálculo — ficam congeladas', () => {
    const installments = [
      installment({ id: 'i-paid', competence: '2026-08', finalAmountCents: 50_000, paidAmountCents: 50_000, installmentStatus: 'paid' }),
      installment({ id: 'i-pending', competence: '2026-09', finalAmountCents: 50_000, installmentStatus: 'pending' }),
    ];
    const preview = previewScholarshipChangeImpact(installments, 70, calculateScholarshipDiscountCents, calculateFinalAmountCents);
    expect(preview.affectedInstallmentIds).toEqual(['i-pending']);
    expect(preview.affectedInstallmentIds).not.toContain('i-paid');
  });

  it('cenário 25: percentual acima de 100% é rejeitado na validação', () => {
    expect(validateScholarshipPercentage(150)).not.toBeNull();
    expect(validateScholarshipPercentage(-5)).not.toBeNull();
    expect(validateScholarshipPercentage(100)).toBeNull();
    expect(validateScholarshipPercentage(0)).toBeNull();
  });
});
