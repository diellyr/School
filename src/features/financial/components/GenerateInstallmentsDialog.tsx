import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/schema';
import { Dialog } from '../../../components/Dialog';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { FormField, Input, Select } from '../../../components/form/Field';
import { formatCompetence, formatCurrencyBRL, formatDate, parseCurrencyToCents } from '../../../lib/utils';
import type { Installment, StudentScholarship } from '../../../domain';
import { generateInstallmentsPreview, findDuplicateInstallments, type InstallmentDraft } from '../services/installmentGeneratorService';

const CHARGE_TYPES = [
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'material', label: 'Material didático' },
  { value: 'uniforme', label: 'Uniforme' },
  { value: 'outro', label: 'Outro' },
];

/** Criação de parcela individual OU geração em lote (seção 2.4), com prévia
 *  obrigatória antes de gravar e bloqueio consciente de duplicidade. */
export function GenerateInstallmentsDialog({
  open,
  onClose,
  existingInstallments,
  scholarshipAssignments,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  existingInstallments: Installment[];
  scholarshipAssignments: StudentScholarship[];
  onGenerate: (drafts: InstallmentDraft[]) => Promise<void>;
}) {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [studentId, setStudentId] = useState('');
  const [description, setDescription] = useState('Mensalidade');
  const [chargeType, setChargeType] = useState('mensalidade');
  const [amountText, setAmountText] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [singleDueDate, setSingleDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preview, setPreview] = useState<InstallmentDraft[] | null>(null);
  const [confirmDuplicates, setConfirmDuplicates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const students = useLiveQuery(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const selectedStudent = students?.find((s) => s.id === studentId);

  function resetPreview() {
    setPreview(null);
    setConfirmDuplicates(false);
    setError('');
  }

  function buildPreview() {
    setError('');
    if (!studentId || !selectedStudent) {
      setError('Selecione o aluno.');
      return;
    }
    const baseAmountCents = parseCurrencyToCents(amountText);
    if (baseAmountCents <= 0) {
      setError('Informe um valor base maior que zero.');
      return;
    }
    if (mode === 'single') {
      if (!singleDueDate) {
        setError('Informe a data de vencimento.');
        return;
      }
      const drafts = generateInstallmentsPreview({
        studentId,
        schoolId: selectedStudent.schoolId,
        classId: selectedStudent.classId,
        description,
        chargeType,
        baseAmountCents,
        dueDay: Number(singleDueDate.slice(8, 10)),
        startDate: singleDueDate.slice(0, 7) + '-01',
        endDate: singleDueDate.slice(0, 7) + '-01',
        scholarshipAssignments,
      });
      setPreview(drafts.map((d) => ({ ...d, dueDate: singleDueDate, totalInstallments: 1, installmentNumber: 1 })));
    } else {
      if (!startDate || !endDate) {
        setError('Informe a data inicial e final.');
        return;
      }
      if (endDate < startDate) {
        setError('A data final não pode ser anterior à data inicial.');
        return;
      }
      const day = Number(dueDay);
      if (!day || day < 1 || day > 31) {
        setError('Informe um dia de vencimento entre 1 e 31.');
        return;
      }
      const drafts = generateInstallmentsPreview({
        studentId, schoolId: selectedStudent.schoolId, classId: selectedStudent.classId,
        description, chargeType, baseAmountCents, dueDay: day, startDate, endDate, scholarshipAssignments,
      });
      setPreview(drafts);
    }
    setConfirmDuplicates(false);
  }

  const duplicates = useMemo(() => (preview ? findDuplicateInstallments(existingInstallments, preview) : []), [preview, existingInstallments]);
  const hasDuplicates = duplicates.length > 0;

  async function handleConfirm() {
    if (!preview) return;
    if (hasDuplicates && !confirmDuplicates) {
      setError('Existem parcelas duplicadas na prévia. Marque a confirmação para gerar mesmo assim.');
      return;
    }
    setSubmitting(true);
    try {
      await onGenerate(preview);
      handleClose();
    } catch {
      setError('Não foi possível gerar as parcelas. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setStudentId(''); setAmountText(''); setSingleDueDate(''); setStartDate(''); setEndDate('');
    resetPreview();
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Nova cobrança" description="Crie uma parcela individual ou gere várias em sequência para um período." size="lg">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={mode === 'single' ? 'primary' : 'outline'} onClick={() => { setMode('single'); resetPreview(); }}>Parcela única</Button>
          <Button type="button" size="sm" variant={mode === 'batch' ? 'primary' : 'outline'} onClick={() => { setMode('batch'); resetPreview(); }}>Gerar em lote</Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Aluno" htmlFor="gi-student" required>
            <Select id="gi-student" value={studentId} onChange={(e) => { setStudentId(e.target.value); resetPreview(); }}>
              <option value="">Selecione…</option>
              {students?.map((s) => <option key={s.id} value={s.id}>{s.socialName || s.fullName}</option>)}
            </Select>
          </FormField>
          <FormField label="Tipo de cobrança" htmlFor="gi-type" required>
            <Select id="gi-type" value={chargeType} onChange={(e) => { setChargeType(e.target.value); resetPreview(); }}>
              {CHARGE_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Descrição" htmlFor="gi-desc" required>
            <Input id="gi-desc" value={description} onChange={(e) => { setDescription(e.target.value); resetPreview(); }} />
          </FormField>
          <FormField label="Valor base (R$)" htmlFor="gi-amount" required>
            <Input id="gi-amount" inputMode="decimal" placeholder="1000,00" value={amountText} onChange={(e) => { setAmountText(e.target.value); resetPreview(); }} />
          </FormField>

          {mode === 'single' ? (
            <FormField label="Vencimento" htmlFor="gi-due" required>
              <Input id="gi-due" type="date" value={singleDueDate} onChange={(e) => { setSingleDueDate(e.target.value); resetPreview(); }} />
            </FormField>
          ) : (
            <>
              <FormField label="Dia do vencimento" htmlFor="gi-dueday" required hint="1 a 31 (ajustado em meses mais curtos)">
                <Input id="gi-dueday" type="number" min={1} max={31} value={dueDay} onChange={(e) => { setDueDay(e.target.value); resetPreview(); }} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Data inicial" htmlFor="gi-start" required>
                  <Input id="gi-start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); resetPreview(); }} />
                </FormField>
                <FormField label="Data final" htmlFor="gi-end" required>
                  <Input id="gi-end" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); resetPreview(); }} />
                </FormField>
              </div>
            </>
          )}
        </div>

        <Button type="button" variant="outline" onClick={buildPreview}>Ver prévia</Button>

        {preview && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Prévia: {preview.length} parcela(s)
            </p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-3 py-2">Competência</th>
                    <th className="px-3 py-2">Vencimento</th>
                    <th className="px-3 py-2">Bolsa</th>
                    <th className="px-3 py-2">Valor final</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((d, i) => {
                    const dup = duplicates.find((x) => x.draft === d);
                    return (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-1.5">{formatCompetence(d.competence)}</td>
                        <td className="px-3 py-1.5">{formatDate(d.dueDate)}</td>
                        <td className="px-3 py-1.5">{d.appliedScholarshipPercentage ? `${d.appliedScholarshipPercentage}%` : '—'}</td>
                        <td className="px-3 py-1.5">
                          {formatCurrencyBRL(d.finalAmountCents)}
                          {dup && <Badge tone="warning" className="ml-2">duplicada</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasDuplicates && (
              <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <input type="checkbox" className="mt-0.5" checked={confirmDuplicates} onChange={(e) => setConfirmDuplicates(e.target.checked)} />
                <span>
                  {duplicates.length} parcela(s) da prévia já existem (mesmo aluno, competência e tipo de cobrança).
                  Confirmo que quero gerar mesmo assim.
                </span>
              </label>
            )}
          </div>
        )}

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose} type="button">Cancelar</Button>
          <Button onClick={handleConfirm} loading={submitting} disabled={!preview} type="button">
            Gerar {preview?.length ?? ''} parcela(s)
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
