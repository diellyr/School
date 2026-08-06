import type { SkillAnalysis } from './assessmentAnalysisService';

/**
 * Motivo interno de priorização — usado pelo `recommendationExplanationService` para gerar o
 * texto mostrado à família, e pela seleção de atividades. Nunca exibido como "pontuação" ao
 * usuário (seção 12: a pontuação é só um mecanismo interno de ordenação).
 */
export type PriorityReasonCode =
  | 'first-r'
  | 'recurring-r'
  | 'variation-to-r'
  | 'reinforcement-r-to-b'
  | 'variation-o-to-b'
  | 'stable-attention'
  | 'reinforcement-b-to-o'
  | 'low-priority';

export interface SkillPriority {
  skillId: string;
  score: number;
  reasonCode: PriorityReasonCode;
}

/**
 * Calcula a prioridade interna de uma habilidade para entrar no plano semanal. Implementa os
 * 7 casos da seção 11 do briefing pedagógico: nunca trata R isolado como grave, aumenta
 * prioridade com recorrência real (não com um único salto), reduz prioridade após evolução e
 * nunca soa como diagnóstico em mudanças B→R ou O→B (tratadas como "variação observada").
 *
 * `fieldRCount`: quantas outras habilidades do mesmo campo de experiência também estão em R
 * atualmente — usado para dar um pequeno peso extra quando o campo inteiro concentra atenção
 * (seção 6: agrupar, não gerar N alertas independentes).
 */
export function calculateSkillPriority(analysis: SkillAnalysis, fieldRCount: number): SkillPriority {
  const { currentLevel, consecutiveRCount, periodsObserved, transition } = analysis;

  if (currentLevel === 'R') {
    if (periodsObserved === 1) {
      return { skillId: analysis.skill.id, score: 10, reasonCode: 'first-r' };
    }
    if (consecutiveRCount >= 2) {
      // Peso cresce com a recorrência real (períodos consecutivos), não com o volume de R soltos.
      const recurrenceWeight = Math.min(consecutiveRCount, 4) * 8;
      const concentrationWeight = Math.min(fieldRCount, 5) * 2;
      return { skillId: analysis.skill.id, score: 10 + recurrenceWeight + concentrationWeight, reasonCode: 'recurring-r' };
    }
    // Só virou R agora (veio de B ou O) — tratar como variação a observar, não como padrão.
    return { skillId: analysis.skill.id, score: 8, reasonCode: 'variation-to-r' };
  }

  if (currentLevel === 'B') {
    if (transition?.from === 'R') {
      // Reforço leve, não prioridade máxima — o objetivo é consolidar, não repetir como antes.
      return { skillId: analysis.skill.id, score: 4, reasonCode: 'reinforcement-r-to-b' };
    }
    if (transition?.from === 'O') {
      return { skillId: analysis.skill.id, score: 2, reasonCode: 'variation-o-to-b' };
    }
    return { skillId: analysis.skill.id, score: 1, reasonCode: 'stable-attention' };
  }

  // currentLevel === 'O'
  if (transition?.from === 'B') {
    return { skillId: analysis.skill.id, score: 0, reasonCode: 'reinforcement-b-to-o' };
  }
  return { skillId: analysis.skill.id, score: 0, reasonCode: 'low-priority' };
}

export function rankSkillPriorities(
  analyses: SkillAnalysis[],
  fieldRCountBySkillId: (skillId: string) => number,
): { analysis: SkillAnalysis; priority: SkillPriority }[] {
  return analyses
    .map((analysis) => ({ analysis, priority: calculateSkillPriority(analysis, fieldRCountBySkillId(analysis.skill.id)) }))
    .sort((a, b) => b.priority.score - a.priority.score);
}
