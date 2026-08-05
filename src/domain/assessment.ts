import type { BaseEntity, EducationStage } from './common';

/** Campos de experiência da BNCC (Educação Infantil). */
export type BnccField =
  | 'eu_outro_nos'
  | 'corpo_gestos_movimentos'
  | 'tracos_sons_cores_formas'
  | 'escuta_fala_pensamento_imaginacao'
  | 'espacos_tempos_quantidades_relacoes';

export const BNCC_FIELD_LABELS: Record<BnccField, string> = {
  eu_outro_nos: 'O eu, o outro e o nós',
  corpo_gestos_movimentos: 'Corpo, gestos e movimentos',
  tracos_sons_cores_formas: 'Traços, sons, cores e formas',
  escuta_fala_pensamento_imaginacao: 'Escuta, fala, pensamento e imaginação',
  espacos_tempos_quantidades_relacoes: 'Espaços, tempos, quantidades, relações e transformações',
};

/** Escala R/B/O da Educação Infantil. Valores auxiliares 1/2/3 só para uso interno em gráficos. */
export type RboLevel = 'R' | 'B' | 'O';
export const RBO_INTERNAL_VALUE: Record<RboLevel, number> = { R: 1, B: 2, O: 3 };
export const RBO_LABELS: Record<RboLevel, string> = {
  R: 'Regular',
  B: 'Bom',
  O: 'Ótimo',
};

/**
 * Escala de avaliação configurável para o Ensino Fundamental.
 * A ordem/significado de cada nível é definido pelo administrador/Owner — nunca fixo no código.
 */
export interface AssessmentScale extends BaseEntity {
  schoolId: string;
  stage: EducationStage;
  name: string; // ex.: "Conceitos A-E", "Notas 0-10"
  type: 'concept' | 'numeric' | 'pass_fail' | 'custom';
  levels: ScaleLevel[]; // ordenados do pior para o melhor (definido pelo admin)
  minValue?: number;
  maxValue?: number;
  isDefault: boolean;
}

export interface ScaleLevel {
  code: string; // "A", "10", "Aprovado"
  label: string;
  order: number; // 1 = pior, N = melhor
  numericEquivalent?: number;
}

export type ActivityCategoryKind = 'bncc_field' | 'custom';

export interface AssessmentCategory extends BaseEntity {
  schoolId: string;
  stage: EducationStage;
  kind: ActivityCategoryKind;
  bnccField?: BnccField;
  name: string; // categoria personalizada, ex. "Socialização"
  description?: string;
}

export type ActivityType =
  | 'prova'
  | 'trabalho'
  | 'projeto'
  | 'atividade'
  | 'participacao'
  | 'leitura'
  | 'producao_textual'
  | 'avaliacao_pratica'
  | 'recuperacao'
  | 'outro';

export interface Activity extends BaseEntity {
  schoolId: string;
  classId: string;
  academicYearId: string;
  stage: EducationStage;
  title: string;
  description?: string;
  categoryId?: string; // Educação Infantil
  subject?: string; // Ensino Fundamental
  type: ActivityType;
  date: string;
  period: string; // ex. "2026-B2" (bimestre 2), "2026-03" (mensal)
  createdByTeacherId: string;
  weight?: number;
  maxScore?: number;
  minScore?: number;
}

export type PublicationStatus = 'draft' | 'submitted' | 'published';

/** Avaliação individual de um aluno em uma atividade. */
export interface Assessment extends BaseEntity {
  activityId: string;
  studentId: string;
  stage: EducationStage;
  rboLevel?: RboLevel; // Educação Infantil
  scaleId?: string; // Ensino Fundamental
  scaleLevelCode?: string;
  numericScore?: number;
  comments?: string;
  publicationStatus: PublicationStatus;
  publishedAt?: string;
  approvedBy?: string;
}

/** Nota consolidada por disciplina/período (Ensino Fundamental), separada da avaliação individual. */
export interface Grade extends BaseEntity {
  studentId: string;
  classId: string;
  subject: string;
  period: string; // bimestre/trimestre/semestre
  scaleId: string;
  scaleLevelCode?: string;
  numericScore?: number;
  isRecovery: boolean;
  teacherComments?: string;
  publicationStatus: PublicationStatus;
}
