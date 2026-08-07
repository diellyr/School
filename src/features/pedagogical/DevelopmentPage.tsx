import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Compass } from 'lucide-react';
import { db } from '../../db/schema';
import { StudentPicker } from '../../components/StudentPicker';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { Button } from '../../components/Button';
import { usePedagogicalDevelopmentData } from './usePedagogicalDevelopmentData';
import { ExperienceFieldCard } from './components/ExperienceFieldCard';
import { SkillHelpDialog } from './components/SkillHelpDialog';
import { WeeklyPlanSection } from './components/WeeklyPlanSection';
import { FamilyPreferencesForm } from './components/FamilyPreferencesForm';
import { PedagogicalCatalogTab } from './components/PedagogicalCatalogTab';
import { AnalyzedCategoriesTab } from './components/AnalyzedCategoriesTab';
import type { FamilyActivity } from '../../domain';
import { useAuthStore } from '../../auth/authStore';
import { useRepositories } from '../../repositories/RepositoryProvider';

type DevelopmentTab = 'acompanhamento' | 'catalogo' | 'analisadas';

const TAB_DESCRIPTIONS: Record<DevelopmentTab, string> = {
  acompanhamento: 'Acompanhe o desenvolvimento de um aluno específico e receba sugestões de atividades em família.',
  catalogo:
    'Referência técnica: como cadastrar atividades para o sistema reconhecer automaticamente cada habilidade, a origem MEC/BNCC de cada orientação e a biblioteca completa de atividades sugeridas.',
  analisadas:
    'Visão simples e direta de tudo o que o sistema analisa: os Campos de Experiência da BNCC e as habilidades observadas em cada um — a mesma base usada nos boletins escolares.',
};

