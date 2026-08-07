import type { BaseEntity, Installment, Notification, NotificationPriority, StudentScholarship } from '../../../domain';
import { computeInstallmentStatus, daysBetween, remainingAmountCents } from './financialCalculationService';

export type NotificationDraft = Omit<Notification, keyof BaseEntity> & Partial<BaseEntity>;

const INSTALLMENT_REMINDER_DAYS = [7, 3, 1] as const;

/**
 * Decide se HOJE é um dia de disparo de alerta de vencimento para esta parcela, e
 * qual (seção 4.6): 7/3/1 dias antes, no dia, 1 dia após, e depois periodicamente
 * (a cada 7 dias) enquanto permanecer atrasada — sem nunca duplicar o mesmo evento
 * no mesmo dia (a `deduplicationKey` inclui o rótulo do evento; o dia já está
 * implícito porque a função só é chamada para o "hoje" atual).
 */
export function determineInstallmentEvent(
  installment: Pick<Installment, 'installmentStatus' | 'dueDate' | 'finalAmountCents' | 'paidAmountCents'>,
  todayIso: string,
): { eventLabel: string; priority: NotificationPriority } | null {
  const status = computeInstallmentStatus(installment, todayIso);
  if (status === 'paid' || status === 'cancelled' || status === 'exempt') return null;

  const diffDays = daysBetween(todayIso, installment.dueDate);

  if (INSTALLMENT_REMINDER_DAYS.includes(diffDays as (typeof INSTALLMENT_REMINDER_DAYS)[number])) {
    return { eventLabel: `${diffDays}_dias_antes`, priority: 'medio' };
  }
  if (diffDays === 0) return { eventLabel: 'vence_hoje', priority: 'alto' };
  if (diffDays === -1) return { eventLabel: '1_dia_apos', priority: 'urgente' };
  if (diffDays < -1) {
    const daysOverdue = -diffDays;
    if (daysOverdue % 7 === 0) return { eventLabel: `atrasada_${daysOverdue}d`, priority: 'urgente' };
  }
  return null;
}

export function buildInstallmentNotificationDraft(
  installment: Installment,
  studentName: string,
  todayIso: string,
  organizationId: string,
): NotificationDraft | null {
  const event = determineInstallmentEvent(installment, todayIso);
  if (!event) return null;

  const remaining = remainingAmountCents(installment);
  return {
    title: `Parcela de ${studentName} — ${event.eventLabel.startsWith('atrasada') ? 'atrasada' : event.eventLabel === 'vence_hoje' ? 'vence hoje' : event.eventLabel === '1_dia_apos' ? 'venceu ontem' : `vence em ${event.eventLabel.split('_')[0]} dia(s)`}`,
    description: `Competência ${installment.competence}, vencimento ${installment.dueDate.slice(0, 10)}. Saldo em aberto: ${(remaining / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    category: 'financial',
    priority: event.priority,
    studentId: installment.studentId,
    relatedEntityType: 'installment',
    relatedEntityId: installment.id,
    scheduledFor: todayIso,
    notificationStatus: 'pending',
    actionUrl: '/parcelas',
    recommendedAction: 'Registrar a baixa do pagamento ou entrar em contato com a família.',
    source: 'financial_installment_due',
    deduplicationKey: `financial:installment:${installment.id}:${event.eventLabel}`,
    organizationId,
  };
}

const SCHOLARSHIP_REMINDER_DAYS = [30, 15, 7] as const;

export function determineScholarshipEvent(
  assignment: Pick<StudentScholarship, 'scholarshipStatus' | 'endDate'>,
  todayIso: string,
): { eventLabel: string; priority: NotificationPriority } | null {
  if (!assignment.endDate) return null;
  if (assignment.scholarshipStatus === 'cancelled' || assignment.scholarshipStatus === 'suspended') return null;

  const diffDays = daysBetween(todayIso, assignment.endDate);
  if (SCHOLARSHIP_REMINDER_DAYS.includes(diffDays as (typeof SCHOLARSHIP_REMINDER_DAYS)[number])) {
    return { eventLabel: `${diffDays}_dias_antes`, priority: 'medio' };
  }
  if (diffDays === 0) return { eventLabel: 'dia_do_termino', priority: 'medio' };
  return null;
}

export function buildScholarshipNotificationDraft(
  assignment: StudentScholarship,
  studentName: string,
  scholarshipTypeName: string,
  todayIso: string,
  organizationId: string,
): NotificationDraft | null {
  const event = determineScholarshipEvent(assignment, todayIso);
  if (!event) return null;

  return {
    title: `Bolsa de ${studentName} — ${event.eventLabel === 'dia_do_termino' ? 'termina hoje' : `termina em ${event.eventLabel.split('_')[0]} dia(s)`}`,
    description: `${scholarshipTypeName} (${assignment.percentage}%) vigente até ${assignment.endDate?.slice(0, 10)}.`,
    category: 'scholarship',
    priority: event.priority,
    studentId: assignment.studentId,
    relatedEntityType: 'studentScholarship',
    relatedEntityId: assignment.id,
    scheduledFor: todayIso,
    notificationStatus: 'pending',
    actionUrl: '/bolsas',
    recommendedAction: 'Avaliar renovação da bolsa ou informar a família sobre o fim do benefício.',
    source: 'scholarship_expiry',
    deduplicationKey: `scholarship:assignment:${assignment.id}:${event.eventLabel}`,
    organizationId,
  };
}

/** Parcelas cuja competência já passou do fim da vigência da bolsa aplicada, mas que
 *  ainda carregam o desconto — indica desconto aplicado indevidamente após a
 *  expiração (seção 4.7: "Urgente"). */
export function findInstallmentsWithStaleScholarshipDiscount(
  assignment: Pick<StudentScholarship, 'id' | 'endDate'>,
  installments: Installment[],
): Installment[] {
  if (!assignment.endDate) return [];
  const endCompetence = assignment.endDate.slice(0, 7);
  return installments.filter(
    (i) =>
      i.appliedScholarshipAssignmentId === assignment.id &&
      i.competence > endCompetence &&
      i.installmentStatus !== 'cancelled' &&
      i.installmentStatus !== 'paid' &&
      i.scholarshipDiscountCents > 0,
  );
}

export function buildStaleScholarshipNotificationDraft(
  assignment: Pick<StudentScholarship, 'id' | 'endDate'>,
  installment: Installment,
  studentName: string,
  todayIso: string,
  organizationId: string,
): NotificationDraft {
  return {
    title: `Desconto de bolsa expirada aplicado a ${studentName}`,
    description: `A parcela de ${installment.competence} ainda está com desconto de bolsa que encerrou em ${assignment.endDate?.slice(0, 10)}. Revise o valor cobrado.`,
    category: 'scholarship',
    priority: 'urgente',
    studentId: installment.studentId,
    relatedEntityType: 'installment',
    relatedEntityId: installment.id,
    scheduledFor: todayIso,
    notificationStatus: 'pending',
    actionUrl: '/parcelas',
    recommendedAction: 'Recalcular a parcela sem o desconto de bolsa expirada.',
    source: 'scholarship_stale_discount',
    deduplicationKey: `scholarship:stale:${assignment.id}:${installment.id}`,
    organizationId,
  };
}
