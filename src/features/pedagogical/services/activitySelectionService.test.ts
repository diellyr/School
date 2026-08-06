import { describe, expect, it } from 'vitest';
import { selectActivitiesForSkill } from './activitySelectionService';
import { makeActivityOption, makePreferences } from './testFixtures';

describe('activitySelectionService — evita repetição e respeita preferências (seções 13 e 14)', () => {
  it('a mesma atividade não é repetida imediatamente quando há alternativa disponível', () => {
    const a = makeActivityOption({ id: 'a1', skillId: 'skill-1', title: 'Atividade A' });
    const b = makeActivityOption({ id: 'a2', skillId: 'skill-1', title: 'Atividade B' });

    const result = selectActivitiesForSkill({ activities: [a, b], recentActivityIds: new Set(['a1']), count: 1 });

    expect(result[0].activity.id).toBe('a2');
    expect(result[0].wasForcedRepeat).toBe(false);
  });

  it('quando todas as opções estão recentes, permite repetir em vez de ficar sem nenhuma sugestão', () => {
    const a = makeActivityOption({ id: 'a1', skillId: 'skill-1' });
    const result = selectActivitiesForSkill({ activities: [a], recentActivityIds: new Set(['a1']), count: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].wasForcedRepeat).toBe(true);
  });

  it('uma atividade indisponível por falta de material (fora das preferências) não é selecionada quando há alternativa', () => {
    const needsPaint = makeActivityOption({ id: 'a1', skillId: 'skill-1', materials: ['tinta'], materialLevel: 'basic' });
    const noMaterials = makeActivityOption({ id: 'a2', skillId: 'skill-1', materials: [], materialLevel: 'none' });
    const preferences = makePreferences({ availableMaterials: ['papel', 'lápis'] });

    const result = selectActivitiesForSkill({ activities: [needsPaint, noMaterials], recentActivityIds: new Set(), preferences, count: 1 });

    expect(result[0].activity.id).toBe('a2');
  });

  it('o limite de tempo máximo por atividade da família é respeitado quando possível', () => {
    const long = makeActivityOption({ id: 'a1', skillId: 'skill-1', durationMinutes: 30 });
    const short = makeActivityOption({ id: 'a2', skillId: 'skill-1', durationMinutes: 10 });
    const preferences = makePreferences({ maxMinutesPerActivity: 15 });

    const result = selectActivitiesForSkill({ activities: [long, short], recentActivityIds: new Set(), preferences, count: 2 });

    expect(result.map((r) => r.activity.id)).toEqual(['a2']);
  });

  it('atividade marcada como "não gostamos" (avoidActivityTypes) recebe penalização e é evitada', () => {
    const disliked = makeActivityOption({ id: 'a1', skillId: 'skill-1', activityType: 'music' });
    const liked = makeActivityOption({ id: 'a2', skillId: 'skill-1', activityType: 'storytelling' });
    const preferences = makePreferences({ avoidActivityTypes: ['music'] });

    const result = selectActivitiesForSkill({ activities: [disliked, liked], recentActivityIds: new Set(), preferences, count: 2 });

    expect(result.map((r) => r.activity.id)).toEqual(['a2']);
  });

  it('preferências de tipo de atividade influenciam a ordem, sem impedir ver outras opções', () => {
    const other = makeActivityOption({ id: 'a1', skillId: 'skill-1', activityType: 'music' });
    const preferred = makeActivityOption({ id: 'a2', skillId: 'skill-1', activityType: 'storytelling' });
    const preferences = makePreferences({ preferredActivityTypes: ['storytelling'] });

    const result = selectActivitiesForSkill({ activities: [other, preferred], recentActivityIds: new Set(), preferences, count: 2 });

    expect(result[0].activity.id).toBe('a2');
    expect(result).toHaveLength(2); // a outra opção continua disponível, só não vem primeiro
  });

  it('filtra por faixa etária quando há opções compatíveis', () => {
    const forOlder = makeActivityOption({ id: 'a1', skillId: 'skill-1', ageGroups: ['3-4'] });
    const forTarget = makeActivityOption({ id: 'a2', skillId: 'skill-1', ageGroups: ['4-5'] });

    const result = selectActivitiesForSkill({ activities: [forOlder, forTarget], recentActivityIds: new Set(), childAgeGroup: '4-5', count: 2 });

    expect(result.map((r) => r.activity.id)).toEqual(['a2']);
  });
});
