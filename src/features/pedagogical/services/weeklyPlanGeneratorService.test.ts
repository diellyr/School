import { describe, expect, it } from 'vitest';
import { generateWeeklyPlanItems } from './weeklyPlanGeneratorService';
import { makeActivityOption, makeSkill } from './testFixtures';
import type { WeeklyPlanCandidate } from './weeklyPlanGeneratorService';

function candidate(n: number): WeeklyPlanCandidate {
  const skill = makeSkill({ id: `skill-${n}`, matchTexts: [] });
  return {
    skill,
    experienceFieldId: 'eu_outro_nos',
    activity: makeActivityOption({ id: `activity-${n}`, skillId: skill.id }),
    reason: `Motivo ${n}`,
  };
}

describe('weeklyPlanGeneratorService — plano leve, sem sobrecarga (seções 9, 10, 15)', () => {
  it('respeita o limite semanal mesmo havendo mais candidatos disponíveis', () => {
    const candidates = [1, 2, 3, 4, 5, 6, 7].map(candidate);
    const items = generateWeeklyPlanItems({ candidates, maxActivitiesPerWeek: 3 });
    expect(items).toHaveLength(3);
  });

  it('nunca gera mais que 5 atividades por semana, mesmo se maxActivitiesPerWeek for maior', () => {
    const candidates = [1, 2, 3, 4, 5, 6, 7, 8].map(candidate);
    const items = generateWeeklyPlanItems({ candidates, maxActivitiesPerWeek: 8 });
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it('não gera mais itens do que candidatos disponíveis (não inventa atividade para preencher a semana)', () => {
    const candidates = [candidate(1)];
    const items = generateWeeklyPlanItems({ candidates, maxActivitiesPerWeek: 5 });
    expect(items).toHaveLength(1);
  });

  it('cada item carrega a explicação (reason) — nunca fica sem justificativa (seção 25)', () => {
    const candidates = [candidate(1), candidate(2)];
    const items = generateWeeklyPlanItems({ candidates, maxActivitiesPerWeek: 3 });
    for (const item of items) {
      expect(item.reason).toBeTruthy();
    }
  });

  it('distribui pelos dias disponíveis configurados pela família', () => {
    const candidates = [candidate(1), candidate(2)];
    const items = generateWeeklyPlanItems({ candidates, availableDays: ['tuesday', 'thursday'], maxActivitiesPerWeek: 3 });
    expect(items.map((i) => i.scheduledDay)).toEqual(['tuesday', 'thursday']);
  });

  it('todo item começa com status "planned", nunca com penalidade ou streak (seção 15)', () => {
    const items = generateWeeklyPlanItems({ candidates: [candidate(1)], maxActivitiesPerWeek: 3 });
    expect(items[0].itemStatus).toBe('planned');
    expect(items[0]).not.toHaveProperty('streak');
    expect(items[0]).not.toHaveProperty('penalty');
  });
});
