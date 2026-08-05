import type { BaseEntity } from './common';

/** Nível de um alerta gerado pelo motor educacional. Nunca é diagnóstico. */
export type AlertLevel = 'informativo' | 'atencao' | 'acompanhamento' | 'orientacao_profissional';

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  informativo: 'Informativo',
  atencao: 'Atenção',
  acompanhamento: 'Acompanhamento',
  orientacao_profissional: 'Orientação profissional',
};

export const ALERT_LEVEL_MESSAGES: Record<AlertLevel, string> = {
  informativo:
    'Existem poucos registros neste período. Ainda não há dados suficientes para identificar uma tendência.',
  atencao:
    'Foram registradas várias classificações abaixo do esperado nesta categoria durante o período. Considere conversar com o professor para entender o contexto das atividades.',
  acompanhamento:
    'O mesmo padrão apareceu em dois ou mais períodos. Recomenda-se criar um plano de acompanhamento conjunto entre família e escola.',
  orientacao_profissional:
    'Há um padrão persistente registrado em diferentes contextos. Este sistema não realiza diagnóstico. Converse com a coordenação, com os professores e, caso a preocupação permaneça, procure um pediatra ou profissional habilitado.',
};

/** Regras configuráveis pelo Owner — nenhum limiar fica fixo no código de negócio. */
export interface AlertRule extends BaseEntity {
  schoolId?: string; // nulo = regra padrão da organização
  name: string;
  stage: 'early_childhood' | 'elementary' | 'both';
  minActivitiesRequired: number;
  minPeriodsForPattern: number;
  rLevelPercentThreshold: number; // % de R que dispara "atenção"
  active: boolean;
  description?: string;
}

export type AlertStatus = 'active' | 'under_review' | 'contested' | 'resolved' | 'dismissed';

export interface Alert extends BaseEntity {
  studentId: string;
  ruleId?: string;
  level: AlertLevel;
  reason: string;
  periodStart: string;
  periodEnd: string;
  recordsUsed: number;
  confidence: 'baixa' | 'media' | 'alta';
  recommendations: string[];
  analyzedBy?: string;
  alertStatus: AlertStatus;
  contestNote?: string;
}

export interface AlertAcknowledgement extends BaseEntity {
  alertId: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
  note?: string;
}

/** Alertas enviados por professores diretamente aos responsáveis (central de comunicação). */
export type TeacherAlertPriority = 'baixa' | 'media' | 'alta';
export type TeacherAlertStatus =
  | 'draft'
  | 'published'
  | 'read'
  | 'answered'
  | 'in_progress'
  | 'resolved'
  | 'archived';

export interface TeacherAlert extends BaseEntity {
  studentId: string;
  teacherId: string;
  date: string;
  category: string;
  title: string;
  description: string;
  priority: TeacherAlertPriority;
  suggestedAction?: string;
  dueDate?: string;
  attachmentIds?: string[];
  visibleToGuardianIds: string[];
  teacherAlertStatus: TeacherAlertStatus;
  readAt?: string;
  readBy?: string;
  guardianResponse?: string;
  guardianRespondedAt?: string;
}