export function DevelopmentPage() {
  const [activeTab, setActiveTab] = useState<DevelopmentTab>('acompanhamento');
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [openSkillId, setOpenSkillId] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const initialStudentId = searchParams.get('studentId');
  const initializedFromParam = useRef(false);
  const paramStudent = useLiveQuery(
    () => (initialStudentId && !initializedFromParam.current ? db.students.get(initialStudentId) : undefined),
    [initialStudentId],
  );
  useEffect(() => {
    if (paramStudent && !initializedFromParam.current) {
      initializedFromParam.current = true;
      setSchoolId(paramStudent.schoolId);
      setClassId(paramStudent.classId ?? '');
      setStudentId(paramStudent.id);
    }
  }, [paramStudent]);

  const data = usePedagogicalDevelopmentData(studentId);
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Desenvolvimento</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Acompanhamento por Campo de Experiência da BNCC, com sugestões práticas de atividades em família — nunca um
          diagnóstico. A escala R/B/O é sempre apresentada como tendência de desenvolvimento, nunca como nota.
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <Button
          type="button"
          variant="ghost"
          className={
            activeTab === 'acompanhamento'
              ? 'rounded-none border-b-2 border-sky-600 text-sky-700 dark:text-sky-400'
              : 'rounded-none border-b-2 border-transparent text-slate-500'
          }
          onClick={() => setActiveTab('acompanhamento')}
        >
          Acompanhamento do aluno
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={
            activeTab === 'catalogo'
              ? 'rounded-none border-b-2 border-sky-600 text-sky-700 dark:text-sky-400'
              : 'rounded-none border-b-2 border-transparent text-slate-500'
          }
          onClick={() => setActiveTab('catalogo')}
        >
          Catálogo pedagógico
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={
            activeTab === 'analisadas'
              ? 'rounded-none border-b-2 border-sky-600 text-sky-700 dark:text-sky-400'
              : 'rounded-none border-b-2 border-transparent text-slate-500'
          }
          onClick={() => setActiveTab('analisadas')}
        >
          Categorias e atividades analisadas
        </Button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">{TAB_DESCRIPTIONS[activeTab]}</p>

      {activeTab === 'catalogo' && <PedagogicalCatalogTab />}

      {activeTab === 'analisadas' && <AnalyzedCategoriesTab />}

      {activeTab === 'acompanhamento' && (
        <>
          <StudentPicker
            stage="early_childhood"
            schoolId={schoolId}
            classId={classId}
            studentId={studentId}
            onSchoolChange={setSchoolId}
            onClassChange={setClassId}
            onStudentChange={setStudentId}
          />

          {!studentId && (
            <EmptyState
              icon={Compass}
              title="Selecione um aluno"
              description="Use os filtros acima para escolher escola, turma e aluno da Educação Infantil."
            />
          )}

          {studentId && data === undefined && <SkeletonList />}

          {studentId && data && (
            <>
              <div className="flex justify-end">
                <FamilyPreferencesForm studentId={studentId} preferences={data.preferences} />
              </div>

              {data.allFields.length === 0 && <EmptyState icon={Compass} title="Nenhum campo de experiência cadastrado" />}

              {data.allFields.map((field) => {
                const fieldAnalysis = data.analysis.fieldAnalyses.find((f) => f.experienceField.id === field.id);
                return (
                  <ExperienceFieldCard
                    key={field.id}
                    field={field}
                    counts={fieldAnalysis?.counts ?? { R: 0, B: 0, O: 0 }}
                    skillAnalyses={fieldAnalysis?.skillAnalyses ?? []}
                    hasRecommendation={(skillId) => data.recommendations.some((r) => r.skillId === skillId)}
                    onAskForHelp={setOpenSkillId}
                  />
                );
              })}

              {data.analysis.unclassified.length > 0 && (
                <details className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700">
                  <summary className="cursor-pointer font-medium">
                    {data.analysis.unclassified.length} atividade(s) avaliada(s) sem habilidade correspondente no catálogo
                    pedagógico
                  </summary>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5">
                    {data.analysis.unclassified.map((u) => (
                      <li key={u.activityId}>
                        {u.activityTitle} — {u.period} ({u.rboLevel})
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <WeeklyPlanSection studentId={studentId} currentPlan={data.currentPlan} recommendation={data} />

              {(() => {
                const analysis = data.analysis.fieldAnalyses.flatMap((f) => f.skillAnalyses).find((a) => a.skill.id === openSkillId);
                const recommendation = data.recommendations.find((r) => r.skillId === openSkillId);
                if (!analysis || !recommendation) return null;
                return (
                  <SkillHelpDialog
                    open={!!openSkillId}
                    onClose={() => setOpenSkillId(null)}
                    analysis={analysis}
                    recommendation={recommendation}
                    onAddToPlan={async (activity: FamilyActivity, reason: string) => {
                      if (!session) return;
                      const actor = { userId: session.user.id, organizationId: session.user.organizationId };
                      let plan = data.currentPlan;
                      const newItem = {
                        id: crypto.randomUUID(),
                        activityId: activity.id,
                        skillId: analysis.skill.id,
                        experienceFieldId: analysis.experienceFieldId,
                        reason,
                        itemStatus: 'planned' as const,
                      };
                      if (plan) {
                        await repositories.weeklyPlans.update(plan.id, { items: [...plan.items, newItem] }, actor);
                      } else {
                        plan = await repositories.weeklyPlans.create(
                          {
                            studentId,
                            weekStart: new Date().toISOString().slice(0, 10),
                            items: [newItem],
                            pedagogicalRulesVersion: (await repositories.pedagogical.getMetadata()).version,
                          },
                          actor,
                        );
                      }
                      await repositories.activityHistory.create(
                        {
                          studentId,
                          activityId: activity.id,
                          skillId: analysis.skill.id,
                          experienceFieldId: analysis.experienceFieldId,
                          weeklyPlanId: plan.id,
                          weeklyPlanItemId: newItem.id,
                          recommendationReason: reason,
                          recommendedAt: new Date().toISOString(),
                          historyStatus: 'planned',
                          sourceAssessmentIds: [],
                          pedagogicalRulesVersion: plan.pedagogicalRulesVersion,
                        },
                        actor,
                      );
                      setOpenSkillId(null);
                    }}
                  />
                );
              })()}
            </>
          )}
        </>
      )}
    </div>
  );
}
