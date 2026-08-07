import { useLiveQuery } from 'dexie-react-hooks';
import { Lock, Unlock, Users } from 'lucide-react';
import { db } from '../../db/schema';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import { ROLE_DEFINITIONS } from '../../domain';
import { formatDateTime } from '../../lib/utils';

const ROLE_TONE = { owner: 'purple', admin: 'info', director: 'info', teacher: 'success', guardian: 'warning', student: 'default' } as const;

export function UsersPage() {
  const users = useLiveQuery(() => db.users.filter((u) => u.status === 'active').toArray(), []);
  const canAdminister = usePermission('users', 'administer') || usePermission('users', 'edit');
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);

  async function toggleBlock(userId: string, isBlocked: boolean) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    await repositories.users.update(userId, { isBlocked: !isBlocked, failedLoginAttempts: 0 }, actor);
    await repositories.audit.record(
      { ...actor, role: session.role },
      { action: 'permission_change', module: 'users', entityId: userId, reason: isBlocked ? 'Desbloqueio manual' : 'Bloqueio manual' },
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">Usuários</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Contas de acesso ao sistema, por perfil.</p>

      {users === undefined && <SkeletonList />}
      {users?.length === 0 && <EmptyState icon={Users} title="Nenhum usuário cadastrado" />}

      {users && users.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    {u.fullName} {u.isDemo && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">demo</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[u.role]}>{ROLE_DEFINITIONS.find((r) => r.role === u.role)?.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.isBlocked ? 'danger' : 'success'}>{u.isBlocked ? 'Bloqueado' : 'Ativo'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canAdminister && u.role !== 'owner' && (
                      <Button size="sm" variant="outline" onClick={() => toggleBlock(u.id, u.isBlocked)}>
                        {u.isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        {u.isBlocked ? 'Desbloquear' : 'Bloquear'}
                      </Button>
                    )}
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
