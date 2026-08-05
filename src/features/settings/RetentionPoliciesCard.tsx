import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Shield } from 'lucide-react';
import { db } from '../../db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { FormField, Input, Select } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';

const ENTITY_TYPES = [
  'students', 'guardians', 'attendance', 'assessments', 'grades', 'observations', 'alerts',
  'documents', 'portfolio_items', 'audit_logs', 'imports',
];

const retentionSchema = z.object({
  entityType: z.string().min(1, 'Selecione o tipo de registro.'),
  retentionDays: z.number().int().positive('Informe um número de dias maior que zero.'),
  action: z.enum(['archive', 'delete']),
  description: z.string().optional(),
});
type RetentionFormValues = z.infer<typeof retentionSchema>;

export function RetentionPoliciesCard() {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const canAdminister = usePermission('settings', 'administer') || usePermission('settings', 'edit');
  const [dialogOpen, setDialogOpen] = useState(false);

  const rules = useLiveQuery(async () => {
    const items = await db.dataRetentionRules.filter((r) => r.status === 'active').toArray();
    return items.sort((a, b) => a.entityType.localeCompare(b.entityType));
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RetentionFormValues>({
    resolver: zodResolver(retentionSchema),
    defaultValues: { entityType: ENTITY_TYPES[0], retentionDays: 1825, action: 'archive', description: '' },
  });

  async function onSubmit(values: RetentionFormValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const created = await repositories.dataRetentionRules.create(
      { entityType: values.entityType, retentionDays: values.retentionDays, action: values.action, description: values.description || undefined },
      actor,
    );
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'settings', entityId: created.id, reason: 'Política de retenção criada' });
    reset();
    setDialogOpen(false);
  }

  async function removeRule(id: string) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    await repositories.dataRetentionRules.softDelete(id, actor, 'Removida pelo Owner');
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'settings', entityId: id, reason: 'Política de retenção removida' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Políticas de retenção</CardTitle>
        {canAdminister && (
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Nova política</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Define por quanto tempo cada tipo de registro é mantido antes de ser arquivado ou apagado
          definitivamente. Aplicada por um job de retenção — nunca uma exclusão automática silenciosa
          sem rastro em auditoria.
        </p>
        {!rules?.length && <EmptyState icon={Shield} title="Nenhuma política configurada" description="Sem políticas, os registros são mantidos indefinidamente." />}
        <div className="space-y-2">
          {rules?.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
              <span className="font-medium text-slate-800 dark:text-slate-100">{rule.entityType}</span>
              <span className="text-slate-500">{rule.retentionDays} dias</span>
              <Badge tone={rule.action === 'delete' ? 'danger' : 'default'}>{rule.action === 'delete' ? 'Excluir' : 'Arquivar'}</Badge>
              {rule.description && <span className="flex-1 truncate text-xs text-slate-400">{rule.description}</span>}
              {canAdminister && (
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => removeRule(rule.id)}>Remover</Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Nova política de retenção">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Tipo de registro" htmlFor="entityType" error={errors.entityType?.message} required>
            <Select id="entityType" {...register('entityType')}>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="Dias de retenção" htmlFor="retentionDays" error={errors.retentionDays?.message} required>
            <Input id="retentionDays" type="number" min={1} {...register('retentionDays', { valueAsNumber: true })} />
          </FormField>
          <FormField label="Ação ao expirar" htmlFor="action" error={errors.action?.message} required>
            <Select id="action" {...register('action')}>
              <option value="archive">Arquivar</option>
              <option value="delete">Excluir definitivamente</option>
            </Select>
          </FormField>
          <FormField label="Descrição (opcional)" htmlFor="description" error={errors.description?.message}>
            <Input id="description" {...register('description')} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Salvar política</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
