import type { Activity, AgeGroup, Assessment, FamilyPreferences } from '../../../domain';
import type { PedagogicalRepository } from '../../../repositories/pedagogical/PedagogicalRepository';
import { analyzeStudentAssessments, type StudentPedagogicalAnalysis } from './assessmentAnalysisService';
import { rankSkillPriorities, type SkillPriority } from './recommendationPriorityService';
import { explainRecommendation } from './recommendationExplanationService';
import { selectActivitiesForSkill } from './activitySelectionService';
import { generateWeeklyPlanItems, type WeeklyPlanCandidate } from './weeklyPlanGeneratorService';
import type { WeeklyPlanItem } from '../../../domain';

export interface RecommendationOptions {
  childAgeGroup?: AgeGroup;
  preferences?: FamilyPreferences;
  /** IDs de atividades recomendadas/realizadas dentro da janela de "evitar repetir" — já
   *  filtradas pelo chamador a partir de `ActivityHistoryRepository`/`RecommendationHistoryRepository`. */
  recentActivityIds?: Set<string>;
  /** Quantas opções alternativas trazer por habilidade (além da escolhida para o plano). */
  alternativesPerSkill?: number;
}

export interface ActivityRecommendation {
  skillId: string;
  experienceFieldId: string;
  activityId: string;
  priorityScore: number;
  reason: string;
  alternativeActivityIds: string[];
}

export interface PedagogicalRecommendationResult {
  analysis: StudentPedagogicalAnalysis;
  recommendations: ActivityRecommendation[];
  weeklyPlanItems: WeeklyPlanItem[];
}

/**
 * Orquestrador: Interface → aqui → services puros (`assessmentAnalysisService`,
 * `recommendationPriorityService`, `activitySelectionService`, `weeklyPlanGeneratorService`,
 * `recommendationExplanationService`) → `PedagogicalRepository`. Esta é a única camada que
 * conhece todos os services; a interface (React) só chama esta função.
 */
export async function generateRecommendations(input: {
  studentId: string;
  activities: Activity[];
  assessments: Assessment[];
  pedagogicalRepository: PedagogicalRepository;
  options?: RecommendationOptions;
}): Promise<PedagogicalRecommendationResult> {
  const { studentId, activities, assessments, pedagogicalRepository, options = {} } = input;
  const recentActivityIds = options.recentActivityIds ?? new Set<string>();

  const analysis = await analyzeStudentAssessments({ studentId, activities, assessments, pedagogicalRepository });

  const recommendations: ActivityRecommendation[] = [];
  const planCandidates: WeeklyPlanCandidate[] = [];

  for (const fieldAnalysis of analysis.fieldAnalyses) {
    const fieldRCount = fieldAnalysis.counts.R;
    const ranked = rankSkillPriorities(fieldAnalysis.skillAnalyses, () => fieldRCount);

    for (const { analysis: skillAnalysis, priority } of ranked) {
      if (priority.score <= 0) continue; // habilidades em O sem reforço recente não geram recomendação

      const activityOptions = await pedagogicalRepository.getActivitiesBySkillId(skillAnalysis.skill.id);
      const selected = selectActivitiesForSkill({
        activities: activityOptions,
        recentActivityIds,
        childAgeGroup: options.childAgeGroup,
        preferences: options.preferences,
        count: 1 + (options.alternativesPerSkill ?? 3),
      });
      if (selected.length === 0) continue;

      const [chosen, ...alternatives] = selected;
      const reason = explainRecommendation(skillAnalysis, priority);

      recommendations.push({
        skillId: skillAnalysis.skill.id,
        experienceFieldId: skillAnalysis.experienceFieldId,
        activityId: chosen.activity.id,
        priorityScore: priority.score,
        reason,
        alternativeActivityIds: alternatives.map((a) => a.activity.id),
      });

      planCandidates.push({
        skill: skillAnalysis.skill,
        experienceFieldId: skillAnalysis.experienceFieldId,
        activity: chosen.activity,
        reason,
      });
    }
  }

  planCandidates.sort((a, b) => {
    const scoreA = recommendations.find((r) => r.activityId === a.activity.id)?.priorityScore ?? 0;
    const scoreB = recommendations.find((r) => r.activityId === b.activity.id)?.priorityScore ?? 0;
    return scoreB - scoreA;
  });

  const weeklyPlanItems = generateWeeklyPlanItems({
    candidates: planCandidates,
    availableDays: options.preferences?.availableDays,
    maxActivitiesPerWeek: options.preferences?.maxActivitiesPerWeek,
  });

  return { analysis, recommendations, weeklyPlanItems };
}

export type { SkillPriority };
