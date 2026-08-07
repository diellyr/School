import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../../../components/Dialog';
import { Button } from '../../../components/Button';
import { FormField, Input, Textarea } from '../../../components/form/Field';
import { formatCurrencyBRL } from '../../../lib/utils';
import { previewScholarshipChangeImpact, validateScholarshipPercentage } from '../../financial/services/scholarshipService';
import { calculateFinalAmountCents, calculateScholarshipDiscountCents } from '../../financial/services/financialCalculationService';
import type { Installment, StudentScholarship } from '../../../domain';

/**
 * Alteração/renovação de uma bolsa já concedida (seção 3.6): nunca altera parcelas
 * pagas (ficam congeladas para auditoria), sempre mostra prévia de impacto antes de
 * gravar, e só recalcula parcelas futuras/pendentes se o usuário confirmar.
 */
export function EditScholarshipDialog({
  open,
  onClose,
  assignment,
  studentInstallments,
  onSave,
  onCancelScholarship,
}: {
  open: boolean;
  onClose: () => void;
  assignment: StudentScholarship | null;
  studentInstallments: Installment[];
  onSave: (input: { percentage: number; endDate?: string; recalculate: boolean; affectedIds: string[] }) => Promise<void>;
  onCancelScholarship: (reason: string) => Promise<void>;
}) {
  const [percentageText, setPercentageText] = useState('');
  const [endDate, setEndDate] = useState('');
  const [recalculate, setRecalculate] = useState(true);
  const [mode, setMode] = useState<'edit' | 'cancel'>('edit');
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && assignment) {
      setPercentageText(String(assignment.percentage));
      setEndDate(assignment.endDate?.slice(0, 10) ?? '');
      setMode('edit');
      setCancelReason('');
      setError('');
    }
  }, [open, assignment]);

  const affectedInstallments = useMemo(() => {
    if (!assignment) return [];
    return studentInstallments.filter(
      (i) => i.appliedScholarshipAssignmentId === assignment.id && i.installmentStatus !== 'paid' && i.installmentStatus !== 'cancelled',
    );
  }, [assignment, studentInstallments]);

  const percentage = Number(percentageText.replace(',', '.'));
  const preview = useMemo(() => {
    if (!Number.isFinite(percentage)) return null;
    return previewScholarshipChangeImpact(affectedInstallments, percentage, calculateScholarshipDiscountCents, calculateFinalAmountCents);
  }, [affectedInstallments, percentage]);

  if (!assignment) return null;

  async function handleSave() {
    setError('');
    const percentageError = validateScholarshipPercentage(percentage);
    if (percentageError) { setError(percentageError); return; }
    setSubmitting(true);
    try {
      await onSave({ percentage, endDate: endDate || undefined, recalculate, affectedIds: preview?.affectedInstallmentIds ?? [] });
      onClose();
    } catch {
      setError('Não foi possível salvar as alterações.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setSubmitting(true);
    try {
      await onCancelScholarship(cancelReason);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Alterar bolsa" size="lg">
      {mode === 'edit' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Percentual (%)" htmlFor="es-pct" required>
              <Input id="es-pct" inputMode="decimal" value={percentageText} onChange={(e) => setPercentageText(e.target.value)} />
            </FormField>
            <FormField label="Nova data de término" htmlFor="es-end" hint="Deixe vazio para vigência indefinida — usado para renovar">
              <Input id="es-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={recalculate} onChange={(e) => setRecalculate(e.target.checked)} />
            Recalcular parcelas futuras e pendentes desta bolsa (parcelas já pagas nunca são alteradas)
          </label>

          {recalculate && preview && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <p className="font-medium text-slate-800 dark:text-slate-100">Prévia do impacto</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">Parcelas afetadas: {preview.affectedInstallmentIds.length}</p>
              <p className="text-slate-600 dark:text-slate-300">Valor total anterior: {formatCurrencyBRL(preview.previousTotalCents)}</p>
              <p className="text-slate-600 dark:text-slate-300">Novo valor total: {formatCurrencyBRL(preview.newTotalCents)}</p>
            </div>
          )}

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="danger" onClick={() => setMode('cancel')} type="button">Cancelar bolsa</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} type="button">Fechar</Button>
              <Button onClick={handleSave} loading={submitting} type="button">Salvar alterações</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Cancelar esta bolsa remove o desconto das próximas competências. Parcelas já pagas não são alteradas.
          </p>
          <FormField label="Motivo do cancelamento" htmlFor="es-cancel-reason">
            <Textarea id="es-cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode('edit')} type="button">Voltar</Button>
            <Button variant="danger" onClick={handleCancel} loading={submitting} type="button">Confirmar cancelamento</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
