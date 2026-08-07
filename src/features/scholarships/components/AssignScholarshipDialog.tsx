import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/schema';
import { Dialog } from '../../../components/Dialog';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { FormField, Input, Select, Textarea } from '../../../components/form/Field';
import { formatDate } from '../../../lib/utils';
import { findOverlappingActiveScholarship, validateScholarshipPercentage } from '../../financial/services/scholarshipService';
import type { ScholarshipType, StudentScholarship } from '../../../domain';

export interface AssignScholarshipInput {
  studentId: string; scholarshipTypeId: string; percentage: number; startDate: string; endDate?: string;
  reason: string; notes: string; applyImmediately: boolean; applyToExistingPendingInstallments: boolean;
  replacesAssignmentId?: string;
}

/** Concessão de bolsa a um aluno (seção 3.2), com bloqueio de bolsa percentual
 *  simultânea (seção 3.7) — a substituição só acontece após confirmação explícita. */
export function AssignScholarshipDialog({
  open,
  onClose,
  scholarshipTypes,
  existingAssignments,
  onAssign,
}: {
  open: boolean;
  onClose: () => void;
  scholarshipTypes: ScholarshipType[];
  existingAssignments: StudentScholarship[];
  onAssign: (input: AssignScholarshipInput) => Promise<void>;
}) {
  const [studentId, setStudentId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [percentageText, setPercentageText] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [applyImmediately, setApplyImmediately] = useState(true);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const students = useLiveQuery(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const selectedType = scholarshipTypes.find((t) => t.id === typeId);

  const conflict = useMemo(() => {
    if (!studentId || !startDate) return null;
    return findOverlappingActiveScholarship(existingAssignments, studentId, startDate, endDate || undefined);
  }, [existingAssignments, studentId, startDate, endDate]);

  function applyTypeDefaults(id: string) {
    setTypeId(id);
    const type = scholarshipTypes.find((t) => t.id === id);
    if (type) {
      setPercentageText(String(type.defaultPercentage));
      if (type.defaultDurationMonths && startDate) {
        const d = new Date(startDate + 'T00:00:00.000Z');
        d.setUTCMonth(d.getUTCMonth() + type.defaultDurationMonths);
        d.setUTCDate(d.getUTCDate() - 1);
        setEndDate(d.toISOString().slice(0, 10));
      }
    }
  }

  async function handleSubmit() {
    setError('');
    if (!studentId) { setError('Selecione o aluno.'); return; }
    if (!typeId) { setError('Selecione o tipo de bolsa.'); return; }
    const percentage = Number(percentageText.replace(',', '.'));
    const percentageError = validateScholarshipPercentage(percentage);
    if (percentageError) { setError(percentageError); return; }
    if (conflict && !confirmReplace) {
      setError('Já existe uma bolsa ativa para este aluno neste período. Confirme a substituição para continuar.');
      return;
    }
    setSubmitting(true);
    try {
      await onAssign({
        studentId, scholarshipTypeId: typeId, percentage, startDate, endDate: endDate || undefined,
        reason: reason.trim(), notes: notes.trim(), applyImmediately, applyToExistingPendingInstallments: applyToExisting,
        replacesAssignmentId: conflict?.id,
      });
      handleClose();
    } catch {
      setError('Não foi possível conceder a bolsa.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setStudentId(''); setTypeId(''); setPercentageText(''); setEndDate(''); setReason(''); setNotes('');
    setConfirmReplace(false); setError('');
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Conceder bolsa" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Aluno" htmlFor="as-student" required>
            <Select id="as-student" value={studentId} onChange={(e) => { setStudentId(e.target.value); setConfirmReplace(false); }}>
              <option value="">Selecione…</option>
              {students?.map((s) => <option key={s.id} value={s.id}>{s.socialName || s.fullName}</option>)}
            </Select>
          </FormField>
          <FormField label="Tipo de bolsa" htmlFor="as-type" required>
            <Select id="as-type" value={typeId} onChange={(e) => applyTypeDefaults(e.target.value)}>
              <option value="">Selecione…</option>
              {scholarshipTypes.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.defaultPercentage}%)</option>)}
            </Select>
          </FormField>
          <FormField label="Percentual concedido (%)" htmlFor="as-pct" required>
            <Input id="as-pct" inputMode="decimal" value={percentageText} onChange={(e) => setPercentageText(e.target.value)} />
          </FormField>
          <div />
          <FormField label="Data de início" htmlFor="as-start" required>
            <Input id="as-start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setConfirmReplace(false); }} />
          </FormField>
          <FormField label="Data de término" htmlFor="as-end" hint={selectedType?.defaultDurationMonths ? 'Preenchido pela duração padrão do tipo' : 'Opcional — vazio = indefinida'}>
            <Input id="as-end" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setConfirmReplace(false); }} />
          </FormField>
        </div>

        <FormField label="Motivo" htmlFor="as-reason" hint="Opcional">
          <Textarea id="as-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <FormField label="Observações" htmlFor="as-notes" hint="Opcional">
          <Textarea id="as-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={applyImmediately} onChange={(e) => setApplyImmediately(e.target.checked)} />
            Aplicar imediatamente
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={applyToExisting} onChange={(e) => setApplyToExisting(e.target.checked)} />
            Aplicar também às parcelas pendentes já existentes dentro do período (não altera parcelas pagas)
          </label>
        </div>

        {conflict && (
          <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <input type="checkbox" className="mt-0.5" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} />
            <span>
              Já existe uma bolsa ativa para este aluno neste período
              {conflict.endDate ? ` (até ${formatDate(conflict.endDate)})` : ' (sem data de término)'}.
              Esta nova concessão vai <strong>substituir</strong> a anterior, que será cancelada. Confirmo a substituição.
              <Badge tone="warning" className="ml-2">requer confirmação</Badge>
            </span>
          </label>
        )}

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} type="button">Cancelar</Button>
          <Button onClick={handleSubmit} loading={submitting} type="button">Conceder bolsa</Button>
        </div>
      </div>
    </Dialog>
  );
}
