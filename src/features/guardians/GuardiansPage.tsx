import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Users2 } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Input, Select } from '../../components/form/Field';
import { guardianSchema, RELATIONSHIP_LABELS, type GuardianFormValues } from './guardianSchema';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import type { Guardian } from '../../domain';
import { initials } from '../../lib/utils';

export function GuardiansPage() {
  const guardians = useLiveQuery(() => db.guardians.filter((g) => g.status === 'active').toArray(), []);
  const links = useLiveQuery(() => db.studentGuardians.filter((l) => l.status === 'active').toArray(), []);
  const students = useLiveQuery(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Guardian | null>(null);
  const canCreate = usePermission('guardians', 'create');
  const canEdit = usePermission('guardians', 'edit');

  const childrenOf = (guardianId: string) =>
    (links ?? []).filter((l) => l.guardianId === guardianId).map((l) => students?.find((s) => s.id === l.studentId)?.fullName).filter(Boolean);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Responsáveis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Pais e responsáveis vinculados aos alunos.</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo responsável
          </Button>
        )}
      </div>

      {guardians === undefined && <SkeletonList />}
      {guardians?.length === 0 && <EmptyState icon={Users2} title="Nenhum responsável cadastrado" />}

      {guardians && guardians.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guardians.map((g) => (
            <Card key={g.id}>
              <CardContent>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                    {initials(g.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{g.fullName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{g.email || g.phone || '—'}</p>
                    <Badge tone="default" className="mt-1">{RELATIONSHIP_LABELS[g.relationship]}</Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Filhos vinculados</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {childrenOf(g.id).length ? childrenOf(g.id).join(', ') : 'Nenhum vínculo cadastrado'}
                  </p>
                </div>
                {canEdit && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => { setEditing(g); setDialogOpen(true); }}>
                    Editar
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GuardianFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} students={students ?? []} />
    </div>
  );
}

function GuardianFormDialog({
  open,
  onClose,
  editing,
  students,
}: {
  open: boolean;
  onClose: () => void;
  editing: Guardian | null;
  students: { id: string; fullName: string }[];
}) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GuardianFormValues>({
    resolver: zodResolver(guardianSchema),
    values: editing
      ? { fullName: editing.fullName, email: editing.email ?? '', phone: editing.phone ?? '', relationship: editing.relationship, studentId: '' }
      : { fullName: '', email: '', phone: '', relationship: 'mother', studentId: '' },
  });

  async function onSubmit(values: GuardianFormValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const payload = { fullName: values.fullName, email: values.email || undefined, phone: values.phone || undefined, relationship: values.relationship };
    let guardianId = editing?.id;
    if (editing) {
      await repositories.guardians.update(editing.id, payload, actor);
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'guardians', entityId: editing.id });
    } else {
      const created = await repositories.guardians.create(payload, actor);
      guardianId = created.id;
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'guardians', entityId: created.id });
    }
    if (values.studentId && guardianId) {
      await repositories.studentGuardians.create(
        { studentId: values.studentId, guardianId, relationship: values.relationship, isPrimary: true, canPickUp: true, financialResponsible: false },
        actor,
      );
    }
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar responsável' : 'Novo responsável'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Nome completo" htmlFor="fullName" error={errors.fullName?.message} required>
          <Input id="fullName" {...register('fullName')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </FormField>
          <FormField label="Telefone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </FormField>
        </div>
        <FormField label="Vínculo" htmlFor="relationship" error={errors.relationship?.message} required>
          <Select id="relationship" {...register('relationship')}>
            {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </FormField>
        {!editing && (
          <FormField label="Vincular a um aluno (opcional)" htmlFor="studentId" error={errors.studentId?.message} hint="Um responsável pode ter mais de um filho — vínculos adicionais podem ser feitos depois.">
            <Select id="studentId" {...register('studentId')}>
              <option value="">Não vincular agora</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </Select>
          </FormField>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>{editing ? 'Salvar alterações' : 'Cadastrar responsável'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
