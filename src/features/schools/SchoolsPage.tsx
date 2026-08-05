import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, School as SchoolIcon, Trash2 } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Input } from '../../components/form/Field';
import { schoolSchema, type SchoolFormValues } from './schoolSchema';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import type { School } from '../../domain';

export function SchoolsPage() {
  const schools = useLiveQuery(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const canCreate = usePermission('schools', 'create');
  const canEdit = usePermission('schools', 'edit');
  const canDelete = usePermission('schools', 'delete');

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(school: School) {
    setEditing(school);
    setDialogOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Escolas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Organizações escolares cadastradas.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nova escola
          </Button>
        )}
      </div>

      {schools === undefined && <SkeletonList />}

      {schools?.length === 0 && (
        <EmptyState
          icon={SchoolIcon}
          title="Nenhuma escola cadastrada"
          description="Cadastre a primeira escola ou carregue os dados de demonstração em Configurações."
          action={canCreate ? <Button onClick={openCreate}>Cadastrar escola</Button> : undefined}
        />
      )}

      {schools && schools.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((school) => (
            <Card key={school.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-sky-50 p-2 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                      <SchoolIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{school.name}</p>
                      {school.email && <p className="text-xs text-slate-500 dark:text-slate-400">{school.email}</p>}
                    </div>
                  </div>
                  {school.isDemo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">demo</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(school)}>
                      Editar
                    </Button>
                  )}
                  {canDelete && <DeleteSchoolButton school={school} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SchoolFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} />
    </div>
  );
}

function DeleteSchoolButton({ school }: { school: School }) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Arquivar "${school.name}"?`}
        description="A escola será marcada como excluída (exclusão lógica) e pode ser restaurada depois. Turmas e alunos vinculados não são apagados automaticamente."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!session) return;
              await repositories.schools.softDelete(school.id, { userId: session.user.id, organizationId: session.user.organizationId }, 'Removida pelo usuário');
              await repositories.audit.record(
                { userId: session.user.id, role: session.role, organizationId: session.user.organizationId },
                { action: 'soft_delete', module: 'schools', entityId: school.id },
              );
              setOpen(false);
            }}
          >
            Confirmar exclusão
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function SchoolFormDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: School | null }) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolSchema),
    values: editing
      ? {
          name: editing.name,
          document: editing.document ?? '',
          email: editing.email ?? '',
          phone: editing.phone ?? '',
          street: editing.address?.street ?? '',
          city: editing.address?.city ?? '',
          state: editing.address?.state ?? '',
        }
      : { name: '', document: '', email: '', phone: '', street: '', city: '', state: '' },
  });

  async function onSubmit(values: SchoolFormValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const payload = {
      name: values.name,
      document: values.document || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: { street: values.street, city: values.city, state: values.state },
    };
    if (editing) {
      await repositories.schools.update(editing.id, payload, actor);
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'schools', entityId: editing.id });
    } else {
      const created = await repositories.schools.create(payload, actor);
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'schools', entityId: created.id });
    }
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar escola' : 'Nova escola'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Nome" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" {...register('name')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="CNPJ / documento" htmlFor="document" error={errors.document?.message}>
            <Input id="document" {...register('document')} />
          </FormField>
          <FormField label="Telefone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </FormField>
        </div>
        <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" {...register('email')} />
        </FormField>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Endereço" htmlFor="street" error={errors.street?.message}>
            <Input id="street" {...register('street')} />
          </FormField>
          <FormField label="Cidade" htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...register('city')} />
          </FormField>
          <FormField label="UF" htmlFor="state" error={errors.state?.message}>
            <Input id="state" maxLength={2} {...register('state')} />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>{editing ? 'Salvar alterações' : 'Cadastrar escola'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
