import { db } from '../../db/schema';
import type { ActivityHistory, FamilyPreferences, RecommendationHistory, WeeklyPlan } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

/** Execuções reais (ou tentativas) de atividades recomendadas — nunca contém o conteúdo da
 *  atividade em si, só a referência (`activityId`) para a biblioteca pedagógica. */
export class LocalActivityHistoryRepository extends LocalBaseRepository<ActivityHistory> {
  constructor() {
    super(db.activityHistory);
  }

  async findByStudent(studentId: string): Promise<ActivityHistory[]> {
    const items = await this.list({ where: (h) => h.studentId === studentId });
    return items.sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt));
  }

  /** Atividades recomendadas para o aluno nas últimas N semanas — usado para evitar repetição. */
  async findRecentByStudent(studentId: string, sinceIso: string): Promise<ActivityHistory[]> {
    const items = await this.findByStudent(studentId);
    return items.filter((h) => h.recommendedAt >= sinceIso);
  }
}

/** Toda recomendação gerada, mesmo que nunca executada — usado para evitar repetição e para
 *  entender quais sugestões funcionam melhor (seção 17 do briefing pedagógico). */
export class LocalRecommendationHistoryRepository extends LocalBaseRepository<RecommendationHistory> {
  constructor() {
    super(db.recommendationHistory);
  }

  async findByStudent(studentId: string): Promise<RecommendationHistory[]> {
    const items = await this.list({ where: (h) => h.studentId === studentId });
    return items.sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt));
  }
}

export class LocalWeeklyPlanRepository extends LocalBaseRepository<WeeklyPlan> {
  constructor() {
    super(db.weeklyPlans);
  }

  async getCurrentPlan(studentId: string): Promise<WeeklyPlan | null> {
    const items = await this.list({ where: (p) => p.studentId === studentId });
    if (items.length === 0) return null;
    return items.sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
  }

  async findByStudent(studentId: string): Promise<WeeklyPlan[]> {
    const items = await this.list({ where: (p) => p.studentId === studentId });
    return items.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }
}

export class LocalFamilyPreferencesRepository extends LocalBaseRepository<FamilyPreferences> {
  constructor() {
    super(db.familyPreferences);
  }

  async getByStudent(studentId: string): Promise<FamilyPreferences | null> {
    const items = await this.list({ where: (p) => p.studentId === studentId });
    return items[0] ?? null;
  }
}
