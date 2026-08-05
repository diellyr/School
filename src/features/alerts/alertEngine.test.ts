import { describe, expect, it } from 'vitest';
import { evaluateStudentAlert } from './alertEngine';
import type { AlertRule, Assessment } from '../../domain';

const baseRule: AlertRule = {
  id: 'rule-1', organizationId: 'org-1', createdAt: '', updatedAt: '', createdBy: '', updatedBy: '', version: 1, status: 'active',
  name: 'Regra padrão', stage: 'early_childhood', minActivitiesRequired: 4, minPeriodsForPattern: 2, rLevelPercentThreshold: 50, active: true,
};

function assessment(activityId: string, rboLevel: Assessment['rboLevel']): Assessment {
  const now = '';
  return {
    id: `a-${activityId}-${Math.random()}`, organizationId: 'org-1', createdAt: now, updatedAt: now, createdBy: '', updatedBy: '', version: 1, status: 'active',
    activityId, studentId: 'student-1', stage: 'early_childhood', rboLevel, publicationStatus: 'published',
  };
}

describe('Motor de alertas — nunca conclui a partir de um único registro (seção 14)', () => {
  it('gera nível informativo quando há poucos registros, mesmo que todos sejam R', () => {
    const assessments = [assessment('act-1', 'R')];
    const periodByActivityId = new Map([['act-1', '2026-B1']]);
    const result = evaluateStudentAlert({ studentId: 's1', assessments, periodByActivityId, rule: baseRule });
    expect(result.level).toBe('informativo');
  });

  it('uma única atividade R não gera alerta de atenção mesmo com volume suficiente de outros registros O/B', () => {
    const assessments = [
      assessment('act-1', 'R'),
      assessment('act-2', 'O'),
      assessment('act-3', 'O'),
      assessment('act-4', 'B'),
    ];
    const periodByActivityId = new Map([['act-1', '2026-B1'], ['act-2', '2026-B1'], ['act-3', '2026-B1'], ['act-4', '2026-B1']]);
    const result = evaluateStudentAlert({ studentId: 's1', assessments, periodByActivityId, rule: baseRule });
    expect(result.level).toBe('informativo');
  });

  it('gera nível "atenção" quando o percentual de R é alto em um único período', () => {
    const assessments = [assessment('act-1', 'R'), assessment('act-2', 'R'), assessment('act-3', 'R'), assessment('act-4', 'O')];
    const periodByActivityId = new Map([['act-1', '2026-B1'], ['act-2', '2026-B1'], ['act-3', '2026-B1'], ['act-4', '2026-B1']]);
    const result = evaluateStudentAlert({ studentId: 's1', assessments, periodByActivityId, rule: baseRule });
    expect(result.level).toBe('atencao');
  });

  it('gera nível "acompanhamento" quando o padrão de R se repete em >= minPeriodsForPattern períodos', () => {
    const assessments = [
      assessment('act-1', 'R'), assessment('act-2', 'R'),
      assessment('act-3', 'R'), assessment('act-4', 'R'),
    ];
    const periodByActivityId = new Map([['act-1', '2026-B1'], ['act-2', '2026-B1'], ['act-3', '2026-B2'], ['act-4', '2026-B2']]);
    const result = evaluateStudentAlert({ studentId: 's1', assessments, periodByActivityId, rule: baseRule });
    expect(result.level).toBe('acompanhamento');
  });

  it('gera nível "orientação profissional" apenas quando o padrão persiste em muitos períodos e nunca soa como diagnóstico', () => {
    const assessments = [
      assessment('act-1', 'R'), assessment('act-2', 'R'), assessment('act-3', 'R'), assessment('act-4', 'R'),
    ];
    const periodByActivityId = new Map([
      ['act-1', '2026-B1'], ['act-2', '2026-B2'], ['act-3', '2026-B3'], ['act-4', '2026-B4'],
    ]);
    const result = evaluateStudentAlert({ studentId: 's1', assessments, periodByActivityId, rule: baseRule });
    expect(result.level).toBe('orientacao_profissional');
    expect(result.reason.toLowerCase()).not.toContain('diagnóstic');
    expect(result.recommendations.join(' ')).toContain('profissional habilitado');
  });
});
