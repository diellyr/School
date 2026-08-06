import type { SkillAnalysis } from './assessmentAnalysisService';
import type { SkillPriority } from './recommendationPriorityService';

/**
 * Gera a justificativa em linguagem simples mostrada à família para cada recomendação — nunca
 * "Recomendado pela IA" (seção 25), sempre um critério compreensível, e nunca linguagem
 * diagnóstica (seção 15/23), mesmo em quedas de nível (seção 11, casos 6 e 7).
 */
export function explainRecommendation(analysis: SkillAnalysis, priority: SkillPriority): string {
  const skillName = analysis.skill.name.toLowerCase();
  switch (priority.reasonCode) {
    case 'first-r':
      return `Recomendamos esta atividade porque a habilidade "${analysis.skill.name}" foi classificada como em desenvolvimento no relatório atual.`;
    case 'recurring-r':
      return `Esta habilidade permaneceu classificada como em desenvolvimento em ${analysis.consecutiveRCount} períodos consecutivos e, por isso, recebeu maior prioridade no plano.`;
    case 'variation-to-r':
      return `Notamos uma variação neste resultado em relação ao período anterior — ${skillName} passou a aparecer como em desenvolvimento. Isso pode acontecer por diferentes motivos (mudança de período, de atividade ou de contexto); vale observar os próximos períodos antes de tirar conclusões. Como essa habilidade apareceu em desenvolvimento em mais de um período, pode ser útil conversar com a equipe escolar para compreender melhor as observações e alinhar formas de apoio.`;
    case 'reinforcement-r-to-b':
      return `Esta habilidade evoluiu de Em desenvolvimento para Bom. Incluímos uma atividade leve de reforço para ajudar a consolidar essa evolução.`;
    case 'variation-o-to-b':
      return `Notamos uma variação neste resultado — ${skillName} passou de Ótimo para Bom. Isso não costuma indicar perda de capacidade; vale apenas observar os próximos períodos.`;
    case 'stable-attention':
      return `Esta habilidade está classificada como Bom. Uma atividade ocasional pode ajudar a continuar fortalecendo esse resultado.`;
    case 'reinforcement-b-to-o':
      return `Esta habilidade evoluiu de Bom para Ótimo. Excelente progresso — ela não precisa mais de prioridade no plano semanal.`;
    default:
      return `Esta atividade foi selecionada com base no acompanhamento mais recente da habilidade "${analysis.skill.name}".`;
  }
}

/** Mensagem de agrupamento por campo de experiência (seção 6) — só aparece quando há
 *  concentração real (2+ habilidades em R no mesmo campo), nunca para um R isolado. */
export function explainFieldConcentration(fieldName: string, currentRCount: number): string | null {
  if (currentRCount < 2) return null;
  return `Área com maior oportunidade de acompanhamento: ${fieldName}.`;
}

/** Explica por que uma atividade específica (não só a habilidade) foi escolhida dentro da
 *  biblioteca — usado quando a atividade substituiu outra recente ou respeita uma preferência. */
export function explainActivityChoice(input: { replacedRecent: boolean; matchedPreference: boolean }): string | null {
  if (input.replacedRecent) return 'Esta opção substituiu outra atividade que foi realizada recentemente, para variar a experiência.';
  if (input.matchedPreference) return 'Escolhemos esta atividade porque ela combina com as preferências configuradas pela família.';
  return null;
}
