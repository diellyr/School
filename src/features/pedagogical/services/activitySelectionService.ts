import type { AgeGroup, FamilyActivity, FamilyPreferences } from '../../../domain';

export interface ActivitySelectionInput {
  activities: FamilyActivity[];
  /** IDs de atividades já recomendadas/realizadas dentro da janela "evitar repetir por N semanas". */
  recentActivityIds: Set<string>;
  childAgeGroup?: AgeGroup;
  preferences?: FamilyPreferences;
  count?: number;
}

export interface ActivitySelectionResult {
  activity: FamilyActivity;
  /** true quando a atividade só entrou porque todas as outras opções estavam recentes demais. */
  wasForcedRepeat: boolean;
}

/**
 * Escolhe até `count` atividades para uma habilidade, evitando repetição recente e respeitando
 * preferências da família (seção 13 e 14) — nunca sempre a primeira opção cadastrada (seção 8):
 * uma vez usada, uma atividade só volta a aparecer depois que sai da janela de repetição.
 */
export function selectActivitiesForSkill(input: ActivitySelectionInput): ActivitySelectionResult[] {
  const { activities, recentActivityIds, childAgeGroup, preferences, count = 1 } = input;

  let pool = activities.filter((a) => a.active);
  if (childAgeGroup) {
    const ageFiltered = pool.filter((a) => a.ageGroups.includes(childAgeGroup));
    if (ageFiltered.length > 0) pool = ageFiltered;
  }
  if (preferences?.avoidActivityTypes.length) {
    pool = pool.filter((a) => !preferences.avoidActivityTypes.includes(a.activityType));
  }
  if (preferences?.maxMinutesPerActivity) {
    const withinTime = pool.filter((a) => a.durationMinutes <= preferences.maxMinutesPerActivity);
    if (withinTime.length > 0) pool = withinTime;
  }
  if (preferences?.preferredEnvironment && preferences.preferredEnvironment !== 'either') {
    const envFiltered = pool.filter((a) => a.environment === preferences.preferredEnvironment || a.environment === 'either');
    if (envFiltered.length > 0) pool = envFiltered;
  }

  const notRecent = pool.filter((a) => !recentActivityIds.has(a.id));
  const usablePool = notRecent.length > 0 ? notRecent : pool;
  const forcedRepeat = notRecent.length === 0 && pool.length > 0;

  const score = (a: FamilyActivity): number => {
    let s = 0;
    if (preferences?.preferredActivityTypes.includes(a.activityType)) s += 3;
    if (preferences?.availableMaterials.length) {
      const materialsAvailable = a.materials.every((m) => preferences.availableMaterials.includes(m));
      if (materialsAvailable || a.materialLevel === 'none') s += 2;
    } else if (a.materialLevel === 'none') {
      s += 1;
    }
    return s;
  };

  const ranked = [...usablePool].sort((a, b) => score(b) - score(a));
  return ranked.slice(0, count).map((activity) => ({ activity, wasForcedRepeat: forcedRepeat }));
}
