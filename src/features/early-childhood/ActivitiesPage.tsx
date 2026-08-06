import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { ClipboardList, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Input, Select, Textarea } from '../../components/form/Field';
import { activitySchema, ACTIVITY_TYPE_LABELS, type ActivityFormValues } from './activitySchema';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import type { Activity } from '../../domain';
import { formatDate } from '../../lib/utils';

export function ActivitiesPage() {
  const activities = useLiveQuery(async () => {
    const items = await db.activities.filter((a) => a.status === 'active').toArray();
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, []);
  const classes = useLiveQuery(() => db.classes.filter((c) => c.status === 'active').toArray(), []);
  const categories = useLiveQuery(() => db.assessmentCategories.filter((c) => c.status === 'active').toArray(), []);
  const assessmentCounts = useLiveQuery(async () => {
    const all = await db.assessments.toArray();
    const map = new Map<string, number>();
    for (const a of all) map.set(a.activityId, (map.get(a.activityId) ?? 0) + 1);
    return map;
  }, []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const canCreate = usePermission('activities', 'create');
  const canEdit = usePermission('activities', 'edit');
  const canDelete = usePermission('activities', 'delete');

  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);

  const className = (id: string) => classes?.find((c) => c.id === id)?.name ?? '—';
  const categoryName = (id?: string) => (id ? categories?.find((c) => c.id === id)?.name : undefined) ?? '—';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Atividades</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Atividades cadastradas por turma, da Educação Infantil e do Ensino Fundamental. Depois de criar, lance
            as avaliações de cada aluno em <Link to="/avaliacoes" className="text-sky-600 hover:underline">Avaliações</Link> (Educação
            Infantil) ou <Link to="/notas" className="text-sky-600 hover:underline">Notas</Link> (Ensino Fundamental).
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Nova atividade
          </Button>
        )}
      </div>

      {activities === undefined && <SkeletonList />}
      {activities?.length === 0 && (
        <EmptyState icon={Sparkles} title="Nenhuma atividade cadastrada" description="Crie a primeira atividade para começar a registrar avaliações." />
      )}

      {activities && activities.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Estágio</th>
                <th className="px-4 py-3">Categoria/Disciplina</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Avaliações</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{a.title}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{className(a.classId)}</td>
                  <td className="px-4 py-3"><Badge>{a.stage === 'early_childhood' ? 'Ed. Infantil' : 'Ens. Fundamental'}</Badge></td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{a.subject || categoryName(a.categoryId)}</td>
                  <td className="px-4 py-3"><Badge>{ACTIVITY_TYPE_LABELS[a.type]}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(a.date)}</td>
                  <td className="px-4 py-3 text-slate-500">{a.period}</td>
                  <td className="px-4 py-3 text-slate-500">{assessmentCounts?.get(a.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={
                          a.stage === 'early_childhood'
                            ? `/avaliacoes?activityId=${a.id}`
                            : `/notas?classId=${a.classId}&subject=${encodeURIComponent(a.subject ?? a.title)}&period=${encodeURIComponent(a.period)}`
                        }
                        title="Lançar avaliações/notas desta atividade"
                      >
                        <Button size="sm" variant="ghost"><ClipboardList className="h-4 w-4" /></Button>
                      </Link>
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setDialogOpen(true); }} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDeleting(a)} title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ActivityFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        classes={classes ?? []}
        categories={categories ?? []}
      />

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Excluir "${deleting?.title}"?`}
        description="A atividade será marcada como excluída (exclusão lógica) e pode ser restaurada depois. Avaliações/notas já lançadas para ela não são apagadas automaticamente."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!session || !deleting) return;
              const actor = { userId: session.user.id, organizationId: session.user.organizationId };
              await repositories.activities.softDelete(deleting.id, actor, 'Removida pelo usuário');
              await repositories.audit.record({ ...actor, role: session.role }, { action: 'soft_delete', module: 'activities', entityId: deleting.id });
              setDeleting(null);
            }}
          >
            Confirmar exclusão
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function ActivityFormDialog({
  open,
  onClose,
  editing,
  classes,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  editing: Activity | null;
  classes: { id: string; name: string; schoolId: string; stage: 'early_childhood' | 'elementary' }[];
  categories: { id: string; name: string; schoolId: string; stage: 'early_childhood' | 'elementary' }[];
}) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    values: editing
      ? {
          classId: editing.classId,
          title: editing.title,
          description: editing.description ?? '',
          categoryId: editing.categoryId ?? '',
          newCategoryName: '',
          type: editing.type,
          date: editing.date,
          period: editing.period,
        }
      : { classId: classes[0]?.id ?? '', title: '', description: '', categoryId: '', newCategoryName: '', type: 'atividade', date: new Date().toISOString().slice(0, 10), period: '' },
  });

  const selectedClassId = watch('classId');
  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const availableCategories = categories.filter((c) => c.schoolId === selectedClass?.schoolId && c.stage === selectedClass?.stage);

  async function onSubmit(values: ActivityFormValues) {
    if (!session || !selectedClass) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };

    let categoryId = values.categoryId || undefined;
    if (!categoryId && values.newCategoryName?.trim()) {
      const created = await repositories.assessmentCategories.create(
        { schoolId: selectedClass.schoolId, stage: selectedClass.stage, kind: 'custom', name: values.newCategoryName.trim() },
        actor,
      );
      categoryId = created.id;
    }

    if (editing) {
      await repositories.activities.update(
        editing.id,
        {
          schoolId: selectedClass.schoolId,
          classId: values.classId,
          stage: selectedClass.stage,
          title: values.title,
          description: values.description || undefined,
          categoryId,
          type: values.type,
          date: values.date,
          period: values.period,
        },
        actor,
      );
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'activities', entityId: editing.id });
    } else {
      const created = await repositories.activities.create(
        {
          schoolId: selectedClass.schoolId,
          classId: values.classId,
          academicYearId: (await db.classes.get(values.classId))?.academicYearId ?? '',
          stage: selectedClass.stage,
          title: values.title,
          description: values.description || undefined,
          categoryId,
          type: values.type,
          date: values.date,
          period: values.period,
          createdByTeacherId: session.user.id,
        },
        actor,
      );
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'activities', entityId: created.id });
    }
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar atividade' : 'Nova atividade'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Turma" htmlFor="classId" error={errors.classId?.message} required>
          <Select id="classId" {...register('classId')}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.stage === 'early_childhood' ? 'Ed. Infantil' : 'Ens. Fundamental'})</option>)}
          </Select>
        </FormField>
        <FormField label="Título" htmlFor="title" error={errors.title?.message} required>
          <Input id="title" placeholder="Ex.: Roda de conversa sobre sentimentos" {...register('title')} />
        </FormField>
        <FormField label="Descrição" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" {...register('description')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Categoria / campo de experiência" htmlFor="categoryId" error={errors.categoryId?.message} hint={availableCategories.length === 0 ? 'Nenhuma categoria cadastrada para esta escola — use o campo abaixo para criar uma.' : undefined}>
            <Select id="categoryId" {...register('categoryId')}>
              <option value="">Nenhuma / usar nova abaixo</option>
              {availableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Ou criar nova categoria" htmlFor="newCategoryName" error={errors.newCategoryName?.message}>
            <Input id="newCategoryName" placeholder="Ex.: Convivência" {...register('newCategoryName')} />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Tipo" htmlFor="type" error={errors.type?.message} required>
            <Select id="type" {...register('type')}>
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
          <FormField label="Data" htmlFor="date" error={errors.date?.message} required>
            <Input id="date" type="date" {...register('date')} />
          </FormField>
          <FormField label="Período" htmlFor="period" error={errors.period?.message} required hint="Ex.: 2026-B1">
            <Input id="period" placeholder="2026-B1" {...register('period')} />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>{editing ? 'Salvar alterações' : 'Cadastrar atividade'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
