import { useEffect, useState } from 'react';
import { Clock, PlusCircle, RefreshCcw } from 'lucide-react';
import { Dialog } from '../../../components/Dialog';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import type { FamilyActivity } from '../../../domain';
import { RBO_LABELS } from '../../../domain';
import { useRepositories } from '../../../repositories/RepositoryProvider';
import type { SkillAnalysis } from '../services/assessmentAnalysisService';
import type { ActivityRecommendation } from '../services/pedagogicalRecommendationService';

/**
 * "Como podemos ajudar?" — seção 7 do briefing pedagógico. Mostra a habilidade, por que ela é
 * importante, como ajudar, a biblioteca de atividades alternativas, tempo/frequência sugeridos,
 * materiais necessários e a justificativa da recomendação — nunca "Recomendado pela IA".
 */
export function SkillHelpDialog({
  open,
  onClose,
  analysis,
  recommendation,
  onAddToPlan,
}: {
  open: boolean;
  onClose: () => void;
  analysis: SkillAnalysis;
  recommendation: ActivityRecommendation;
  onAddToPlan: (activity: FamilyActivity, reason: string) => void;
}) {
  const repositories = useRepositories();
  const [chosenActivity, setChosenActivity] = useState<FamilyActivity | null>(null);
  const [alternatives, setAlternatives] = useState<FamilyActivity[]>([]);
  const [activityIndex, setActivityIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const chosen = await repositories.pedagogical.getActivityById(recommendation.activityId);
      const alts = (
        await Promise.all(recommendation.alternativeActivityIds.map((id) => repositories.pedagogical.getActivityById(id)))
      ).filter((a): a is FamilyActivity => !!a);
      if (!cancelled) {
        setChosenActivity(chosen);
        setAlternatives(alts);
        setActivityIndex(0);
      }
    })();
    return () => { cancelled = true; };
  }, [open, recommendation, repositories]);

  const allOptions = chosenActivity ? [chosenActivity, ...alternatives] : [];
  const activity = allOptions[activityIndex] ?? null;
  const guidance = analysis.skill.familyGuidance;

  return (
    <Dialog open={open} onClose={onClose} title="Como podemos ajudar?" size="lg">
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{analysis.skill.name}</h4>
            <Badge tone={analysis.currentLevel === 'R' ? 'danger' : analysis.currentLevel === 'B' ? 'warning' : 'success'}>
              {RBO_LABELS[analysis.currentLevel]}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">Referência pedagógica: Campo de Experiência da BNCC — {analysis.skill.source.sourceType === 'school-indicator' ? 'indicador do relatório escolar' : 'interpretação pedagógica'}.</p>
        </div>

        {guidance.importance && (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Por que essa habilidade é importante</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{guidance.importance}</p>
          </div>
        )}

        {guidance.howToHelp.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Como ajudar</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
              {guidance.howToHelp.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Atividade em família</p>
            {allOptions.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => setActivityIndex((i) => (i + 1) % allOptions.length)}>
                <RefreshCcw className="h-4 w-4" /> Ver outra atividade
              </Button>
            )}
          </div>
          {activity ? (
            <div className="space-y-2">
              <p className="font-medium text-slate-900 dark:text-slate-100">{activity.title}</p>
              {activity.shortDescription && <p className="text-sm text-slate-600 dark:text-slate-300">{activity.shortDescription}</p>}
              {activity.instructions.length > 0 && (
                <ol className="list-decimal space-y-0.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
                  {activity.instructions.map((step) => <li key={step}>{step}</li>)}
                </ol>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {activity.durationMinutes} min</span>
                <span>·</span>
                <span>{activity.materials.length > 0 ? `Materiais: ${activity.materials.join(', ')}` : 'Sem materiais necessários'}</span>
              </div>
              <p className="text-xs text-slate-400">Atividade prática sugerida pelo Acompanha+ com base na habilidade observada.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Carregando…</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300">Tempo sugerido</p>
            <p className="text-slate-600 dark:text-slate-300">{guidance.estimatedMinutesMin} a {guidance.estimatedMinutesMax} minutos</p>
          </div>
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300">Frequência sugerida</p>
            <p className="text-slate-600 dark:text-slate-300">{guidance.recommendedFrequencyPerWeek}x por semana</p>
          </div>
        </div>

        <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
          <p className="font-medium">Por que esta recomendação foi mostrada</p>
          <p>{recommendation.reason}</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {activity && (
            <Button onClick={() => activity && onAddToPlan(activity, recommendation.reason)}>
              <PlusCircle className="h-4 w-4" /> Adicionar ao plano da semana
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
