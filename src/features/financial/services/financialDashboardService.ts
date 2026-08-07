import type { Installment, InstallmentStatus, StudentScholarship } from '../../../domain';
import { computeInstallmentStatus, remainingAmountCents } from './financialCalculationService';
import { computeScholarshipStatus } from './scholarshipService';

export interface FinancialSummary {
  totalForecastCents: number;
  totalReceivedCents: number;
  totalPendingCents: number;
  totalOverdueCents: number;
  totalScholarshipDiscountCents: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  studentsWithActiveScholarship: number;
  scholarshipsEndingSoon: number;
  delinquencyRate: number;
  statusBreakdown: Record<InstallmentStatus, number>;
  monthlyReceived: { competence: string; receivedCents: number; forecastCents: number }[];
  discountByScholarshipType: { scholarshipTypeName: string; discountCents: number }[];
}

/**
 * Agrega os indicadores do dashboard financeiro. Recebe listas JÁ FILTRADAS pela
 * tela (aluno/turma/escola/competência/período/status/tipo de bolsa) — este serviço
 * não conhece filtros, só soma o que recebe, para poder ser testado isoladamente.
 */
export function computeFinancialSummary(
  installments: Installment[],
  scholarshipAssignments: StudentScholarship[],
  scholarshipTypeNameById: Map<string, string>,
  todayIso: string,
): FinancialSummary {
  const statusBreakdown: Record<InstallmentStatus, number> = {
    pending: 0, due_soon: 0, due_today: 0, overdue: 0, paid: 0, partially_paid: 0, cancelled: 0, exempt: 0,
  };
  const monthlyMap = new Map<string, { receivedCents: number; forecastCents: number }>();
  const discountByType = new Map<string, number>();

  let totalForecastCents = 0;
  let totalReceivedCents = 0;
  let totalPendingCents = 0;
  let totalOverdueCents = 0;
  let totalScholarshipDiscountCents = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;

  for (const installment of installments) {
    const status = computeInstallmentStatus(installment, todayIso);
    statusBreakdown[status]++;

    if (status !== 'cancelled') {
      totalForecastCents += installment.finalAmountCents;
      totalScholarshipDiscountCents += installment.scholarshipDiscountCents;
    }
    totalReceivedCents += installment.paidAmountCents;

    if (status === 'paid') paidCount++;
    if (status === 'pending' || status === 'due_soon' || status === 'due_today' || status === 'partially_paid') {
      pendingCount++;
      totalPendingCents += remainingAmountCents(installment);
    }
    if (status === 'overdue') {
      overdueCount++;
      totalOverdueCents += remainingAmountCents(installment);
    }

    const month = monthlyMap.get(installment.competence) ?? { receivedCents: 0, forecastCents: 0 };
    month.receivedCents += installment.paidAmountCents;
    if (status !== 'cancelled') month.forecastCents += installment.finalAmountCents;
    monthlyMap.set(installment.competence, month);

    if (installment.scholarshipDiscountCents > 0 && installment.appliedScholarshipAssignmentId) {
      const assignment = scholarshipAssignments.find((a) => a.id === installment.appliedScholarshipAssignmentId);
      const typeName = assignment ? (scholarshipTypeNameById.get(assignment.scholarshipTypeId) ?? 'Bolsa') : 'Bolsa';
      discountByType.set(typeName, (discountByType.get(typeName) ?? 0) + installment.scholarshipDiscountCents);
    }
  }

  const activeStudentIds = new Set(
    scholarshipAssignments
      .filter((a) => {
        const status = computeScholarshipStatus(a, todayIso);
        return status === 'active' || status === 'ending_soon';
      })
      .map((a) => a.studentId),
  );
  const scholarshipsEndingSoon = scholarshipAssignments.filter(
    (a) => computeScholarshipStatus(a, todayIso) === 'ending_soon',
  ).length;

  const billedCents = totalForecastCents;
  const delinquencyRate = billedCents > 0 ? totalOverdueCents / billedCents : 0;

  return {
    totalForecastCents,
    totalReceivedCents,
    totalPendingCents,
    totalOverdueCents,
    totalScholarshipDiscountCents,
    paidCount,
    pendingCount,
    overdueCount,
    studentsWithActiveScholarship: activeStudentIds.size,
    scholarshipsEndingSoon,
    delinquencyRate,
    statusBreakdown,
    monthlyReceived: [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([competence, v]) => ({ competence, receivedCents: v.receivedCents, forecastCents: v.forecastCents })),
    discountByScholarshipType: [...discountByType.entries()].map(([scholarshipTypeName, discountCents]) => ({
      scholarshipTypeName,
      discountCents,
    })),
  };
}
