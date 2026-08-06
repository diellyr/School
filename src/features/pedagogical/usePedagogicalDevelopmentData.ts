import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Activity, AgeGroup, ExperienceField } from '../../domain';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { calculateAge } from '../../lib/utils';
import { generateRecommendations } from './services/pedagogicalRecommendationService';

const AGE_GROUPS: AgeGroup[] = ['0-1', '1-2', '2-3', '3-4', '4-5'];

export function ageGroupFor(birthDateIso: string): AgeGroup {
  const years = calculateAge(birthDateIso);
  const index = Math.min(Math.max(years, 0), 4);
  return AGE_GROUPS[index];
}

/** Busca as avaliações/atividades reais do aluno (Dexie) e gera as recomendações pedagógicas —
 *  a página só consome o resultado, nunca acessa o JSON de regras nem monta a lógica sozinha. */
export function usePedagogicalDevelopmentData(studentId: string) {
  const repositories = useRepositories();

  return useLiveQuery(async () => {
    if (!studentId) return undefined;
    const student = await db.students.get(studentId);
    if (!student) return undefined;

    const assessments = await db.assessments
      .filter((a) => a.studentId === studentId && a.status === 'active' && a.stage === 'early_childhood' && !!a.rboLevel)
      .toArray();
    const activityIds = [...new Set(assessments.map((a) => a.activityId))];
    const activitiesRaw = await db.activities.bulkGet(activityIds);
    const activities = activitiesRaw.filter((a): a is Activity => !!a && a.status === 'active');

    const preferences = await repositories.familyPreferences.getByStudent(studentId);
    const avoidWeeks = preferences?.avoidRepeatWeeks ?? 3;
    const since = new Date();
    since.setDate(since.getDate() - avoidWeeks * 7);
    const recentHistory = await repositories.activityHistory.findRecentByStudent(studentId, since.toISOString());
    const recentActivityIds = new Set(recentHistory.map((h) => h.activityId));

    const result = await generateRecommendations({
      studentId,
      activities,
      assessments,
      pedagogicalRepository: repositories.pedagogical,
      options: { childAgeGroup: ageGroupFor(student.birthDate), preferences: preferences ?? undefined, recentActivityIds },
    });

    const allFields: ExperienceField[] = await repositories.pedagogical.getExperienceFields();
    const currentPlan = await repositories.weeklyPlans.getCurrentPlan(studentId);

    return { student, ...result, allFields, currentPlan, preferences: preferences ?? null };
  }, [studentId]);
}
