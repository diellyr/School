import type { BaseEntity } from './common';

/**
 * Módulo financeiro (parcelas, pagamentos e bolsas). Todo valor monetário é armazenado
 * em CENTAVOS (inteiro), nunca em ponto flutuante, para evitar erro de arredondamento —
 * a conversão para "R$ 0,00" só acontece na borda de exibição (ver `formatCurrencyBRL`
 * em `src/lib/utils.ts`).
 */

export type InstallmentStatus =
  | 'pending'
  | 'due_soon'
  | 'due_today'
  | 'overdue'
  | 'paid'
  | 'partially_paid'
  | 'cancelled'
  | 'exempt';

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  pending: 'Pendente',
  due_soon: 'Vence em breve',
  due_today: 'Vence hoje',
  overdue: 'Atrasada',
  paid: 'Paga',
  partially_paid: 'Parcialmente paga',
  cancelled: 'Cancelada',
  exempt: 'Isenta',
};

export type PaymentMethod = 'pix' | 'boleto' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'outro';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência bancária',
  outro: 'Outro',
};

/**
 * Uma parcela/mensalidade de um aluno. `installmentStatus` guarda o último status
 * conhecido no momento da escrita, mas o valor autoritativo para exibição é sempre
 * recalculado em tempo real por `computeInstallmentStatus` (ver
 * financialCalculationService.ts) — assim uma parcela nunca aparece "atrasada" só
 * porque ninguém reabriu a tela desde a virada do dia, nem "paga" deixa de ser paga.
 */
export interface Installment extends BaseEntity {
  studentId: string;
  schoolId: string;
  classId?: string;
  /** Competência no formato "AAAA-MM" (ex.: "2026-08" = agosto de 2026). */
  competence: string;
  description: string;
  /** Identifica o tipo de cobrança (ex.: "mensalidade", "material", "uniforme") — usado
   *  para detectar duplicidade (mesmo aluno + competência + tipo de cobrança). */
  chargeType: string;
  installmentNumber: number;
  totalInstallments?: number;
  originalAmountCents: number;
  scholarshipDiscountCents: number;
  otherDiscountCents: number;
  additionalAmountCents: number;
  finalAmountCents: number;
  paidAmountCents: number;
  dueDate: string;
  paymentDate?: string;
  installmentStatus: InstallmentStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  /** Referência a um documento (StoredDocument) usado como comprovante de pagamento. */
  receiptRef?: string;
  appliedScholarshipAssignmentId?: string;
  appliedScholarshipPercentage?: number;
}

export interface Payment extends BaseEntity {
  installmentId: string;
  studentId: string;
  amountCents: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
}

export interface ScholarshipType extends BaseEntity {
  name: string;
  description?: string;
  /** 0 a 100. */
  defaultPercentage: number;
  defaultDurationMonths?: number;
  validFrom: string;
  validUntil?: string;
  renewable: boolean;
  active: boolean;
  notes?: string;
}

export type ScholarshipAssignmentStatus = 'scheduled' | 'active' | 'ending_soon' | 'expired' | 'cancelled' | 'suspended';

export const SCHOLARSHIP_ASSIGNMENT_STATUS_LABELS: Record<ScholarshipAssignmentStatus, string> = {
  scheduled: 'Agendada',
  active: 'Ativa',
  ending_soon: 'Próxima do vencimento',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  suspended: 'Suspensa',
};

/**
 * Concessão de bolsa a um aluno. A regra de vigência usada em todo o sistema
 * (documentada e centralizada em `scholarshipService.competenceWithinScholarship`)
 * é: a COMPETÊNCIA da parcela (não a data de pagamento nem a data de geração) é
 * comparada ao intervalo [startDate, endDate] da bolsa — mês a mês.
 */
export interface StudentScholarship extends BaseEntity {
  studentId: string;
  scholarshipTypeId: string;
  percentage: number;
  startDate: string;
  endDate?: string;
  scholarshipStatus: ScholarshipAssignmentStatus;
  reason?: string;
  notes?: string;
  approvedBy: string;
  applyImmediately: boolean;
  applyToExistingPendingInstallments: boolean;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  /** Preenchido quando esta concessão substituiu uma bolsa ativa anterior do mesmo aluno
   *  (regra: não permitir duas bolsas percentuais ativas simultâneas — ver seção 3.7). */
  replacesAssignmentId?: string;
}
