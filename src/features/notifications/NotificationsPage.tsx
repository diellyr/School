import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Download } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Card, CardContent } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { Input, Select } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { formatDateTime } from '../../lib/utils';
import { downloadCsv } from '../../lib/csv';
import { NOTIFICATION_CATEGORY_LABELS, NOTIFICATION_PRIORITY_LABELS } from '../../domain';
import { useVisibleNotifications } from './useVisibleNotifications';
import type { UnifiedAlertItem } from './notificationAggregatorService';

const PRIORITY_TONE = { informativo: 'default', baixo: 'default', medio: 'info', alto: 'warning', urgente: 'danger' } as const;
const PAGE_SIZE = 20;

export function NotificationsPage() {
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const navigate = useNavigate();
  const items = useVisibleNotifications();
  const students = useLiveQuery(() => db.students.filter((s) => s.status === 'active').toArray(), []);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const studentName = (id?: string) => students?.find((s) => s.id === id)?.fullName ?? '—';

  const filtered = useMemo(() => {
    if (!items) return undefined;
    return items.filter((item) => {
      if (search && !item.title.toLowerCase().includes(search.toLowerCase()) && !item.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (category && item.category !== category) return false;
      if (priority && item.priority !== priority) return false;
      if (studentFilter && item.studentId !== studentFilter) return false;
      if (readFilter === 'read' && !item.read) return false;
      if (readFilter === 'unread' && item.read) return false;
      if (resolvedFilter === 'resolved' && !item.resolved) return false;
      if (resolvedFilter === 'pending' && item.resolved) return false;
      if (from && item.scheduledFor < from) return false;
      if (to && item.scheduledFor > `${to}T23:59:59.999Z`) return false;
      return true;
    }).sort((a, b) => {
      const priorityOrder = { urgente: 0, alto: 1, medio: 2, baixo: 3, informativo: 4 };
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      return diff !== 0 ? diff : b.scheduledFor.localeCompare(a.scheduledFor);
    });
  }, [items, search, category, priority, studentFilter, readFilter, resolvedFilter, from, to]);

  const unreadCount = (items ?? []).filter((i) => !i.read && !i.resolved).length;
  const visible = filtered?.slice(0, visibleCount);

  async function actor() {
    if (!session) throw new Error('Sessão inválida.');
    return { userId: session.user.id, organizationId: session.user.organizationId };
  }

  async function markRead(item: UnifiedAlertItem) {
    if (item.source !== 'notification') return;
    await repositories.notifications.markRead(item.originalId, await actor());
  }

  async function resolve(item: UnifiedAlertItem) {
    if (item.source !== 'notification') return;
    await repositories.notifications.resolve(item.originalId, await actor());
  }

  async function markAllRead() {
    const act = await actor();
    const ids = (filtered ?? []).filter((i) => i.source === 'notification' && !i.read).map((i) => i.originalId);
    await repositories.notifications.markAllRead(ids, act);
  }

  function openItem(item: UnifiedAlertItem) {
    if (item.actionUrl) navigate(item.actionUrl);
  }

  function exportCsv() {
    if (!filtered) return;
    downloadCsv(
      'alertas',
      ['Título', 'Descrição', 'Categoria', 'Prioridade', 'Aluno', 'Data', 'Lido', 'Resolvido'],
      filtered.map((item) => [
        item.title, item.description, NOTIFICATION_CATEGORY_LABELS[item.category], NOTIFICATION_PRIORITY_LABELS[item.priority],
        studentName(item.studentId), formatDateTime(item.scheduledFor), item.read ? 'Sim' : 'Não', item.resolved ? 'Sim' : 'Não',
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Central de Alertas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {unreadCount > 0 ? `${unreadCount} alerta(s) não lido(s) pendente(s).` : 'Nenhum alerta pendente não lido.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar CSV</Button>
          <Button variant="outline" onClick={markAllRead}><CheckCheck className="h-4 w-4" /> Marcar todos como lidos</Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas as categorias</option>
            {Object.entries(NOTIFICATION_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Todas as prioridades</option>
            {Object.entries(NOTIFICATION_PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
            <option value="">Todos os alunos</option>
            {students?.map((s) => <option key={s.id} value={s.id}>{s.socialName || s.fullName}</option>)}
          </Select>
          <Select value={readFilter} onChange={(e) => setReadFilter(e.target.value)}>
            <option value="">Lidos e não lidos</option>
            <option value="unread">Não lidos</option>
            <option value="read">Lidos</option>
          </Select>
          <Select value={resolvedFilter} onChange={(e) => setResolvedFilter(e.target.value)}>
            <option value="">Resolvidos e pendentes</option>
            <option value="pending">Pendentes</option>
            <option value="resolved">Resolvidos</option>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="De" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Até" />
        </CardContent>
      </Card>

      {filtered === undefined && <SkeletonList />}
      {filtered && filtered.length === 0 && (
        <EmptyState icon={Bell} title="Nenhum alerta encontrado" description="Ajuste os filtros para ver mais resultados." />
      )}
      {visible && visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-medium text-slate-800 dark:text-slate-100 ${item.read ? 'opacity-70' : ''}`}>{item.title}</p>
                    <Badge tone={PRIORITY_TONE[item.priority]}>{NOTIFICATION_PRIORITY_LABELS[item.priority]}</Badge>
                    <Badge tone="default">{NOTIFICATION_CATEGORY_LABELS[item.category]}</Badge>
                    {!item.read && <Badge tone="info">não lido</Badge>}
                    {item.resolved && <Badge tone="success">resolvido</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(item.scheduledFor)}
                    {item.studentId && ` · ${studentName(item.studentId)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {item.actionUrl && <Button size="sm" variant="outline" onClick={() => openItem(item)}>Abrir</Button>}
                  {item.source === 'notification' && !item.read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(item)}>Marcar como lido</Button>
                  )}
                  {item.source === 'notification' && !item.resolved && (
                    <Button size="sm" variant="ghost" onClick={() => resolve(item)}>Resolver</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered && filtered.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>Carregar mais</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
