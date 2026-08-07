import { useEffect, useState } from 'react';
import { Dialog } from '../../../components/Dialog';
import { Button } from '../../../components/Button';
import { FormField, Input, Select, Textarea } from '../../../components/form/Field';
import { validateScholarshipPercentage } from '../../financial/services/scholarshipService';
import type { ScholarshipType } from '../../../domain';

export interface ScholarshipTypeFormValues {
  name: string; description: string; defaultPercentage: number; defaultDurationMonths?: number;
  validFrom: string; validUntil?: string; renewable: boolean; active: boolean; notes: string;
}

export function ScholarshipTypeDialog({
  open,
  onClose,
  editing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: ScholarshipType | null;
  onSave: (values: ScholarshipTypeFormValues) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [percentageText, setPercentageText] = useState('');
  const [durationText, setDurationText] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [renewable, setRenewable] = useState(true);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '');
      setDescription(editing?.description ?? '');
      setPercentageText(editing ? String(editing.defaultPercentage) : '');
      setDurationText(editing?.defaultDurationMonths ? String(editing.defaultDurationMonths) : '');
      setValidFrom(editing?.validFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
      setValidUntil(editing?.validUntil?.slice(0, 10) ?? '');
      setRenewable(editing?.renewable ?? true);
      setActive(editing?.active ?? true);
      setNotes(editing?.notes ?? '');
      setError('');
    }
  }, [open, editing]);

  async function handleSubmit() {
    setError('');
    if (!name.trim()) { setError('Informe o nome da bolsa.'); return; }
    const percentage = Number(percentageText.replace(',', '.'));
    const percentageError = validateScholarshipPercentage(percentage);
    if (percentageError) { setError(percentageError); return; }
    if (!validFrom) { setError('Informe a data de início de validade.'); return; }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(), description: description.trim(), defaultPercentage: percentage,
        defaultDurationMonths: durationText ? Number(durationText) : undefined,
        validFrom, validUntil: validUntil || undefined, renewable, active, notes: notes.trim(),
      });
      onClose();
    } catch {
      setError('Não foi possível salvar o tipo de bolsa.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar tipo de bolsa' : 'Novo tipo de bolsa'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Nome" htmlFor="st-name" required>
            <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Bolsa Integral" />
          </FormField>
          <FormField label="Percentual de desconto (%)" htmlFor="st-pct" required hint="Entre 0 e 100">
            <Input id="st-pct" inputMode="decimal" value={percentageText} onChange={(e) => setPercentageText(e.target.value)} placeholder="Ex.: 50" />
          </FormField>
          <FormField label="Início de validade" htmlFor="st-from" required>
            <Input id="st-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </FormField>
          <FormField label="Término de validade" htmlFor="st-until" hint="Opcional">
            <Input id="st-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </FormField>
          <FormField label="Duração padrão (meses)" htmlFor="st-duration" hint="Opcional">
            <Input id="st-duration" type="number" min={1} value={durationText} onChange={(e) => setDurationText(e.target.value)} />
          </FormField>
          <FormField label="Status" htmlFor="st-active">
            <Select id="st-active" value={active ? 'active' : 'inactive'} onChange={(e) => setActive(e.target.value === 'active')}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </Select>
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={renewable} onChange={(e) => setRenewable(e.target.checked)} />
          Permite renovação
        </label>
        <FormField label="Descrição" htmlFor="st-desc" hint="Opcional">
          <Textarea id="st-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField label="Observações" htmlFor="st-notes" hint="Opcional">
          <Textarea id="st-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button onClick={handleSubmit} loading={submitting} type="button">Salvar</Button>
        </div>
      </div>
    </Dialog>
  );
}
