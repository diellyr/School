import type { BaseEntity } from './common';
import type { BnccField } from './assessment';

/**
 * Domínio da recomendação pedagógica para famílias (Educação Infantil, até 5 anos e 11 meses).
 * Todo o CONTEÚDO (campos, habilidades, orientações, atividades) vive em
 * `src/data/pedagogical-rules.json` e é lido só através de `PedagogicalRepository` — nada aqui é
 * hardcoded na interface. Ver docs/pedagogical-recommendations.md para a arquitetura completa.
 */

export type AgeGroup = '0-1' | '1-2' | '2-3' | '3-4' | '4-5';

export type PedagogicalSourceType = 'official-framework' | 'school-indicator' | 'pedagogical-interpretation' | 'application-suggestion';

export interface PedagogicalSource {
  institution: string;
  framework: string;
  document: string;
  experienceField?: string | null;
  reference?: string | null;
  sourceType: PedagogicalSourceType;
}

export interface FamilyGuidance {
  importance: string;
  howToHelp: string[];
  generalRecommendations: string[];
  recommendedFrequencyPerWeek: number;
  estimatedMinutesMin: number;
  estimatedMinutesMax: number;
}

export type ActivityDifficulty = 'easy' | 'medium' | 'hard';
export type ActivityEnvironment = 'home' | 'outdoor' | 'either';
export type MaterialLevel = 'none' | 'basic' | 'some';

/** Atividade prática sugerida à família — pertence a uma biblioteca reutilizável por habilidade,
 *  nunca embutida na avaliação da criança (ver seção 3 do briefing pedagógico). */
export interface FamilyActivity {
  id: string;
  skillId: string;
  title: string;
  shortDescription: string;
  objective: string;
  instructions: string[];
  ageGroups: AgeGroup[];
  durationMinutes: number;
  materials: string[];
  materialLevel: MaterialLevel;
  difficulty: ActivityDifficulty;
  environment: ActivityEnvironment;
  activityType: string;
  requiresAdult: boolean;
  tags: string[];
  active: boolean;
}

/** Habilidade observável — mais granular que o Campo de Experiência, referenciada pelas
 *  avaliações através de `skillId` (nunca por texto solto). */
export interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string;
  keywords: string[];
  /** Textos normalizados conhecidos vindos de relatórios escolares reais, usados para casar o
   *  título de uma Activity a esta habilidade (seção 32) — nunca inventados. */
  matchTexts: string[];
  ageGroups: AgeGroup[];
  bnccReference: string | null;
  source: PedagogicalSource;
  familyGuidance: FamilyGuidance;
  activityOptions: FamilyActivity[];
}

export interface ExperienceField {
  id: BnccField;
  slug: string;
  name: string;
  description: string;
  source: PedagogicalSource;
  skills: Skill[];
}

export interface PedagogicalRulesMetadata {
  version: string;
  schemaVersion: number;
  framework: string;
  country: string;
  language: string;
  ageGroups: AgeGroup[];
  status: 'draft' | 'published';
  lastUpdatedAt: string;
}

export interface PedagogicalRules {
  metadata: PedagogicalRulesMetadata;
  experienceFields: ExperienceField[];
}

// --- Entidades persistidas localmente (IndexedDB), separadas do conteúdo pedagógico ---

export type ActivityHistoryStatus = 'planned' | 'completed' | 'skipped' | 'replaced' | 'postponed' | 'unavailable' | 'removed';
export type ParentFeedback = 'liked' | 'neutral' | 'disliked' | 'wantsRepeat' | 'tooEasy' | 'tooDifficult' | 'tooLong' | 'lackedMaterials';
export type ChildReaction = 'engaged' | 'neutral' | 'resistant' | 'unknown';

/** Uma execução (ou tentativa) real de uma FamilyActivity por uma criança — nunca contém o
 *  conteúdo da atividade em si, só a referência (`activityId`). */
export interface ActivityHistory extends BaseEntity {
  studentId: string;
  activityId: string;
  skillId: string;
  experienceFieldId: BnccField;
  weeklyPlanId?: string;
  weeklyPlanItemId?: string;
  recommendationReason: string;
  recommendedAt: string;
  scheduledDate?: string;
  completedAt?: string;
  historyStatus: ActivityHistoryStatus;
  duration?: number;
  parentFeedback?: ParentFeedback;
  childReaction?: ChildReaction;
  notes?: string;
  sourceAssessmentIds: string[];
  pedagogicalRulesVersion: string;
}

/** Registro de toda recomendação gerada, mesmo que nunca executada — usado para evitar
 *  repetição e para entender quais sugestões funcionam melhor (seção 17). */
export interface RecommendationHistory extends BaseEntity {
  studentId: string;
  activityId: string;
  skillId: string;
  weeklyPlanId?: string;
  recommendedAt: string;
  reason: string;
  priorityScore: number;
  accepted: boolean;
  replaced: boolean;
  ignored: boolean;
  completed: boolean;
  pedagogicalRulesVersion: string;
}

export type WeeklyPlanItemStatus = 'planned' | 'completed' | 'skipped' | 'replaced';

export interface WeeklyPlanItem {
  id: string;
  activityId: string;
  skillId: string;
  experienceFieldId: BnccField;
  scheduledDay?: string; // ex.: "monday"
  reason: string;
  itemStatus: WeeklyPlanItemStatus;
}

export interface WeeklyPlan extends BaseEntity {
  studentId: string;
  weekStart: string; // segunda-feira da semana, YYYY-MM-DD
  items: WeeklyPlanItem[];
  pedagogicalRulesVersion: string;
}

export interface FamilyPreferences extends BaseEntity {
  studentId: string;
  availableDays: string[];
  maxActivitiesPerWeek: number;
  maxMinutesPerActivity: number;
  availableMaterials: string[];
  preferredActivityTypes: string[];
  avoidActivityTypes: string[];
  preferredEnvironment: ActivityEnvironment;
  avoidRepeatWeeks: number;
}
