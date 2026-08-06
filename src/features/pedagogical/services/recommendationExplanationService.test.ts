import { describe, expect, it } from 'vitest';
import { explainFieldConcentration, explainRecommendation } from './recommendationExplanationService';
import { makeSkill } from './testFixtures';
import type { SkillAnalysis } from './assessmentAnalysisService';
import type { SkillPriority } from './recommendationPriorityService';

const skill = makeSkill({ id: 'story-retelling', name: 'Reconto de histórias', matchTexts: ['recontar historias'] });

function analysis(overrides: Partial<SkillAnalysis> = {}): SkillAnalysis {
  return { skill, experienceFieldId: 'escuta_fala_pensamento_imaginacao', history: [], currentLevel: 'R', consecutiveRCount: 1, transition: null, periodsObserved: 1, matchConfidence: 1, ...overrides };
}

const forbiddenWords = ['diagnóstico', 'diagnostic', 'transtorno', 'atrasad', 'reprovaç', 'reprovad', 'insuficiente', 'problema grave'];

describe('recommendationExplanationService — sempre explica, nunca soa como diagnóstico (seções 15, 21, 25)', () => {
  const cases: { reasonCode: SkillPriority['reasonCode'] }[] = [
    { reasonCode: 'first-r' },
    { reasonCode: 'recurring-r' },
    { reasonCode: 'variation-to-r' },
    { reasonCode: 'reinforcement-r-to-b' },
    { reasonCode: 'variation-o-to-b' },
    { reasonCode: 'stable-attention' },
    { reasonCode: 'reinforcement-b-to-o' },
    { reasonCode: 'low-priority' },
  ];

  it.each(cases)('gera uma explicação não vazia e sem linguagem diagnóstica para reasonCode=$reasonCode', ({ reasonCode }) => {
    const priority: SkillPriority = { skillId: skill.id, score: 5, reasonCode };
    const text = explainRecommendation(analysis(), priority);

    expect(text.length).toBeGreaterThan(10);
    const lower = text.toLowerCase();
    for (const word of forbiddenWords) {
      expect(lower).not.toContain(word);
    }
  });

  it('nunca exibe apenas "Recomendado pela IA" (seção 25)', () => {
    const priority: SkillPriority = { skillId: skill.id, score: 5, reasonCode: 'first-r' };
    const text = explainRecommendation(analysis(), priority);
    expect(text.toLowerCase()).not.toBe('recomendado pela ia');
    expect(text.toLowerCase()).not.toContain('recomendado pela ia');
  });

  it('agrupa por campo só quando há concentração real (2+), não para um R isolado', () => {
    expect(explainFieldConcentration('Escuta, fala, pensamento e imaginação', 1)).toBeNull();
    expect(explainFieldConcentration('Escuta, fala, pensamento e imaginação', 2)).toContain('Escuta, fala, pensamento e imaginação');
  });
});
