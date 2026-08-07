import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { formatDateTime } from '../../lib/utils';
import { useVisibleNotifications } from './useVisibleNotifications';
import type { UnifiedAlertItem } from './notificationAggregatorService';

const PRIORITY_TONE = { informativo: 'default', baixo: 'default', medio: 'info', alto: 'warning', urgente: 'danger' } as const;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const navigate = useNavigate();
  const items = useVisibleNotifications();

  const pending = (items ?? []).filter((i) => !i.resolved);
  const unread = pending.filter((i) => !i.read);
  const hasUrgent = unread.some((i) => i.priority === 'urgente');

  async function handleItemClick(item: UnifiedAlertItem) {
    if (item.source === 'notification' && !item.read && session) {
      await repositories.notifications.markRead(item.originalId, { userId: session.user.id, organizationId: session.user.organizationId });
    }
    setOpen(false);
    if (item.actionUrl) navigate(item.actionUrl);
  }

  return (
    <div className="relative">
      <button
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={`Notificações${unread.length > 0 ? ` (${unread.length} não lidas)` : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${hasUrgent ? 'bg-rose-600' : 'bg-sky-600'}`}
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Central de Alertas</p>
              {unread.length > 0 && <Badge tone={hasUrgent ? 'danger' : 'info'}>{unread.length} não lidos</Badge>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {pending.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum alerta pendente.</p>
              )}
              {pending.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium text-slate-800 dark:text-slate-100 ${!item.read ? '' : 'opacity-70'}`}>{item.title}</span>
                    <Badge tone={PRIORITY_TONE[item.priority]} className="shrink-0">{item.priority}</Badge>
                  </div>
                  <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
                  <span className="text-[11px] text-slate-400">{formatDateTime(item.scheduledFor)}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <button
                className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
                onClick={() => { setOpen(false); navigate('/central-de-alertas'); }}
              >
                Ver central completa
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
