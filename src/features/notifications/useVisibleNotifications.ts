import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useAuthStore } from '../../auth/authStore';
import { useCurrentRole, usePermission } from '../../auth/usePermission';
import { mapNotificationToUnified, mapPedagogicalAlertToUnified, type UnifiedAlertItem } from './notificationAggregatorService';

/**
 * Lista de alertas visíveis para o usuário logado — a filtragem por aluno (responsável/
 * aluno só veem os próprios) e por categoria (financeiro/bolsa exigem permissão
 * específica, nunca só esconder botão) acontece aqui, centralizada, e é reaproveitada
 * pelo sino do cabeçalho e pela página completa da Central de Alertas.
 */
export function useVisibleNotifications(): UnifiedAlertItem[] | undefined {
  const role = useCurrentRole();
  const session = useAuthStore((s) => s.session);
  const canViewFinancial = usePermission('financial', 'view');
  const canViewScholarship = usePermission('scholarships', 'view');

  return useLiveQuery(async () => {
    if (!session) return [];
    const [notifications, pedagogicalAlerts] = await Promise.all([
      db.notifications.filter((n) => n.status === 'active').toArray(),
      db.alerts.filter((a) => a.status === 'active' && a.alertStatus === 'active').toArray(),
    ]);

    let items: UnifiedAlertItem[] = [
      ...notifications.map(mapNotificationToUnified),
      ...pedagogicalAlerts.map(mapPedagogicalAlertToUnified),
    ];

    items = items.filter((item) => {
      if (item.category === 'financial' && !canViewFinancial) return false;
      if (item.category === 'scholarship' && !canViewScholarship) return false;
      return true;
    });

    if (role === 'guardian' && session.user.guardianId) {
      const links = await db.studentGuardians.filter((l) => l.guardianId === session.user.guardianId && l.status === 'active').toArray();
      const ids = new Set(links.map((l) => l.studentId));
      items = items.filter((item) => item.studentId && ids.has(item.studentId));
    } else if (role === 'student' && session.user.studentId) {
      items = items.filter((item) => item.studentId === session.user.studentId);
    }

    return items.sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
  }, [role, session?.user.guardianId, session?.user.studentId, canViewFinancial, canViewScholarship]);
}
