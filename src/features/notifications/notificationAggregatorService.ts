import type { Alert, Notification, NotificationCategory, NotificationPriority } from '../../domain';
import { ALERT_LEVEL_LABELS } from '../../domain';

/**
 * Item unificado exibido na Central de Alertas. A tabela `notifications` é a fonte
 * nativa (com leitura/resolução reais); os alertas pedagógicos (`Alert`, motor R/B/O,
 * que já tem tela própria em /alertas) são mesclados aqui SOMENTE PARA EXIBIÇÃO —
 * a tabela não é duplicada nem alterada, e "resolver" um item mesclado abre a tela de
 * origem (onde o fluxo de contestação/resolução já existe) em vez de simular um estado
 * que o `Alert` não possui. `TeacherAlert` (comunicação professor→responsável) já
 * existia no schema sem nenhuma tela própria antes desta versão — continua assim,
 * fora do escopo deste módulo financeiro.
 */
export interface UnifiedAlertItem {
  id: string;
  title: string;
  description: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  studentId?: string;
  scheduledFor: string;
  read: boolean;
  resolved: boolean;
  actionUrl?: string;
  source: 'notification' | 'pedagogical_alert';
  originalId: string;
}

const ALERT_LEVEL_TO_PRIORITY: Record<Alert['level'], NotificationPriority> = {
  informativo: 'informativo',
  atencao: 'medio',
  acompanhamento: 'alto',
  orientacao_profissional: 'urgente',
};

export function mapNotificationToUnified(n: Notification): UnifiedAlertItem {
  return {
    id: `notification:${n.id}`,
    title: n.title,
    description: n.description,
    category: n.category,
    priority: n.priority,
    studentId: n.studentId,
    scheduledFor: n.scheduledFor,
    read: !!n.readAt,
    resolved: n.notificationStatus !== 'pending',
    actionUrl: n.actionUrl,
    source: 'notification',
    originalId: n.id,
  };
}

export function mapPedagogicalAlertToUnified(alert: Alert): UnifiedAlertItem {
  return {
    id: `pedagogical_alert:${alert.id}`,
    title: `Alerta pedagógico — ${ALERT_LEVEL_LABELS[alert.level]}`,
    description: alert.reason,
    category: 'pedagogical',
    priority: ALERT_LEVEL_TO_PRIORITY[alert.level],
    studentId: alert.studentId,
    scheduledFor: alert.createdAt,
    read: true,
    resolved: alert.alertStatus === 'resolved' || alert.alertStatus === 'dismissed',
    actionUrl: '/alertas',
    source: 'pedagogical_alert',
    originalId: alert.id,
  };
}
