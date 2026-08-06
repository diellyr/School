import type { ExperienceField, Skill } from '../../domain';
import { normalizeSentence } from '../../lib/utils';

const MIN_MATCH_CONFIDENCE = 0.6;

function wordOverlapConfidence(a: string, b: string): number {
  const wordsA = new Set(a.split(' ').filter(Boolean));
  const wordsB = b.split(' ').filter(Boolean);
  if (wordsB.length === 0) return 0;
  const shared = wordsB.filter((w) => wordsA.has(w)).length;
  return shared / wordsB.length;
}

/**
 * Casa um texto já normalizado contra os `matchTexts` de todas as habilidades de todos os
 * campos, retornando a melhor correspondência acima do limiar mínimo — ou `null` quando não há
 * correspondência segura (a atividade fica "não classificada", nunca uma habilidade inventada).
 * Compartilhado entre `JsonPedagogicalRepository` (produção) e fixtures de teste, para que o
 * comportamento de casamento seja idêntico nos dois.
 */
export function matchSkillByNormalizedText(
  experienceFields: ExperienceField[],
  normalizedText: string,
): { skill: Skill; confidence: number } | null {
  let best: { skill: Skill; confidence: number } | null = null;
  for (const field of experienceFields) {
    for (const skill of field.skills) {
      for (const matchText of skill.matchTexts) {
        const normalizedMatchText = normalizeSentence(matchText);
        let confidence = 0;
        if (normalizedText === normalizedMatchText) {
          confidence = 1;
        } else if (normalizedText.includes(normalizedMatchText) || normalizedMatchText.includes(normalizedText)) {
          confidence = 0.85;
        } else {
          confidence = wordOverlapConfidence(normalizedText, normalizedMatchText);
        }
        if (confidence > (best?.confidence ?? 0)) {
          best = { skill, confidence };
        }
      }
    }
  }
  if (!best || best.confidence < MIN_MATCH_CONFIDENCE) return null;
  return best;
}
