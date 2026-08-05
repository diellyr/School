import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Database, Download } from 'lucide-react';
import { db } from '../../db/schema';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { Input, Select } from '../../components/form/Field';
import { formatDateTime } from '../../lib/utils';
import type { AuditAction } from '../../domain';

const ACTION_LABELS: Record<AuditAction, string> = {
  login: 'Login', login_attempt: 'Tentativa de login', create: 'Criação', view_sensitive: 'Visualização de dado sensível',
  edit: 'Edição', import: 'Importação', export: 'Exportação', approve: 'Aprovação', publish: 'Publicação',
  soft_delete: 'Exclusão lógica', restore: 'Restauração', permission_change: 'Alteração de permissão',
  sync: 'Sincronização', sync_failure: 'Falha de sincronização', report_query: 'Consulta a relatório',
};

function toCsvValue(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function AuditPage() {
  const [userFilter, setUserFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const logs = useLiveQuery(async () => {
    const all = await db.auditLogs.toArray();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);
  const users = useLiveQuery(() => db.users.toArray(), []);

  const userName = (id: string) => users?.find((u) => u.id === id)?.fullName ?? id;
  const modules = useMemo(() => [...new Set((logs ?? []).map((l) => l.module))].sort(), [logs]);

  const filtered = useMemo(() => {
    if (!logs) return undefined;
    return logs.filter((log) => {
      if (userFilter && log.userId !== userFilter) return false;
      if (moduleFilter && log.module !== moduleFilter) return false;
      if (actionFilter && log.action !== actionFilter) return false;
      if (fromDate && log.createdAt < fromDate) return false;
      if (toDate && log.createdAt > `${toDate}T23:59:59.999Z`) return false;
      return true;
    });
  }, [logs, userFilter, moduleFilter, actionFilter, fromDate, toDate]);

  function exportCsv() {
    if (!filtered) return;
    const header = ['Data/hora', 'Usuário', 'Perfil', 'Ação', 'Módulo', 'Registro', 'Motivo', 'Resultado'];
    const rows = filtered.map((log) => [
      log.createdAt,
      userName(log.userId),
      log.role,
      ACTION_LABELS[log.action] ?? log.action,
      log.module,
      log.entityId ?? '',
      log.reason ?? '',
      log.result,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => toCsvValue(String(v))).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Auditoria</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Registro imutável de ações sensíveis do sistema (login, criação, edição, exclusão lógica, importações e mais).
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered?.length}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
          <option value="">Todos os usuários</option>
          {users?.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </Select>
        <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          <option value="">Todos os módulos</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">Todas as ações</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="De" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Até" />
      </div>

      {filtered === undefined && <SkeletonList />}
      {filtered?.length === 0 && <EmptyState icon={Database} title="Nenhum evento encontrado" description="Ajuste os filtros ou aguarde novas ações no sistema." />}

      {filtered && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Data/hora</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map((log) => (
                <tr key={log.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{userName(log.userId)}</td>
                  <td className="px-4 py-3">{ACTION_LABELS[log.action] ?? log.action}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.module}</td>
                  <td className="px-4 py-3 text-slate-400">{log.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={log.result === 'success' ? 'success' : 'danger'}>{log.result === 'success' ? 'sucesso' : 'falha'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 300 && (
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400 dark:border-slate-800">
              Mostrando os 300 eventos mais recentes de {filtered.length}. Exporte em CSV para ver todos.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
