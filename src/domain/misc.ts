import type { BaseEntity } from './common';

export interface Consent extends BaseEntity {
  guardianId: string;
  studentId: string;
  type: 'image_use' | 'data_processing' | 'field_trip' | 'other';
  description: string;
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  documentId?: string;
}

export type RecommendationAgeRange = '0-2' | '3-5' | '6-8' | '9-11' | '12+';

export interface Recommendation extends BaseEntity {
  title: string;
  content: string;
  ageRange: RecommendationAgeRange;
  bnccField?: string;
  subject?: string;
  category?: string;
  environment: 'school' | 'family' | 'both';
  source: string;
  sourceValidated: boolean;
  reviewedAt?: string;
  approvedBy?: string;
  published: boolean;
}

/**
 * Notificação da Central de Alertas — feed único que reúne alertas financeiros, de
 * bolsa, pedagógicos, administrativos, de importação e de sistema (ver seção 4 do
 * módulo financeiro). Diferente do `Alert` pedagógico (motor de padrão R/B/O, que
 * continua existindo do jeito que já funcionava) e do `TeacherAlert` (comunicação
 * direta professor→responsável): esta entidade é o registro central e clicável do
 * sino no topo do app. `Alert`/`TeacherAlert` ativos são mesclados aqui apenas na
 * exibição (somente leitura) — ver `notificationAggregatorService`.
 */
export type NotificationCategory = 'financial' | 'scholarship' | 'pedagogical' | 'administrative' | 'import' | 'system';

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  financial: 'Financeiro',
  scholarship: 'Bolsa',
  pedagogical: 'Pedagógico',
  administrative: 'Administrativo',
  import: 'Importação',
  system: 'Sistema',
};

export type NotificationPriority = 'informativo' | 'baixo' | 'medio' | 'alto' | 'urgente';

export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  informativo: 'Informativo',
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  urgente: 'Urgente',
};

export type NotificationStatus = 'pending' | 'resolved' | 'dismissed';

export interface Notification extends BaseEntity {
  title: string;
  description: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  studentId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  scheduledFor: string;
  readAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  notificationStatus: NotificationStatus;
  actionUrl?: string;
  recommendedAction?: string;
  source: string;
  /** Chave usada para nunca gerar o mesmo alerta duas vezes — ver notificationRulesService. */
  deduplicationKey: string;
}

export interface DataRetentionRule extends BaseEntity {
  entityType: string;
  retentionDays: number;
  action: 'archive' | 'delete';
  description?: string;
}
