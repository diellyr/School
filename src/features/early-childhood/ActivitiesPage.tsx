import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { ClipboardList, FolderCog, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
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
import type { Activity, AssessmentCategory } from '../../domain';
import { formatDate, normalizeForMatch } from '../../lib/utils';

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
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
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
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setCategoriesDialogOpen(true)}>
              <FolderCog className="h-4 w-4" /> Categorias
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Nova atividade
            </Button>
          )}
        </div>
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

      <CategoriesManagerDialog
        open={categoriesDialogOpen}
        onClose={() => setCategoriesDialogOpen(false)}
        categories={categories ?? []}
        activities={activities ?? []}
      />
    </div>
  );
}

function CategoriesManagerDialog({
  open,
  onClose,
  categories,
  activities,
}: {
  open: boolean;
  onClose: () => void;
  categories: AssessmentCategory[];
  activities: Activity[];
}) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const allCategories = useLiveQuery(() => db.assessmentCategories.toArray(), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');

  function linkedCount(categoryId: string) {
    return activities.filter((a) => a.categoryId === categoryId).length;
  }

  // Atividades ainda ligadas a categorias já excluídas (ex.: alguém excluiu uma duplicata direto,
  // em vez de mesclar) — o nome "fantasma" continua aparecendo nos gráficos porque o registro da
  // categoria ainda existe (só marcado como excluído) e a atividade nunca foi reatribuída.
  const orphanedCategories = (allCategories ?? []).filter(
    (c) => c.status === 'deleted' && linkedCount(c.id) > 0,
  );

  function startEdit(c: AssessmentCategory) {
    setEditingId(c.id);
    setEditValue(c.name);
    setConfirmingDeleteId(null);
    setMergingId(null);
  }

  async function saveEdit(c: AssessmentCategory) {
    if (!session || !editValue.trim()) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    await repositories.assessmentCategories.update(c.id, { name: editValue.trim() }, actor);
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'activities', entityId: c.id });
    setEditingId(null);
  }

  async function confirmDelete(c: AssessmentCategory) {
    if (!session || linkedCount(c.id) > 0) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    await repositories.assessmentCategories.softDelete(c.id, actor, 'Removida pelo usuário');
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'soft_delete', module: 'activities', entityId: c.id });
    setConfirmingDeleteId(null);
  }

  function startMerge(c: AssessmentCategory) {
    setMergingId(c.id);
    setMergeTargetId('');
    setEditingId(null);
    setConfirmingDeleteId(null);
  }

  async function confirmMerge(source: AssessmentCategory) {
    if (!session || !mergeTargetId || mergeTargetId === source.id) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const linked = activities.filter((a) => a.categoryId === source.id);
    for (const a of linked) {
      await repositories.activities.update(a.id, { categoryId: mergeTargetId }, actor);
    }
    await repositories.assessmentCategories.softDelete(source.id, actor, `Mesclada em outra categoria (${linked.length} atividade(s) reatribuída(s))`);
    await repositories.audit.record(
      { ...actor, role: session.role },
      { action: 'edit', module: 'activities', entityId: mergeTargetId },
    );
    setMergingId(null);
    setMergeTargetId('');
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Categorias / campos de experiência"
      description="Usadas para agrupar atividades — a mesma categoria pode ser reaproveitada em várias atividades."
      size="lg"
    >
      {orphanedCategories.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            {orphanedCategories.length === 1 ? 'Categoria excluída ainda em uso' : 'Categorias excluídas ainda em uso'}
          </p>
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
            {orphanedCategories.length === 1 ? 'Esta categoria foi excluída, mas' : 'Estas categorias foram excluídas, mas'} ainda
            existem atividades apontando para {orphanedCategories.length === 1 ? 'ela' : 'elas'} — por isso o nome antigo continua
            aparecendo nos gráficos. Use "Mesclar" para mover essas atividades para a categoria correta.
          </p>
          <ul className="divide-y divide-amber-200 dark:divide-amber-900">
            {orphanedCategories.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-2">
                {mergingId === c.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Mesclar "{c.name}" em:</span>
                    <Select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} className="flex-1">
                      <option value="">Selecione a categoria de destino</option>
                      {categories.filter((other) => other.stage === c.stage).map((other) => (
                        <option key={other.id} value={other.id}>{other.name}</option>
                      ))}
                    </Select>
                    <Button size="sm" disabled={!mergeTargetId} onClick={() => confirmMerge(c)}>Confirmar</Button>
                    <Button size="sm" variant="outline" onClick={() => setMergingId(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{c.name}</span>
                    <Badge>{linkedCount(c.id)} atividade(s)</Badge>
                    <Button size="sm" onClick={() => startMerge(c)}>Mesclar</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {categories.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhuma categoria cadastrada ainda. Crie uma direto no formulário de "Nova atividade".
        </p>
      )}
      {categories.length > 0 && (
        <>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Criou categorias repetidas por engano (ex.: "Convivência" e "convivencia")? Use "Mesclar" para juntar as
            atividades de uma categoria duplicada em outra e remover a duplicada. Uma categoria só pode ser excluída
            diretamente quando nenhuma atividade estiver mais usando ela.
          </p>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {categories.map((c) => {
              const inUse = linkedCount(c.id);
              return (
                <li key={c.id} className="flex flex-col gap-2 px-3 py-2">
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2">
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1" autoFocus />
                      <Button size="sm" onClick={() => saveEdit(c)}>Salvar</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  ) : confirmingDeleteId === c.id ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-rose-700 dark:text-rose-400">Excluir "{c.name}"?</span>
                      <Button size="sm" variant="danger" onClick={() => confirmDelete(c)}>Confirmar</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmingDeleteId(null)}>Cancelar</Button>
                    </div>
                  ) : mergingId === c.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 dark:text-slate-300">Mesclar "{c.name}" em:</span>
                      <Select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} className="flex-1">
                        <option value="">Selecione a categoria de destino</option>
                        {categories.filter((other) => other.id !== c.id && other.stage === c.stage).map((other) => (
                          <option key={other.id} value={other.id}>{other.name}</option>
                        ))}
                      </Select>
                      <Button size="sm" disabled={!mergeTargetId} onClick={() => confirmMerge(c)}>Confirmar</Button>
                      <Button size="sm" variant="outline" onClick={() => setMergingId(null)}>Cancelar</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{c.name}</span>
                      {inUse > 0 && <Badge>{inUse} atividade(s)</Badge>}
                      <Badge>{c.stage === 'early_childhood' ? 'Ed. Infantil' : 'Ens. Fundamental'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => startMerge(c)}>Mesclar</Button>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(c)} title="Renomear">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={inUse > 0}
                        onClick={() => setConfirmingDeleteId(c.id)}
                        title={inUse > 0 ? 'Mescle esta categoria em outra antes de excluir — ainda há atividades usando ela' : 'Excluir'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      </div>
    </Dialog>
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
      const newName = values.newCategoryName.trim();
      const existing = availableCategories.find((c) => normalizeForMatch(c.name) === normalizeForMatch(newName));
      if (existing) {
        categoryId = existing.id;
      } else {
        const created = await repositories.assessmentCategories.create(
          { schoolId: selectedClass.schoolId, stage: selectedClass.stage, kind: 'custom', name: newName },
          actor,
        );
        categoryId = created.id;
      }
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
