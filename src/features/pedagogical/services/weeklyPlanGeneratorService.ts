import type { BnccField, FamilyActivity, Skill, WeeklyPlanItem } from '../../../domain';
import { newId } from '../../../domain/common';

const DEFAULT_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const MIN_WEEKLY_ACTIVITIES = 2;
const MAX_WEEKLY_ACTIVITIES = 5;

export interface WeeklyPlanCandidate {
  skill: Skill;
  experienceFieldId: BnccField;
  activity: FamilyActivity;
  reason: string;
}

/**
 * Distribui os candidatos (já ordenados por prioridade) pelos dias disponíveis, respeitando o
 * limite semanal (2 a 5 atividades — seção 9). Não tenta ocupar todos os dias: o objetivo é uma
 * rotina leve, não uma agenda cheia.
 */
export function generateWeeklyPlanItems(input: {
  candidates: WeeklyPlanCandidate[];
  availableDays?: string[];
  maxActivitiesPerWeek?: number;
}): WeeklyPlanItem[] {
  const availableDays = input.availableDays?.length ? input.availableDays : DEFAULT_DAYS;
  const maxActivities = Math.min(Math.max(input.maxActivitiesPerWeek ?? MAX_WEEKLY_ACTIVITIES, MIN_WEEKLY_ACTIVITIES), MAX_WEEKLY_ACTIVITIES);

  const itemCount = Math.min(input.candidates.length, maxActivities, availableDays.length || MAX_WEEKLY_ACTIVITIES);
  const selected = input.candidates.slice(0, itemCount);

  return selected.map((candidate, index) => ({
    id: newId(),
    activityId: candidate.activity.id,
    skillId: candidate.skill.id,
    experienceFieldId: candidate.experienceFieldId,
    scheduledDay: availableDays[index % availableDays.length],
    reason: candidate.reason,
    itemStatus: 'planned',
  }));
}
