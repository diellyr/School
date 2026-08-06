import { describe, expect, it } from 'vitest';
import { generateRecommendations } from './pedagogicalRecommendationService';
import { InMemoryPedagogicalRepository } from '../../../repositories/pedagogical/InMemoryPedagogicalRepository';
import { buildConflictResolutionField, buildRepository, makeActivity, makeAssessment, makeExperienceField, makeSkill, makeActivityOption, makePreferences } from './testFixtures';

describe('pedagogicalRecommendationService — orquestra análise, prioridade, seleção e explicação', () => {
  it('um único R isolado gera recomendação normal, sem tratamento de alerta grave', async () => {
    const repo = buildRepository([buildConflictResolutionField()]);
    const activity = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B1' });
    const assessment = makeAssessment({ activityId: activity.id, rboLevel: 'R' });

    const result = await generateRecommendations({
      studentId: 's1', activities: [activity], assessments: [assessment], pedagogicalRepository: repo,
    });

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].reason.toLowerCase()).not.toContain('diagnóstic');
    expect(result.weeklyPlanItems).toHaveLength(1);
  });

  it('várias habilidades em R no mesmo campo continuam individualmente visíveis nas recomendações (seção 6)', async () => {
    const skillA = makeSkill({ id: 'skill-a', matchTexts: ['habilidade a texto'], activityOptions: [makeActivityOption({ id: 'act-a1', skillId: 'skill-a' })] });
    const skillB = makeSkill({ id: 'skill-b', matchTexts: ['habilidade b texto'], activityOptions: [makeActivityOption({ id: 'act-b1', skillId: 'skill-b' })] });
    const field = makeExperienceField({ id: 'escuta_fala_pensamento_imaginacao', skills: [skillA, skillB] });
    const repo = buildRepository([field]);

    const actA = makeActivity({ title: 'Habilidade A texto', period: '2026-B1' });
    const actB = makeActivity({ title: 'Habilidade B texto', period: '2026-B1' });
    const assessments = [makeAssessment({ activityId: actA.id, rboLevel: 'R' }), makeAssessment({ activityId: actB.id, rboLevel: 'R' })];

    const result = await generateRecommendations({ studentId: 's1', activities: [actA, actB], assessments, pedagogicalRepository: repo });

    const skillIds = result.recommendations.map((r) => r.skillId).sort();
    expect(skillIds).toEqual(['skill-a', 'skill-b']);
    expect(result.analysis.fieldAnalyses[0].counts.R).toBe(2);
  });

  it('habilidade em O sem transição recente não gera recomendação (não sobrecarrega o plano)', async () => {
    const repo = buildRepository([buildConflictResolutionField()]);
    const activity = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B1' });
    const assessment = makeAssessment({ activityId: activity.id, rboLevel: 'O' });

    const result = await generateRecommendations({ studentId: 's1', activities: [activity], assessments: [assessment], pedagogicalRepository: repo });

    expect(result.recommendations).toHaveLength(0);
    expect(result.weeklyPlanItems).toHaveLength(0);
  });

  it('não repete a mesma atividade quando ela já foi recomendada recentemente e há alternativa', async () => {
    const repo = buildRepository([buildConflictResolutionField()]);
    const activity = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B1' });
    const assessment = makeAssessment({ activityId: activity.id, rboLevel: 'R' });

    const result = await generateRecommendations({
      studentId: 's1', activities: [activity], assessments: [assessment], pedagogicalRepository: repo,
      options: { recentActivityIds: new Set(['conflict-01']) },
    });

    expect(result.recommendations[0].activityId).not.toBe('conflict-01');
  });

  it('as preferências da família (dias e limite semanal) influenciam o plano gerado', async () => {
    const skillA = makeSkill({ id: 'skill-a', matchTexts: ['a'], activityOptions: [makeActivityOption({ id: 'act-a1', skillId: 'skill-a' })] });
    const skillB = makeSkill({ id: 'skill-b', matchTexts: ['b'], activityOptions: [makeActivityOption({ id: 'act-b1', skillId: 'skill-b' })] });
    const field = makeExperienceField({ id: 'eu_outro_nos', skills: [skillA, skillB] });
    const repo = buildRepository([field]);

    const actA = makeActivity({ title: 'a', period: '2026-B1' });
    const actB = makeActivity({ title: 'b', period: '2026-B1' });
    const assessments = [makeAssessment({ activityId: actA.id, rboLevel: 'R' }), makeAssessment({ activityId: actB.id, rboLevel: 'R' })];
    const preferences = makePreferences({ availableDays: ['tuesday'], maxActivitiesPerWeek: 2 });

    const result = await generateRecommendations({
      studentId: 's1', activities: [actA, actB], assessments, pedagogicalRepository: repo, options: { preferences },
    });

    expect(result.weeklyPlanItems.every((i) => i.scheduledDay === 'tuesday')).toBe(true);
  });

  it('funciona com qualquer implementação de PedagogicalRepository (repository substituível, seção 27)', async () => {
    const repo: InMemoryPedagogicalRepository = buildRepository([buildConflictResolutionField()]);
    const activity = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B1' });
    const assessment = makeAssessment({ activityId: activity.id, rboLevel: 'R' });

    // O service só depende da interface PedagogicalRepository — aqui usamos uma implementação
    // em memória em vez da implementação JSON de produção, e o resultado é o mesmo tipo de dado.
    const result = await generateRecommendations({ studentId: 's1', activities: [activity], assessments: [assessment], pedagogicalRepository: repo });
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
