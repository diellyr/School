import type { Installment, StudentScholarship } from '../../../domain';
import { calculateFinalAmountCents, calculateScholarshipDiscountCents } from './financialCalculationService';
import { findActiveScholarshipForCompetence } from './scholarshipService';

export interface InstallmentDraft {
  studentId: string;
  schoolId: string;
  classId?: string;
  competence: string;
  description: string;
  chargeType: string;
  installmentNumber: number;
  totalInstallments: number;
  originalAmountCents: number;
  scholarshipDiscountCents: number;
  otherDiscountCents: number;
  additionalAmountCents: number;
  finalAmountCents: number;
  dueDate: string;
  appliedScholarshipAssignmentId?: string;
  appliedScholarshipPercentage?: number;
}

export interface GenerateInstallmentsInput {
  studentId: string;
  schoolId: string;
  classId?: string;
  description: string;
  chargeType: string;
  baseAmountCents: number;
  dueDay: number;
  startDate: string;
  endDate: string;
  /** Bolsas do aluno já cadastradas — usadas para aplicar desconto automaticamente
   *  a cada competência gerada (seção 2.4: "verificar automaticamente se existe
   *  alguma bolsa ativa para o aluno durante cada competência"). */
  scholarshipAssignments: StudentScholarship[];
}

function addMonths(dateIso: string, months: number): Date {
  const d = new Date(dateIso.slice(0, 10) + 'T00:00:00.000Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function competenceOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Monta a prévia de geração em lote de parcelas — mês a mês entre `startDate` e
 *  `endDate`, aplicando automaticamente o desconto de bolsa vigente em cada
 *  competência. Não persiste nada; a tela mostra a prévia e só grava após confirmação. */
export function generateInstallmentsPreview(input: GenerateInstallmentsInput): InstallmentDraft[] {
  const start = new Date(input.startDate.slice(0, 10) + 'T00:00:00.000Z');
  const end = new Date(input.endDate.slice(0, 10) + 'T00:00:00.000Z');
  const drafts: InstallmentDraft[] = [];

  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  let index = 1;
  const totalMonths =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;

  while (cursor <= end) {
    const competence = competenceOf(cursor);
    const daysInMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
    const dueDay = Math.min(input.dueDay, daysInMonth);
    const dueDate = `${competence}-${String(dueDay).padStart(2, '0')}`;

    const scholarship = findActiveScholarshipForCompetence(input.scholarshipAssignments, input.studentId, competence);
    const scholarshipDiscountCents = scholarship
      ? calculateScholarshipDiscountCents(input.baseAmountCents, scholarship.percentage)
      : 0;
    const finalAmountCents = calculateFinalAmountCents({
      originalAmountCents: input.baseAmountCents,
      scholarshipDiscountCents,
    });

    drafts.push({
      studentId: input.studentId,
      schoolId: input.schoolId,
      classId: input.classId,
      competence,
      description: input.description,
      chargeType: input.chargeType,
      installmentNumber: index,
      totalInstallments: totalMonths,
      originalAmountCents: input.baseAmountCents,
      scholarshipDiscountCents,
      otherDiscountCents: 0,
      additionalAmountCents: 0,
      finalAmountCents,
      dueDate,
      appliedScholarshipAssignmentId: scholarship?.id,
      appliedScholarshipPercentage: scholarship?.percentage,
    });

    cursor = addMonths(competence + '-01', 1);
    index++;
  }

  return drafts;
}

export interface DuplicateCheckResult {
  draft: InstallmentDraft;
  existing: Installment;
}

/** Identifica prévias que colidiriam com parcelas já existentes (mesmo aluno,
 *  competência e tipo de cobrança) — seção 2.4: "impedir duplicidade... salvo
 *  quando o usuário confirmar conscientemente". */
export function findDuplicateInstallments(existing: Installment[], drafts: InstallmentDraft[]): DuplicateCheckResult[] {
  const results: DuplicateCheckResult[] = [];
  for (const draft of drafts) {
    const match = existing.find(
      (i) =>
        i.studentId === draft.studentId &&
        i.competence === draft.competence &&
        i.chargeType === draft.chargeType &&
        i.installmentStatus !== 'cancelled',
    );
    if (match) results.push({ draft, existing: match });
  }
  return results;
}
