import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Sparkles } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Input, Select, Textarea } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { useCurrentRole, usePermission } from '../../auth/usePermission';
import type { RecommendationAgeRange } from '../../domain';
import { formatDate } from '../../lib/utils';

const AGE_RANGES: RecommendationAgeRange[] = ['0-2', '3-5', '6-8', '9-11', '12+'];

const recommendationSchema = z.object({
  title: z.string().min(2, 'Informe o título.'),
  content: z.string().min(10, 'Descreva a recomendação com mais detalhes.'),
  ageRange: z.enum(['0-2', '3-5', '6-8', '9-11', '12+']),
  environment: z.enum(['school', 'family', 'both']),
  source: z.string().min(2, 'Informe a fonte da orientação.'),
  sourceValidated: z.boolean(),
});
type RecommendationFormValues = z.infer<typeof recommendationSchema>;

export function RecommendationsPage() {
  const role = useCurrentRole();
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const canCreate = usePermission('recommendations', 'create');
  const canApprove = usePermission('recommendations', 'approve');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ageFilter, setAgeFilter] = useState('');

  const recommendations = useLiveQuery(async () => {
    const items = await db.recommendations.filter((r) => r.status === 'active').toArray();
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);

  const visible = recommendations?.filter((r) => {
    if (!(r.published || role === 'owner' || role === 'admin')) return false;
    if (ageFilter && r.ageRange !== ageFilter) return false;
    return true;
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecommendationFormValues>({
    resolver: zodResolver(recommendationSchema),
    defaultValues: { title: '', content: '', ageRange: '3-5', environment: 'both', source: '', sourceValidated: false },
  });

  async function onSubmit(values: RecommendationFormValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const created = await repositories.recommendations.create(
      {
        title: values.title,
        content: values.content,
        ageRange: values.ageRange,
        environment: values.environment,
        source: values.source,
        sourceValidated: values.sourceValidated,
        reviewedAt: values.sourceValidated ? new Date().toISOString() : undefined,
        published: canApprove && values.sourceValidated,
        approvedBy: canApprove && values.sourceValidated ? session.user.id : undefined,
      },
      actor,
    );
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'recommendations', entityId: created.id });
    reset();
    setDialogOpen(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Recomendações</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Dicas para pais e professores — nunca substituem orientação profissional.
          </p>
        </div>
        {canCreate && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Nova recomendação</Button>}
      </div>

      <div className="mb-4 max-w-xs">
        <Select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}>
          <option value="">Todas as faixas etárias</option>
          {AGE_RANGES.map((r) => <option key={r} value={r}>{r} anos</option>)}
        </Select>
      </div>

      {visible === undefined && <SkeletonList />}
      {visible?.length === 0 && <EmptyState icon={Sparkles} title="Nenhuma recomendação disponível" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible?.map((rec) => (
          <Card key={rec.id}>
            <CardContent>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge>{rec.ageRange} anos</Badge>
                <Badge tone="default">{rec.environment === 'both' ? 'Escola e família' : rec.environment === 'school' ? 'Escola' : 'Família'}</Badge>
                {!rec.published && <Badge tone="warning">Aguardando aprovação</Badge>}
                {!rec.sourceValidated && <Badge tone="danger">Fonte não validada</Badge>}
              </div>
              <p className="mb-1 font-medium text-slate-900 dark:text-slate-100">{rec.title}</p>
              <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{rec.content}</p>
              <p className="text-xs text-slate-400">
                Fonte: {rec.source}{rec.reviewedAt ? ` · Revisado em ${formatDate(rec.reviewedAt)}` : ''}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Nova recomendação" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Título" htmlFor="title" error={errors.title?.message} required>
            <Input id="title" {...register('title')} />
          </FormField>
          <FormField label="Conteúdo" htmlFor="content" error={errors.content?.message} required>
            <Textarea id="content" rows={4} {...register('content')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Faixa etária" htmlFor="ageRange" error={errors.ageRange?.message} required>
              <Select id="ageRange" {...register('ageRange')}>
                {AGE_RANGES.map((r) => <option key={r} value={r}>{r} anos</option>)}
              </Select>
            </FormField>
            <FormField label="Ambiente" htmlFor="environment" error={errors.environment?.message} required>
              <Select id="environment" {...register('environment')}>
                <option value="both">Escola e família</option>
                <option value="school">Escola</option>
                <option value="family">Família</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Fonte da orientação" htmlFor="source" error={errors.source?.message} required hint="Ex.: BNCC, equipe pedagógica, publicação validada.">
            <Input id="source" {...register('source')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="rounded border-slate-300" {...register('sourceValidated')} />
            Fonte validada por um administrador
          </label>
          {!canApprove && (
            <p className="text-xs text-slate-400">Recomendações criadas por professores ficam pendentes de aprovação de um administrador antes de serem publicadas.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Salvar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
