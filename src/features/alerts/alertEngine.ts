import type { AlertLevel, AlertRule, Assessment } from '../../domain';
import { ALERT_LEVEL_MESSAGES } from '../../domain';

export interface AlertEvaluationInput {
  studentId: string;
  assessments: Assessment[]; // já filtradas para o aluno e com rboLevel preenchido
  periodByActivityId: Map<string, string>;
  rule: AlertRule;
}

export interface AlertEvaluationResult {
  level: AlertLevel;
  reason: string;
  recordsUsed: number;
  periodsAffected: number;
  confidence: 'baixa' | 'media' | 'alta';
  recommendations: string[];
}

/**
 * Motor de alertas simplificado (Fase 4). Nunca conclui a partir de um único registro —
 * respeita minActivitiesRequired e minPeriodsForPattern definidos na regra (configurável
 * pelo Owner em alert_rules). Ver seção 14 do briefing: alertas são sinais para
 * acompanhamento, nunca diagnóstico.
 */
export function evaluateStudentAlert({ assessments, periodByActivityId, rule }: AlertEvaluationInput): AlertEvaluationResult {
  const recordsUsed = assessments.length;

  if (recordsUsed < rule.minActivitiesRequired) {
    return {
      level: 'informativo',
      reason: ALERT_LEVEL_MESSAGES.informativo,
      recordsUsed,
      periodsAffected: 0,
      confidence: 'baixa',
      recommendations: ['Aguardar mais registros antes de qualquer análise de tendência.'],
    };
  }

  const rCount = assessments.filter((a) => a.rboLevel === 'R').length;
  const rPercent = (rCount / recordsUsed) * 100;

  if (rPercent < rule.rLevelPercentThreshold) {
    return {
      level: 'informativo',
      reason: `Os registros analisados (${recordsUsed}) não indicam um padrão de atenção no momento.`,
      recordsUsed,
      periodsAffected: 0,
      confidence: 'media',
      recommendations: ['Continuar o acompanhamento de rotina.'],
    };
  }

  const periodsWithPattern = new Set(
    assessments.filter((a) => a.rboLevel === 'R').map((a) => periodByActivityId.get(a.activityId)).filter((p): p is string => !!p),
  );
  const periodsAffected = periodsWithPattern.size;

  if (periodsAffected >= rule.minPeriodsForPattern + 1) {
    return {
      level: 'orientacao_profissional',
      reason: `Padrão de classificações Regular (${Math.round(rPercent)}% dos registros) persistiu em ${periodsAffected} períodos diferentes.`,
      recordsUsed,
      periodsAffected,
      confidence: 'alta',
      recommendations: [
        'Conversar com a coordenação pedagógica e com os professores responsáveis.',
        'Caso a preocupação permaneça, procurar um pediatra ou profissional habilitado.',
      ],
    };
  }

  if (periodsAffected >= rule.minPeriodsForPattern) {
    return {
      level: 'acompanhamento',
      reason: `Padrão de classificações Regular (${Math.round(rPercent)}% dos registros) apareceu em ${periodsAffected} períodos.`,
      recordsUsed,
      periodsAffected,
      confidence: 'media',
      recommendations: ['Criar um plano de acompanhamento conjunto entre família e escola.'],
    };
  }

  return {
    level: 'atencao',
    reason: `Foram registradas várias classificações Regular (${Math.round(rPercent)}% dos registros) neste período.`,
    recordsUsed,
    periodsAffected,
    confidence: 'media',
    recommendations: ['Conversar com o professor para entender o contexto das atividades.'],
  };
}
