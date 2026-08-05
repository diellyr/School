import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList, Plus } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Input, Select } from '../../components/form/Field';
import { classSchema, type ClassFormValues } from './classSchema';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import type { AcademicYear, Class } from '../../domain';

const STAGE_LABELS = { early_childhood: 'Educação Infantil', elementary: 'Ensino Fundamental' };
const SHIFT_LABELS = { morning: 'Manhã', afternoon: 'Tarde', full_time: 'Integral', evening: 'Noite' };

export function ClassesPage() {
  const classes = useLiveQuery(() => db.classes.filter((c) => c.status === 'active').toArray(), []);
  const schools = useLiveQuery(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const canCreate = usePermission('classes', 'create');
  const canEdit = usePermission('classes', 'edit');

  const schoolName = (id: string) => schools?.find((s) => s.id === id)?.name ?? '—';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Turmas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Turmas de Educação Infantil e Ensino Fundamental.</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Nova turma
          </Button>
        )}
      </div>

      {classes === undefined && <SkeletonList />}

      {classes?.length === 0 && (
        <EmptyState icon={ClipboardList} title="Nenhuma turma cadastrada" description="Cadastre escolas antes de criar turmas." />
      )}

      {classes && classes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Escola</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Série</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{schoolName(c.schoolId)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={c.stage === 'early_childhood' ? 'purple' : 'info'}>{STAGE_LABELS[c.stage]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.grade}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{SHIFT_LABELS[c.shift]}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                        Editar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClassFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} schools={schools ?? []} />
    </div>
  );
}

function ClassFormDialog({
  open,
  onClose,
  editing,
  schools,
}: {
  open: boolean;
  onClose: () => void;
  editing: Class | null;
  schools: { id: string; name: string }[];
}) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    values: editing
      ? { name: editing.name, schoolId: editing.schoolId, academicYearId: editing.academicYearId, stage: editing.stage, grade: editing.grade, shift: editing.shift }
      : { name: '', schoolId: schools[0]?.id ?? '', academicYearId: '', stage: 'early_childhood', grade: '', shift: 'morning' },
  });

  const selectedSchoolId = watch('schoolId');
  const academicYears = useLiveQuery<AcademicYear[]>(
    () =>
      selectedSchoolId
        ? db.academicYears.filter((y) => y.schoolId === selectedSchoolId && y.status === 'active').toArray()
        : Promise.resolve<AcademicYear[]>([]),
    [selectedSchoolId],
  );

  async function ensureAcademicYear(schoolId: string, actor: { userId: string; organizationId: string }): Promise<string> {
    const existing = await db.academicYears.filter((y) => y.schoolId === schoolId && y.isCurrent).first();
    if (existing) return existing.id;
    const year = new Date().getFullYear();
    const created = await repositories.academicYears.create(
      { schoolId, year, startDate: `${year}-02-01`, endDate: `${year}-12-15`, isCurrent: true },
      actor,
    );
    return created.id;
  }

  async function onSubmit(values: ClassFormValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const academicYearId = values.academicYearId || (await ensureAcademicYear(values.schoolId, actor));
    const payload = { name: values.name, schoolId: values.schoolId, academicYearId, stage: values.stage, grade: values.grade, shift: values.shift };
    if (editing) {
      await repositories.classes.update(editing.id, payload, actor);
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'classes', entityId: editing.id });
    } else {
      const created = await repositories.classes.create(payload, actor);
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'classes', entityId: created.id });
    }
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar turma' : 'Nova turma'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Nome da turma" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" placeholder="Ex.: Infantil II - Manhã" {...register('name')} />
        </FormField>
        <FormField label="Escola" htmlFor="schoolId" error={errors.schoolId?.message} required>
          <Select id="schoolId" {...register('schoolId')}>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormField>
        {academicYears && academicYears.length > 0 && (
          <FormField label="Ano letivo" htmlFor="academicYearId" error={errors.academicYearId?.message} hint="Se nenhum ano letivo existir para a escola, um será criado automaticamente.">
            <Select id="academicYearId" {...register('academicYearId')}>
              <option value="">Criar/usar ano letivo atual automaticamente</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.year}{y.isCurrent ? ' (atual)' : ''}</option>
              ))}
            </Select>
          </FormField>
        )}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Etapa" htmlFor="stage" error={errors.stage?.message} required>
            <Select id="stage" {...register('stage')}>
              <option value="early_childhood">Educação Infantil</option>
              <option value="elementary">Ensino Fundamental</option>
            </Select>
          </FormField>
          <FormField label="Turno" htmlFor="shift" error={errors.shift?.message} required>
            <Select id="shift" {...register('shift')}>
              <option value="morning">Manhã</option>
              <option value="afternoon">Tarde</option>
              <option value="full_time">Integral</option>
              <option value="evening">Noite</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Série / etapa detalhada" htmlFor="grade" error={errors.grade?.message} required>
          <Input id="grade" placeholder="Ex.: Infantil II, 3º ano" {...register('grade')} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>{editing ? 'Salvar alterações' : 'Cadastrar turma'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
