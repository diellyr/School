import type { ExperienceField, FamilyActivity, PedagogicalRulesMetadata, Skill } from '../../domain';
import type { PedagogicalRepository } from './PedagogicalRepository';
import { matchSkillByNormalizedText } from './matchSkill';

/**
 * Implementação em memória do `PedagogicalRepository`, usada nos testes dos services (para não
 * depender do JSON real, que pode mudar de conteúdo) e como prova de que o contrato é
 * substituível por qualquer fonte de dados — não só o JSON de produção.
 */
export class InMemoryPedagogicalRepository implements PedagogicalRepository {
  private readonly experienceFields: ExperienceField[];
  private readonly metadata: PedagogicalRulesMetadata;

  constructor(experienceFields: ExperienceField[], metadata: PedagogicalRulesMetadata) {
    this.experienceFields = experienceFields;
    this.metadata = metadata;
  }

  async getMetadata(): Promise<PedagogicalRulesMetadata> {
    return this.metadata;
  }

  async getExperienceFields(): Promise<ExperienceField[]> {
    return this.experienceFields;
  }

  async getExperienceFieldById(experienceFieldId: string): Promise<ExperienceField | null> {
    return this.experienceFields.find((f) => f.id === experienceFieldId) ?? null;
  }

  async getSkillById(skillId: string): Promise<Skill | null> {
    for (const field of this.experienceFields) {
      const skill = field.skills.find((s) => s.id === skillId);
      if (skill) return skill;
    }
    return null;
  }

  async getActivitiesBySkillId(skillId: string): Promise<FamilyActivity[]> {
    const skill = await this.getSkillById(skillId);
    return skill?.activityOptions.filter((a) => a.active) ?? [];
  }

  async getActivityById(activityId: string): Promise<FamilyActivity | null> {
    for (const field of this.experienceFields) {
      for (const skill of field.skills) {
        const activity = skill.activityOptions.find((a) => a.id === activityId);
        if (activity) return activity;
      }
    }
    return null;
  }

  async findSkillByNormalizedText(normalizedText: string): Promise<{ skill: Skill; confidence: number } | null> {
    return matchSkillByNormalizedText(this.experienceFields, normalizedText);
  }
}
