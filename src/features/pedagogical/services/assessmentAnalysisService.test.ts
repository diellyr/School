import { describe, expect, it } from 'vitest';
import { analyzeStudentAssessments } from './assessmentAnalysisService';
import { buildConflictResolutionField, buildRepository, makeActivity, makeAssessment } from './testFixtures';

describe('assessmentAnalysisService — liga avaliações a habilidades e detecta recorrência/transição', () => {
  it('casa o título da atividade a uma habilidade cadastrada por texto normalizado (seção 32)', async () => {
    const repo = buildRepository([buildConflictResolutionField()]);
    const activity = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B1' });
    const assessment = makeAssessment({ activityId: activity.id, rboLevel: 'R' });

    const result = await analyzeStudentAssessments({ studentId: 's1', activities: [activity], assessments: [assessment], pedagogicalRepository: repo });

    expect(result.unclassified).toHaveLength(0);
    expect(result.fieldAnalyses).toHaveLength(1);
    expect(result.fieldAnalyses[0].skillAnalyses[0].skill.id).toBe('conflict-resolution');
  });

  it('não inventa habilidade quando o texto não casa com nenhuma cadastrada — fica não classificada', async () => {
    const repo = buildRepository([buildConflictResolutionField()]);
    const activity = makeActivity({ title: 'Xilofone e percussão livre com garrafas', period: '2026-B1' });
    const assessment = makeAssessment({ activityId: activity.id, rboLevel: 'R' });

    const result = await analyzeStudentAssessments({ studentId: 's1', activities: [activity], assessments: [assessment], pedagogicalRepository: repo });

    expect(result.fieldAnalyses).toHaveLength(0);
    expect(result.unclassified).toHaveLength(1);
    expect(result.unclassified[0].activityTitle).toContain('Xilofone');
  });

  it('um único registro em R conta como "first-r" (periodsObserved=1), sem recorrência', async () => {
    const repo = buildRepository([buildConflictResolutionField()]);
    const activity = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B1' });
    const assessment = makeAssessment({ activityId: activity.id, rboLevel: 'R' });

    const result = await analyzeStudentAssessments({ studentId: 's1', activities: [activity], assessments: [assessment], pedagogicalRepository: repo });
    const analysis = result.fieldAnalyses[0].skillAnalyses[0];

    expect(analysis.periodsObserved).toBe(1);
    expect(analysis.consecutiveRCount).toBe(1);
    expect(analysis.transition).toBeNull();
  });

  it('detecta R recorrente em períodos consecutivos', async () => {
    const repo = buildRepository([buildConflictResolutionField()]);
    const act1 = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B1' });
    const act2 = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B2' });
    const activities = [act1, act2];
    const assessments = [makeAssessment({ activityId: act1.id, rboLevel: 'R' }), makeAssessment({ activityId: act2.id, rboLevel: 'R' })];

    const result = await analyzeStudentAssessments({ studentId: 's1', activities, assessments, pedagogicalRepository: repo });
    const analysis = result.fieldAnalyses[0].skillAnalyses[0];

    expect(analysis.consecutiveRCount).toBe(2);
    expect(analysis.currentLevel).toBe('R');
  });

  it('detecta transição de R para B entre dois períodos', async () => {
    const repo = buildRepository([buildConflictResolutionField()]);
    const act1 = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B1' });
    const act2 = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B2' });
    const assessments = [makeAssessment({ activityId: act1.id, rboLevel: 'R' }), makeAssessment({ activityId: act2.id, rboLevel: 'B' })];

    const result = await analyzeStudentAssessments({ studentId: 's1', activities: [act1, act2], assessments, pedagogicalRepository: repo });
    const analysis = result.fieldAnalyses[0].skillAnalyses[0];

    expect(analysis.transition).toEqual({ from: 'R', to: 'B' });
    expect(analysis.currentLevel).toBe('B');
    expect(analysis.consecutiveRCount).toBe(0);
  });

  it('a ausência de avaliação em um período não é interpretada como piora — só reduz periodsObserved', async () => {
    const repo = buildRepository([buildConflictResolutionField()]);
    // Só um período avaliado (2026-B1); nenhuma atividade em 2026-B2 — não deve gerar transição negativa.
    const act1 = makeActivity({ title: 'Resolve conflitos respeitando regras e combinações.', period: '2026-B1' });
    const assessments = [makeAssessment({ activityId: act1.id, rboLevel: 'O' })];

    const result = await analyzeStudentAssessments({ studentId: 's1', activities: [act1], assessments, pedagogicalRepository: repo });
    const analysis = result.fieldAnalyses[0].skillAnalyses[0];

    expect(analysis.periodsObserved).toBe(1);
    expect(analysis.transition).toBeNull();
    expect(analysis.currentLevel).toBe('O');
  });
});
