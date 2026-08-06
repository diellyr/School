import type { ExperienceField, FamilyActivity, PedagogicalRulesMetadata, Skill } from '../../domain';

/**
 * Acesso somente-leitura ao conteúdo pedagógico (campos de experiência, habilidades,
 * orientações e biblioteca de atividades). Hoje implementado sobre um arquivo JSON local
 * (`JsonPedagogicalRepository`); no futuro, uma `PedagogicalApiRepository` implementará o
 * mesmo contrato lendo de uma API/banco — nenhuma tela ou service depende da fonte concreta.
 */
export interface PedagogicalRepository {
  getMetadata(): Promise<PedagogicalRulesMetadata>;
  getExperienceFields(): Promise<ExperienceField[]>;
  getExperienceFieldById(experienceFieldId: string): Promise<ExperienceField | null>;
  getSkillById(skillId: string): Promise<Skill | null>;
  getActivitiesBySkillId(skillId: string): Promise<FamilyActivity[]>;
  getActivityById(activityId: string): Promise<FamilyActivity | null>;
  /**
   * Casa um texto normalizado (ver `normalizeForMatch`) contra os `matchTexts` cadastrados
   * de cada habilidade — usado para ligar o título de uma `Activity` importada a uma
   * habilidade do catálogo (seção 32: nunca inventa habilidade, só casa contra o que existe).
   */
  findSkillByNormalizedText(normalizedText: string): Promise<{ skill: Skill; confidence: number } | null>;
}
