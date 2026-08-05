import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageSquare, Plus } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Select, Textarea } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { useCurrentRole, usePermission } from '../../auth/usePermission';
import { formatDateTime, initials } from '../../lib/utils';
import type { ParentObservation, Student, TeacherObservation } from '../../domain';

const teacherObsSchema = z.object({
  studentId: z.string().min(1, 'Selecione o aluno.'),
  categoryId: z.string().optional(),
  text: z.string().min(5, 'Escreva ao menos alguns detalhes.'),
  visibleToGuardians: z.boolean(),
});
type TeacherObsValues = z.infer<typeof teacherObsSchema>;

const parentObsSchema = z.object({
  studentId: z.string().min(1, 'Selecione o aluno.'),
  text: z.string().min(5, 'Escreva ao menos alguns detalhes.'),
});
type ParentObsValues = z.infer<typeof parentObsSchema>;

export function ObservationsPage() {
  const role = useCurrentRole();
  if (role === 'guardian') return <GuardianObservations />;
  return <TeacherObservations />;
}

function TeacherObservations() {
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const canCreate = usePermission('observations', 'create');
  const [dialogOpen, setDialogOpen] = useState(false);

  const observations = useLiveQuery(async () => {
    const items = await db.teacherObservations.filter((o) => o.status === 'active').toArray();
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, []);
  const students = useLiveQuery<Student[]>(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const categories = useLiveQuery(() => db.assessmentCategories.filter((c) => c.status === 'active').toArray(), []);

  const studentName = (id: string) => students?.find((s) => s.id === id)?.fullName ?? '—';
  const categoryName = (id?: string) => (id ? categories?.find((c) => c.id === id)?.name : undefined);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeacherObsValues>({
    resolver: zodResolver(teacherObsSchema),
    defaultValues: { studentId: '', categoryId: '', text: '', visibleToGuardians: true },
  });

  async function onSubmit(values: TeacherObsValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const student = students?.find((s) => s.id === values.studentId);
    const created = await repositories.teacherObservations.create(
      {
        studentId: values.studentId,
        teacherId: session.user.id,
        classId: student?.classId ?? '',
        date: new Date().toISOString().slice(0, 10),
        categoryId: values.categoryId || undefined,
        text: values.text,
        visibleToGuardians: values.visibleToGuardians,
        publicationStatus: values.visibleToGuardians ? 'published' : 'draft',
      },
      actor,
    );
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'observations', entityId: created.id });
    reset();
    setDialogOpen(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Observações</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Anotações pedagógicas sobre os alunos, com controle de visibilidade para as famílias.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Nova observação
          </Button>
        )}
      </div>

      {observations === undefined && <SkeletonList />}
      {observations?.length === 0 && <EmptyState icon={MessageSquare} title="Nenhuma observação registrada" />}

      <div className="space-y-3">
        {observations?.map((o: TeacherObservation) => (
          <Card key={o.id}>
            <CardContent>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                    {initials(studentName(o.studentId))}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{studentName(o.studentId)}</span>
                  {categoryName(o.categoryId) && <Badge>{categoryName(o.categoryId)}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={o.visibleToGuardians ? 'success' : 'default'}>
                    {o.visibleToGuardians ? 'Visível para responsáveis' : 'Interna (não visível)'}
                  </Badge>
                  <span className="text-xs text-slate-400">{formatDateTime(o.createdAt)}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{o.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Nova observação">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Aluno" htmlFor="studentId" error={errors.studentId?.message} required>
            <Select id="studentId" {...register('studentId')}>
              <option value="">Selecione…</option>
              {students?.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </Select>
          </FormField>
          <FormField label="Categoria (opcional)" htmlFor="categoryId" error={errors.categoryId?.message}>
            <Select id="categoryId" {...register('categoryId')}>
              <option value="">Nenhuma</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Observação" htmlFor="text" error={errors.text?.message} required>
            <Textarea id="text" rows={4} {...register('text')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="rounded border-slate-300" {...register('visibleToGuardians')} />
            Visível para os responsáveis
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Salvar observação</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function GuardianObservations() {
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const [dialogOpen, setDialogOpen] = useState(false);

  const links = useLiveQuery(async () => {
    if (!session?.user.guardianId) return [];
    return db.studentGuardians.filter((l) => l.guardianId === session.user.guardianId && l.status === 'active').toArray();
  }, [session?.user.guardianId]);
  const studentIds = links?.map((l) => l.studentId) ?? [];
  const students = useLiveQuery<Student[]>(async () => {
    if (!studentIds.length) return [];
    const all = await db.students.bulkGet(studentIds);
    return all.filter((s): s is Student => !!s);
  }, [studentIds.join(',')]);

  const teacherObs = useLiveQuery(async () => {
    if (!studentIds.length) return [];
    const items = await db.teacherObservations
      .filter((o) => studentIds.includes(o.studentId) && o.visibleToGuardians && o.publicationStatus === 'published' && o.status === 'active')
      .toArray();
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [studentIds.join(',')]);

  const parentObs = useLiveQuery(async () => {
    if (!session?.user.guardianId) return [];
    const items = await db.parentObservations.filter((o) => o.guardianId === session.user.guardianId && o.status === 'active').toArray();
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [session?.user.guardianId]);

  const studentName = (id: string) => students?.find((s) => s.id === id)?.fullName ?? '—';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ParentObsValues>({
    resolver: zodResolver(parentObsSchema),
    defaultValues: { studentId: '', text: '' },
  });

  async function onSubmit(values: ParentObsValues) {
    if (!session?.user.guardianId) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const created = await repositories.parentObservations.create(
      { studentId: values.studentId, guardianId: session.user.guardianId, date: new Date().toISOString().slice(0, 10), text: values.text },
      actor,
    );
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'observations', entityId: created.id });
    reset();
    setDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Observações</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Observações da escola sobre seus filhos e suas próprias anotações.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Nova observação familiar</Button>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">Da escola</h2>
        {!teacherObs?.length && <p className="text-sm text-slate-500">Nenhuma observação publicada ainda.</p>}
        <div className="space-y-2">
          {teacherObs?.map((o) => (
            <Card key={o.id}><CardContent>
              <p className="mb-1 text-xs text-slate-400">{studentName(o.studentId)} · {formatDateTime(o.createdAt)}</p>
              <p className="text-sm text-slate-700 dark:text-slate-200">{o.text}</p>
            </CardContent></Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">Suas observações</h2>
        {!parentObs?.length && <p className="text-sm text-slate-500">Você ainda não registrou observações.</p>}
        <div className="space-y-2">
          {parentObs?.map((o: ParentObservation) => (
            <Card key={o.id}><CardContent>
              <p className="mb-1 text-xs text-slate-400">{studentName(o.studentId)} · {formatDateTime(o.createdAt)}</p>
              <p className="text-sm text-slate-700 dark:text-slate-200">{o.text}</p>
            </CardContent></Card>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Nova observação familiar">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Filho(a)" htmlFor="studentId" error={errors.studentId?.message} required>
            <Select id="studentId" {...register('studentId')}>
              <option value="">Selecione…</option>
              {students?.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </Select>
          </FormField>
          <FormField label="Observação" htmlFor="text" error={errors.text?.message} required>
            <Textarea id="text" rows={4} {...register('text')} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Salvar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
