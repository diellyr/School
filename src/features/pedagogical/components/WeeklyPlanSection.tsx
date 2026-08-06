import { useEffect, useState } from 'react';
import { CalendarRange, RefreshCcw, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import type { FamilyActivity, WeeklyPlan, WeeklyPlanItem } from '../../../domain';
import { useAuthStore } from '../../../auth/authStore';
import { useRepositories } from '../../../repositories/RepositoryProvider';
import { usePermission } from '../../../auth/usePermission';
import { selectActivitiesForSkill } from '../services/activitySelectionService';
import type { PedagogicalRecommendationResult } from '../services/pedagogicalRecommendationService';

const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda-feira', tuesday: 'Terça-feira', wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira', friday: 'Sexta-feira', saturday: 'Sábado', sunday: 'Domingo',
};

export function WeeklyPlanSection({
  studentId,
  currentPlan,
  recommendation,
}: {
  studentId: string;
  currentPlan: WeeklyPlan | null;
  recommendation: PedagogicalRecommendationResult;
}) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const canCreate = usePermission('family_development', 'create');
  const canEditPermission = usePermission('family_development', 'edit');
  const canEdit = canCreate || canEditPermission;
  const [activitiesById, setActivitiesById] = useState<Record<string, FamilyActivity>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = new Set((currentPlan?.items ?? []).map((i) => i.activityId));
      const entries = await Promise.all([...ids].map(async (id) => [id, await repositories.pedagogical.getActivityById(id)] as const));
      if (!cancelled) {
        const map: Record<string, FamilyActivity> = {};
        for (const [id, activity] of entries) if (activity) map[id] = activity;
        setActivitiesById(map);
      }
    })();
    return () => { cancelled = true; };
  }, [currentPlan, repositories]);

  function actor() {
    if (!session) return null;
    return { userId: session.user.id, organizationId: session.user.organizationId };
  }

  async function generatePlan() {
    const act = actor();
    if (!act || recommendation.weeklyPlanItems.length === 0) return;
    const plan = await repositories.weeklyPlans.create(
      {
        studentId,
        weekStart: new Date().toISOString().slice(0, 10),
        items: recommendation.weeklyPlanItems,
        pedagogicalRulesVersion: (await repositories.pedagogical.getMetadata()).version,
      },
      act,
    );
    for (const item of plan.items) {
      await repositories.activityHistory.create(
        {
          studentId, activityId: item.activityId, skillId: item.skillId, experienceFieldId: item.experienceFieldId,
          weeklyPlanId: plan.id, weeklyPlanItemId: item.id, recommendationReason: item.reason,
          recommendedAt: new Date().toISOString(), historyStatus: 'planned', sourceAssessmentIds: [],
          pedagogicalRulesVersion: plan.pedagogicalRulesVersion,
        },
        act,
      );
      await repositories.recommendationHistory.create(
        {
          studentId, activityId: item.activityId, skillId: item.skillId, weeklyPlanId: plan.id,
          recommendedAt: new Date().toISOString(), reason: item.reason, priorityScore: 0,
          accepted: true, replaced: false, ignored: false, completed: false, pedagogicalRulesVersion: plan.pedagogicalRulesVersion,
        },
        act,
      );
    }
    setMessage('Plano da semana gerado — uma atividade curta já pode ser um bom momento juntos.');
  }

  async function updateItemHistory(item: WeeklyPlanItem, changes: Parameters<typeof repositories.activityHistory.update>[1]) {
    const act = actor();
    if (!act) return;
    const history = await repositories.activityHistory.list({ where: (h) => h.weeklyPlanItemId === item.id });
    if (history[0]) await repositories.activityHistory.update(history[0].id, changes, act);
  }

  async function setItemStatus(item: WeeklyPlanItem, status: WeeklyPlanItem['itemStatus']) {
    const act = actor();
    if (!act || !currentPlan) return;
    const items = currentPlan.items.map((i) => (i.id === item.id ? { ...i, itemStatus: status } : i));
    await repositories.weeklyPlans.update(currentPlan.id, { items }, act);
    if (status === 'completed') await updateItemHistory(item, { historyStatus: 'completed', completedAt: new Date().toISOString() });
    else if (status === 'skipped') await updateItemHistory(item, { historyStatus: 'skipped' });
  }

  async function setFeedback(item: WeeklyPlanItem, parentFeedback: 'liked' | 'disliked' | 'wantsRepeat') {
    await updateItemHistory(item, { parentFeedback });
    setMessage(parentFeedback === 'liked' ? 'Que bom! Vamos priorizar atividades parecidas.' : parentFeedback === 'disliked' ? 'Obrigado pelo retorno — vamos variar mais essa opção.' : 'Anotado para tentar repetir em breve.');
  }

  async function removeItem(item: WeeklyPlanItem) {
    const act = actor();
    if (!act || !currentPlan) return;
    const items = currentPlan.items.filter((i) => i.id !== item.id);
    await repositories.weeklyPlans.update(currentPlan.id, { items }, act);
    await updateItemHistory(item, { historyStatus: 'removed' });
  }

  async function replaceItem(item: WeeklyPlanItem) {
    const act = actor();
    if (!act || !currentPlan) return;
    const skillActivities = await repositories.pedagogical.getActivitiesBySkillId(item.skillId);
    const usedIds = new Set(currentPlan.items.map((i) => i.activityId));
    usedIds.add(item.activityId);
    const [next] = selectActivitiesForSkill({ activities: skillActivities, recentActivityIds: usedIds, count: 1 });
    if (!next) {
      setMessage('Não há outra atividade disponível para esta habilidade no momento.');
      return;
    }
    const items = currentPlan.items.map((i) => (i.id === item.id ? { ...i, activityId: next.activity.id } : i));
    await repositories.weeklyPlans.update(currentPlan.id, { items }, act);
    await updateItemHistory(item, { historyStatus: 'replaced' });
    setMessage('Atividade substituída.');
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-slate-400" />
          <CardTitle>Plano da semana</CardTitle>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={generatePlan}>
            <RefreshCcw className="h-4 w-4" /> {currentPlan ? 'Gerar novo plano' : 'Gerar plano da semana'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {message && <p className="mb-3 text-sm text-sky-700 dark:text-sky-400">{message}</p>}
        {!currentPlan?.items.length && (
          <EmptyState
            icon={CalendarRange}
            title="Nenhum plano ativo"
            description="O plano é uma sugestão, não uma obrigação — gere um plano leve com base no que foi observado recentemente."
          />
        )}
        {!!currentPlan?.items.length && (
          <ul className="space-y-2">
            {currentPlan.items.map((item) => {
              const activity = activitiesById[item.activityId];
              return (
                <li key={item.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-400">{item.scheduledDay ? DAY_LABELS[item.scheduledDay] ?? item.scheduledDay : '—'}</p>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{activity?.title ?? 'Carregando…'}</p>
                    </div>
                    <Badge tone={item.itemStatus === 'completed' ? 'success' : item.itemStatus === 'skipped' ? 'default' : item.itemStatus === 'replaced' ? 'info' : 'default'}>
                      {item.itemStatus === 'planned' ? 'Planejada' : item.itemStatus === 'completed' ? 'Realizada' : item.itemStatus === 'skipped' ? 'Não realizada' : 'Substituída'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.reason}</p>
                  {canEdit && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setItemStatus(item, 'completed')}>Marcar como realizada</Button>
                      <Button size="sm" variant="ghost" onClick={() => setItemStatus(item, 'skipped')}>Não conseguimos fazer</Button>
                      <Button size="sm" variant="ghost" onClick={() => setFeedback(item, 'liked')}><ThumbsUp className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setFeedback(item, 'disliked')}><ThumbsDown className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setFeedback(item, 'wantsRepeat')}>Repetir outra semana</Button>
                      <Button size="sm" variant="ghost" onClick={() => replaceItem(item)}>Substituir</Button>
                      <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => removeItem(item)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-400">Não foi possível esta semana? Você poderá tentar novamente quando fizer sentido — o plano pode ser adaptado à rotina da família.</p>
      </CardContent>
    </Card>
  );
}
