import { useLiveQuery } from 'dexie-react-hooks';
import { Database } from 'lucide-react';
import { db } from '../../db/schema';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { formatDateTime } from '../../lib/utils';
import type { AuditAction } from '../../domain';

const ACTION_LABELS: Record<AuditAction, string> = {
  login: 'Login', login_attempt: 'Tentativa de login', create: 'Criação', view_sensitive: 'Visualização de dado sensível',
  edit: 'Edição', import: 'Importação', export: 'Exportação', approve: 'Aprovação', publish: 'Publicação',
  soft_delete: 'Exclusão lógica', restore: 'Restauração', permission_change: 'Alteração de permissão',
  sync: 'Sincronização', sync_failure: 'Falha de sincronização', report_query: 'Consulta a relatório',
};

export function AuditPage() {
  const logs = useLiveQuery(async () => {
    const all = await db.auditLogs.toArray();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  }, []);
  const users = useLiveQuery(() => db.users.toArray(), []);

  const userName = (id: string) => users?.find((u) => u.id === id)?.fullName ?? id;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">Auditoria</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Registro imutável de ações sensíveis do sistema (login, criação, edição, exclusão lógica, importações e mais).
      </p>

      {logs === undefined && <SkeletonList />}
      {logs?.length === 0 && <EmptyState icon={Database} title="Nenhum evento registrado ainda" description="As ações que você realizar no sistema aparecerão aqui." />}

      {logs && logs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Data/hora</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{userName(log.userId)}</td>
                  <td className="px-4 py-3">{ACTION_LABELS[log.action] ?? log.action}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.module}</td>
                  <td className="px-4 py-3">
                    <Badge tone={log.result === 'success' ? 'success' : 'danger'}>{log.result === 'success' ? 'sucesso' : 'falha'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
