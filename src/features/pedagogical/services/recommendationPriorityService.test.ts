import { describe, expect, it } from 'vitest';
import { calculateSkillPriority } from './recommendationPriorityService';
import { makeSkill } from './testFixtures';
import type { SkillAnalysis } from './assessmentAnalysisService';

const skill = makeSkill({ id: 'story-retelling', matchTexts: ['recontar historias'] });

function analysis(overrides: Partial<SkillAnalysis>): SkillAnalysis {
  return {
    skill,
    experienceFieldId: 'escuta_fala_pensamento_imaginacao',
    history: [],
    currentLevel: 'R',
    consecutiveRCount: 1,
    transition: null,
    periodsObserved: 1,
    matchConfidence: 1,
    ...overrides,
  };
}

describe('recommendationPriorityService — implementa os 7 casos da seção 11 sem soar como diagnóstico', () => {
  it('caso 1: primeiro R gera prioridade moderada, não altíssima', () => {
    const result = calculateSkillPriority(analysis({ periodsObserved: 1, consecutiveRCount: 1, currentLevel: 'R', transition: null }), 0);
    expect(result.reasonCode).toBe('first-r');
    expect(result.score).toBeGreaterThan(0);
  });

  it('caso 2/3: R recorrente em mais períodos aumenta a prioridade progressivamente', () => {
    const twoR = calculateSkillPriority(analysis({ periodsObserved: 2, consecutiveRCount: 2, currentLevel: 'R', transition: { from: 'R', to: 'R' } }), 0);
    const fourR = calculateSkillPriority(analysis({ periodsObserved: 4, consecutiveRCount: 4, currentLevel: 'R', transition: { from: 'R', to: 'R' } }), 0);
    expect(twoR.reasonCode).toBe('recurring-r');
    expect(fourR.reasonCode).toBe('recurring-r');
    expect(fourR.score).toBeGreaterThan(twoR.score);
  });

  it('caso 4: R -> B recebe reforço leve, não prioridade máxima', () => {
    const rToB = calculateSkillPriority(analysis({ periodsObserved: 2, consecutiveRCount: 0, currentLevel: 'B', transition: { from: 'R', to: 'B' } }), 0);
    const recurringR = calculateSkillPriority(analysis({ periodsObserved: 3, consecutiveRCount: 3, currentLevel: 'R', transition: { from: 'R', to: 'R' } }), 0);
    expect(rToB.reasonCode).toBe('reinforcement-r-to-b');
    expect(rToB.score).toBeGreaterThan(0);
    expect(rToB.score).toBeLessThan(recurringR.score);
  });

  it('caso 5: B -> O perde a prioridade (score zero)', () => {
    const result = calculateSkillPriority(analysis({ periodsObserved: 2, consecutiveRCount: 0, currentLevel: 'O', transition: { from: 'B', to: 'O' } }), 0);
    expect(result.reasonCode).toBe('reinforcement-b-to-o');
    expect(result.score).toBe(0);
  });

  it('caso 6: B -> R não é tratado como recorrência grave — vira "variação", com prioridade menor que R recorrente real', () => {
    const variation = calculateSkillPriority(analysis({ periodsObserved: 2, consecutiveRCount: 1, currentLevel: 'R', transition: { from: 'B', to: 'R' } }), 0);
    const recurring = calculateSkillPriority(analysis({ periodsObserved: 3, consecutiveRCount: 3, currentLevel: 'R', transition: { from: 'R', to: 'R' } }), 0);
    expect(variation.reasonCode).toBe('variation-to-r');
    expect(variation.score).toBeLessThan(recurring.score);
  });

  it('caso 7: O -> B não gera alerta, só uma prioridade baixa de observação', () => {
    const result = calculateSkillPriority(analysis({ periodsObserved: 2, consecutiveRCount: 0, currentLevel: 'B', transition: { from: 'O', to: 'B' } }), 0);
    expect(result.reasonCode).toBe('variation-o-to-b');
    expect(result.score).toBeLessThan(5);
  });

  it('concentração no mesmo campo aumenta moderadamente a prioridade de um R recorrente', () => {
    const isolated = calculateSkillPriority(analysis({ periodsObserved: 3, consecutiveRCount: 3, currentLevel: 'R', transition: { from: 'R', to: 'R' } }), 0);
    const concentrated = calculateSkillPriority(analysis({ periodsObserved: 3, consecutiveRCount: 3, currentLevel: 'R', transition: { from: 'R', to: 'R' } }), 5);
    expect(concentrated.score).toBeGreaterThan(isolated.score);
  });
});
