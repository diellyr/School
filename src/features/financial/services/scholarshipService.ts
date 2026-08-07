import type { Installment, ScholarshipAssignmentStatus, StudentScholarship } from '../../../domain';
import { daysBetween } from './financialCalculationService';

/** A partir de quantos dias antes do fim da vigência uma bolsa ativa passa a exibir
 *  "Próxima do vencimento" — mesmo limiar do primeiro alerta de expiração de bolsa. */
export const SCHOLARSHIP_ENDING_SOON_THRESHOLD_DAYS = 30;

/** Valida o percentual de uma bolsa antes de salvar (seção 3.1: "não permitir
 *  percentual negativo ou superior a 100%") — usado pelo formulário, além do
 *  travamento defensivo em `calculateScholarshipDiscountCents`. */
export function validateScholarshipPercentage(percentage: number): string | null {
  if (Number.isNaN(percentage)) return 'Informe um percentual válido.';
  if (percentage < 0) return 'O percentual não pode ser negativo.';
  if (percentage > 100) return 'O percentual não pode ser maior que 100%.';
  return null;
}

function competenceKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/**
 * Regra ÚNICA e centralizada de vigência de bolsa (seção 3.5): a COMPETÊNCIA da
 * parcela (não a data de pagamento, nem a data em que a parcela foi gerada) é
 * comparada ao intervalo [startDate, endDate] da concessão, mês a mês. Uma bolsa
 * sem `endDate` é considerada vigente indefinidamente a partir de `startDate`.
 */
export function competenceWithinScholarship(competence: string, startDate: string, endDate?: string): boolean {
  const start = competenceKey(startDate);
  if (competence < start) return false;
  if (endDate && competence > competenceKey(endDate)) return false;
  return true;
}

/** Status calculado da concessão. `cancelled`/`suspended` são estados manuais que
 *  nunca são sobrescritos pela data (seção 3.3). */
export function computeScholarshipStatus(
  assignment: Pick<StudentScholarship, 'scholarshipStatus' | 'startDate' | 'endDate'>,
  todayIso: string,
): ScholarshipAssignmentStatus {
  if (assignment.scholarshipStatus === 'cancelled') return 'cancelled';
  if (assignment.scholarshipStatus === 'suspended') return 'suspended';

  const today = todayIso.slice(0, 10);
  const start = assignment.startDate.slice(0, 10);
  if (today < start) return 'scheduled';

  if (assignment.endDate) {
    const end = assignment.endDate.slice(0, 10);
    if (today > end) return 'expired';
    if (daysBetween(today, end) <= SCHOLARSHIP_ENDING_SOON_THRESHOLD_DAYS) return 'ending_soon';
  }
  return 'active';
}

/** Encontra a bolsa (se houver) válida para uma competência específica de um aluno —
 *  usada tanto na geração de parcelas quanto no recálculo. Considera apenas
 *  concessões não canceladas/suspensas cuja vigência cobre a competência. */
export function findActiveScholarshipForCompetence(
  assignments: StudentScholarship[],
  studentId: string,
  competence: string,
): StudentScholarship | null {
  const candidates = assignments.filter(
    (a) =>
      a.studentId === studentId &&
      a.scholarshipStatus !== 'cancelled' &&
      a.scholarshipStatus !== 'suspended' &&
      competenceWithinScholarship(competence, a.startDate, a.endDate),
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

/**
 * Regra padrão da seção 3.7: não permitir duas bolsas PERCENTUAIS ativas
 * simultaneamente para o mesmo aluno no mesmo período. Retorna a concessão
 * conflitante (se houver), para que a tela possa pedir confirmação de substituição.
 */
export function findOverlappingActiveScholarship(
  existingAssignments: StudentScholarship[],
  studentId: string,
  startDate: string,
  endDate: string | undefined,
  excludeAssignmentId?: string,
): StudentScholarship | null {
  const newStart = competenceKey(startDate);
  const newEnd = endDate ? competenceKey(endDate) : undefined;

  return (
    existingAssignments.find((a) => {
      if (a.id === excludeAssignmentId) return false;
      if (a.studentId !== studentId) return false;
      if (a.scholarshipStatus === 'cancelled' || a.scholarshipStatus === 'suspended') return false;
      const aStart = competenceKey(a.startDate);
      const aEnd = a.endDate ? competenceKey(a.endDate) : undefined;
      // Dois intervalos [aStart, aEnd] e [newStart, newEnd] se sobrepõem quando
      // nenhum termina antes do outro começar (open-ended = infinito para a frente).
      const aEndsBeforeNewStarts = aEnd !== undefined && aEnd < newStart;
      const newEndsBeforeAStarts = newEnd !== undefined && newEnd < aStart;
      return !aEndsBeforeNewStarts && !newEndsBeforeAStarts;
    }) ?? null
  );
}

export interface ScholarshipImpactPreview {
  affectedInstallmentIds: string[];
  previousTotalCents: number;
  newTotalCents: number;
}

/**
 * Prévia de impacto ao alterar/renovar/cancelar uma bolsa (seção 3.6): calcula, para
 * as parcelas informadas (o chamador decide se são só as futuras, só as pendentes
 * dentro do período, ou ambas — nunca as já pagas, que ficam congeladas), qual seria
 * o novo valor final se a nova concessão fosse aplicada. Não persiste nada.
 */
export function previewScholarshipChangeImpact(
  installments: Installment[],
  newPercentage: number,
  calculateDiscount: (originalAmountCents: number, percentage: number) => number,
  calculateFinal: (input: {
    originalAmountCents: number;
    scholarshipDiscountCents?: number;
    otherDiscountCents?: number;
    additionalAmountCents?: number;
  }) => number,
): ScholarshipImpactPreview {
  let previousTotalCents = 0;
  let newTotalCents = 0;
  const affectedInstallmentIds: string[] = [];

  for (const installment of installments) {
    if (installment.installmentStatus === 'paid' || installment.installmentStatus === 'cancelled') continue;
    previousTotalCents += installment.finalAmountCents;
    const newDiscount = calculateDiscount(installment.originalAmountCents, newPercentage);
    const newFinal = calculateFinal({
      originalAmountCents: installment.originalAmountCents,
      scholarshipDiscountCents: newDiscount,
      otherDiscountCents: installment.otherDiscountCents,
      additionalAmountCents: installment.additionalAmountCents,
    });
    newTotalCents += newFinal;
    affectedInstallmentIds.push(installment.id);
  }

  return { affectedInstallmentIds, previousTotalCents, newTotalCents };
}
