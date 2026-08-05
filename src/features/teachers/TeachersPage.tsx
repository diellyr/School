import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, UserCog } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Input, Select } from '../../components/form/Field';
import { teacherSchema, type TeacherFormValues } from './teacherSchema';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import { sha256Hex } from '../../lib/hash';
import { initials } from '../../lib/utils';

export function TeachersPage() {
  const teachers = useLiveQuery(() => db.users.filter((u) => u.role === 'teacher' && u.status === 'active').toArray(), []);
  const assignments = useLiveQuery(() => db.teacherAssignments.filter((a) => a.status === 'active').toArray(), []);
  const classes = useLiveQuery(() => db.classes.filter((c) => c.status === 'active').toArray(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canCreate = usePermission('teachers', 'create');

  const classesOf = (teacherId: string) =>
    (assignments ?? []).filter((a) => a.teacherUserId === teacherId).map((a) => classes?.find((c) => c.id === a.classId)?.name).filter(Boolean);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Professores</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Corpo docente e turmas atribuídas.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Novo professor
          </Button>
        )}
      </div>

      {teachers === undefined && <SkeletonList />}
      {teachers?.length === 0 && <EmptyState icon={UserCog} title="Nenhum professor cadastrado" />}

      {teachers && teachers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {initials(t.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">{t.fullName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t.teacherTitle || 'Professor(a)'} · {t.email}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Turmas: {classesOf(t.id).length ? classesOf(t.id).join(', ') : 'Nenhuma atribuída'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TeacherFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} classes={classes ?? []} />
    </div>
  );
}

function TeacherFormDialog({ open, onClose, classes }: { open: boolean; onClose: () => void; classes: { id: string; name: string; schoolId: string }[] }) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { fullName: '', email: '', teacherTitle: '', temporaryPassword: '', classId: '' },
  });

  async function onSubmit(values: TeacherFormValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const created = await repositories.users.create(
      {
        fullName: values.fullName,
        email: values.email,
        role: 'teacher',
        passwordHash: await sha256Hex(values.temporaryPassword),
        isDemo: false,
        isBlocked: false,
        teacherTitle: values.teacherTitle || undefined,
        failedLoginAttempts: 0,
      },
      actor,
    );
    if (values.classId) {
      const klass = classes.find((c) => c.id === values.classId);
      if (klass) {
        const academicYear = await db.academicYears.filter((y) => y.schoolId === klass.schoolId && y.isCurrent).first();
        await repositories.teacherAssignments.create(
          { teacherUserId: created.id, classId: klass.id, schoolId: klass.schoolId, isHomeroom: false, academicYearId: academicYear?.id ?? '' },
          actor,
        );
      }
    }
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'teachers', entityId: created.id });
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Novo professor">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Nome completo" htmlFor="fullName" error={errors.fullName?.message} required>
          <Input id="fullName" {...register('fullName')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="E-mail" htmlFor="email" error={errors.email?.message} required>
            <Input id="email" type="email" {...register('email')} />
          </FormField>
          <FormField label="Título/função" htmlFor="teacherTitle" error={errors.teacherTitle?.message}>
            <Input id="teacherTitle" placeholder="Professor regente" {...register('teacherTitle')} />
          </FormField>
        </div>
        <FormField label="Senha temporária" htmlFor="temporaryPassword" error={errors.temporaryPassword?.message} required hint="O professor deve alterá-la no primeiro acesso (fluxo completo na integração com Supabase Auth).">
          <Input id="temporaryPassword" type="text" {...register('temporaryPassword')} />
        </FormField>
        <FormField label="Turma (opcional)" htmlFor="classId" error={errors.classId?.message}>
          <Select id="classId" {...register('classId')}>
            <option value="">Não atribuir agora</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>Cadastrar professor</Button>
        </div>
      </form>
    </Dialog>
  );
}
