import { describe, expect, it } from 'vitest';
import type { Installment, StudentScholarship } from '../../../domain';
import { findDuplicateInstallments, generateInstallmentsPreview } from './installmentGeneratorService';

const BASE = { organizationId: 'org-1', createdAt: '', updatedAt: '', createdBy: 'u', updatedBy: 'u', version: 1, status: 'active' as const };

function scholarship(overrides: Partial<StudentScholarship> = {}): StudentScholarship {
  return {
    id: 'sch-1', ...BASE, studentId: 'student-1', scholarshipTypeId: 'type-1', percentage: 50,
    startDate: '2026-08-01', endDate: '2026-12-31', scholarshipStatus: 'active', approvedBy: 'admin-1',
    applyImmediately: true, applyToExistingPendingInstallments: true, ...overrides,
  };
}

describe('installmentGeneratorService', () => {
  it('gera uma parcela por mês no intervalo, numeradas em sequência', () => {
    const drafts = generateInstallmentsPreview({
      studentId: 'student-1', schoolId: 'school-1', description: 'Mensalidade', chargeType: 'mensalidade',
      baseAmountCents: 100_000, dueDay: 10, startDate: '2026-08-01', endDate: '2026-10-31', scholarshipAssignments: [],
    });
    expect(drafts.map((d) => d.competence)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(drafts.map((d) => d.installmentNumber)).toEqual([1, 2, 3]);
    expect(drafts.every((d) => d.totalInstallments === 3)).toBe(true);
    expect(drafts.every((d) => d.finalAmountCents === 100_000)).toBe(true);
  });

  it('ajusta o dia de vencimento quando o mês é mais curto (ex.: dia 31 em fevereiro)', () => {
    const drafts = generateInstallmentsPreview({
      studentId: 'student-1', schoolId: 'school-1', description: 'Mensalidade', chargeType: 'mensalidade',
      baseAmountCents: 100_000, dueDay: 31, startDate: '2026-02-01', endDate: '2026-02-28', scholarshipAssignments: [],
    });
    expect(drafts[0].dueDate).toBe('2026-02-28');
  });

  it('aplica automaticamente o desconto de bolsa vigente em cada competência gerada', () => {
    const drafts = generateInstallmentsPreview({
      studentId: 'student-1', schoolId: 'school-1', description: 'Mensalidade', chargeType: 'mensalidade',
      baseAmountCents: 100_000, dueDay: 10, startDate: '2026-07-01', endDate: '2027-01-31',
      scholarshipAssignments: [scholarship({ startDate: '2026-08-01', endDate: '2026-12-31', percentage: 50 })],
    });
    const byCompetence = Object.fromEntries(drafts.map((d) => [d.competence, d]));
    expect(byCompetence['2026-07'].finalAmountCents).toBe(100_000); // antes da bolsa começar
    expect(byCompetence['2026-08'].finalAmountCents).toBe(50_000); // dentro da vigência
    expect(byCompetence['2026-12'].finalAmountCents).toBe(50_000);
    expect(byCompetence['2027-01'].finalAmountCents).toBe(100_000); // depois do fim da bolsa
  });

  it('bloqueia (sinaliza) duplicidade: mesmo aluno, competência e tipo de cobrança já existente', () => {
    const drafts = generateInstallmentsPreview({
      studentId: 'student-1', schoolId: 'school-1', description: 'Mensalidade', chargeType: 'mensalidade',
      baseAmountCents: 100_000, dueDay: 10, startDate: '2026-08-01', endDate: '2026-08-31', scholarshipAssignments: [],
    });
    const existing: Installment[] = [{
      id: 'existing-1', ...BASE, studentId: 'student-1', schoolId: 'school-1', competence: '2026-08',
      description: 'Mensalidade', chargeType: 'mensalidade', installmentNumber: 1, originalAmountCents: 100_000,
      scholarshipDiscountCents: 0, otherDiscountCents: 0, additionalAmountCents: 0, finalAmountCents: 100_000,
      paidAmountCents: 0, dueDate: '2026-08-10', installmentStatus: 'pending',
    }];
    const duplicates = findDuplicateInstallments(existing, drafts);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].existing.id).toBe('existing-1');
  });

  it('não considera duplicidade uma cobrança de tipo diferente na mesma competência', () => {
    const drafts = generateInstallmentsPreview({
      studentId: 'student-1', schoolId: 'school-1', description: 'Material', chargeType: 'material',
      baseAmountCents: 20_000, dueDay: 10, startDate: '2026-08-01', endDate: '2026-08-31', scholarshipAssignments: [],
    });
    const existing: Installment[] = [{
      id: 'existing-1', ...BASE, studentId: 'student-1', schoolId: 'school-1', competence: '2026-08',
      description: 'Mensalidade', chargeType: 'mensalidade', installmentNumber: 1, originalAmountCents: 100_000,
      scholarshipDiscountCents: 0, otherDiscountCents: 0, additionalAmountCents: 0, finalAmountCents: 100_000,
      paidAmountCents: 0, dueDate: '2026-08-10', installmentStatus: 'pending',
    }];
    expect(findDuplicateInstallments(existing, drafts)).toHaveLength(0);
  });
});
