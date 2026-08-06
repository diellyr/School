import type { ExperienceField, FamilyActivity, PedagogicalRules, PedagogicalRulesMetadata, Skill } from '../../domain';
import type { PedagogicalRepository } from './PedagogicalRepository';
import { matchSkillByNormalizedText } from './matchSkill';
import rulesData from '../../data/pedagogical-rules.json';

const rules = rulesData as PedagogicalRules;

/**
 * Implementação do `PedagogicalRepository` sobre `src/data/pedagogical-rules.json`. Quando o
 * conteúdo pedagógico migrar para um banco de dados real, uma `PedagogicalApiRepository`
 * implementará o mesmo contrato — nenhum service ou componente precisa mudar.
 */
export class JsonPedagogicalRepository implements PedagogicalRepository {
  async getMetadata(): Promise<PedagogicalRulesMetadata> {
    return rules.metadata;
  }

  async getExperienceFields(): Promise<ExperienceField[]> {
    return rules.experienceFields;
  }

  async getExperienceFieldById(experienceFieldId: string): Promise<ExperienceField | null> {
    return rules.experienceFields.find((f) => f.id === experienceFieldId) ?? null;
  }

  async getSkillById(skillId: string): Promise<Skill | null> {
    for (const field of rules.experienceFields) {
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
    for (const field of rules.experienceFields) {
      for (const skill of field.skills) {
        const activity = skill.activityOptions.find((a) => a.id === activityId);
        if (activity) return activity;
      }
    }
    return null;
  }

  async findSkillByNormalizedText(normalizedText: string): Promise<{ skill: Skill; confidence: number } | null> {
    return matchSkillByNormalizedText(rules.experienceFields, normalizedText);
  }
}
