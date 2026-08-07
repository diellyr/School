import { useState } from 'react';
import { Dialog } from '../../../components/Dialog';
import { Button } from '../../../components/Button';
import { FormField, Input, Select, Textarea } from '../../../components/form/Field';
import { formatCompetence, formatCurrencyBRL, formatDate, parseCurrencyToCents } from '../../../lib/utils';
import type { Installment, PaymentMethod } from '../../../domain';
import { PAYMENT_METHOD_LABELS } from '../../../domain';
import { remainingAmountCents } from '../services/financialCalculationService';

/**
 * Modal de confirmação de baixa (seção 2.3): mostra aluno/competência/vencimento/valor,
 * pede data/valor pago/forma/observação, valida se o valor corresponde ao valor final
 * (senão marca como parcialmente paga e mostra o saldo) e só confirma com o usuário.
 */
export function PaymentDialog({
  open,
  onClose,
  installment,
  studentName,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  installment: Installment | null;
  studentName: string;
  onConfirm: (input: { paymentDate: string; amountCents: number; paymentMethod: PaymentMethod; notes: string; receiptRef: string }) => Promise<void>;
}) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountText, setAmountText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [notes, setNotes] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!installment) return null;

  const remaining = remainingAmountCents(installment);
  const suggested = remaining > 0 ? remaining : installment.finalAmountCents;
  const amountCents = amountText ? parseCurrencyToCents(amountText) : suggested;
  const willBePartial = amountCents > 0 && amountCents < remaining;

  async function handleConfirm() {
    setError('');
    if (amountCents <= 0) {
      setError('Informe um valor pago maior que zero.');
      return;
    }
    if (!paymentDate) {
      setError('Informe a data do pagamento.');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({ paymentDate, amountCents, paymentMethod, notes, receiptRef });
      setAmountText('');
      setNotes('');
      setReceiptRef('');
      onClose();
    } catch {
      setError('Não foi possível registrar o pagamento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Confirmar baixa de pagamento" description="Revise os dados antes de confirmar.">
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <p><span className="text-slate-500">Aluno:</span> <span className="font-medium text-slate-900 dark:text-slate-100">{studentName}</span></p>
          <p><span className="text-slate-500">Competência:</span> {formatCompetence(installment.competence)}</p>
          <p><span className="text-slate-500">Vencimento:</span> {formatDate(installment.dueDate)}</p>
          <p><span className="text-slate-500">Valor final:</span> {formatCurrencyBRL(installment.finalAmountCents)}</p>
          {installment.paidAmountCents > 0 && (
            <p><span className="text-slate-500">Já pago:</span> {formatCurrencyBRL(installment.paidAmountCents)} · Saldo: {formatCurrencyBRL(remaining)}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Data do pagamento" htmlFor="pay-date" required>
            <Input id="pay-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </FormField>
          <FormField label="Valor pago (R$)" htmlFor="pay-amount" hint={`Sugestão: ${formatCurrencyBRL(suggested)}`}>
            <Input
              id="pay-amount"
              inputMode="decimal"
              placeholder={(suggested / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </FormField>
          <FormField label="Forma de pagamento" htmlFor="pay-method" required>
            <Select id="pay-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Comprovante / referência" htmlFor="pay-receipt" hint="Opcional">
            <Input id="pay-receipt" value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} placeholder="Nº do comprovante, ID da transação…" />
          </FormField>
        </div>

        <FormField label="Observação" htmlFor="pay-notes" hint="Opcional">
          <Textarea id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>

        {willBePartial && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            O valor informado é menor que o saldo em aberto. A parcela ficará marcada como <strong>Parcialmente paga</strong>,
            com saldo restante de {formatCurrencyBRL(remaining - amountCents)}.
          </p>
        )}
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button onClick={handleConfirm} loading={submitting} type="button">Confirmar pagamento</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Confirmação reforçada para desfazer uma baixa já registrada. */
export function UndoPaymentDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm(reason);
      setReason('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Desfazer baixa de pagamento" description="Esta ação volta a parcela para o status calculado pela data e fica registrada no histórico.">
      <div className="space-y-4">
        <FormField label="Motivo" htmlFor="undo-reason" hint="Opcional, mas recomendado para auditoria">
          <Textarea id="undo-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: pagamento lançado por engano" />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="danger" onClick={handleConfirm} loading={submitting} type="button">Desfazer baixa</Button>
        </div>
      </div>
    </Dialog>
  );
}
