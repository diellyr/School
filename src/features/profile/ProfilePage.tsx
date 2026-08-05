import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { useAuthStore } from '../../auth/authStore';
import { ROLE_DEFINITIONS } from '../../domain';
import { formatDateTime, initials } from '../../lib/utils';

export function ProfilePage() {
  const session = useAuthStore((s) => s.session);
  if (!session) return null;
  const roleLabel = ROLE_DEFINITIONS.find((r) => r.role === session.role)?.label;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Meu perfil</h1>

      <Card>
        <CardHeader><CardTitle>Dados da conta</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {initials(session.user.fullName)}
            </span>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{session.user.fullName}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{session.user.email}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-400">Perfil</dt>
              <dd><Badge tone="info">{roleLabel}</Badge></dd>
            </div>
            <div>
              <dt className="text-slate-400">Conta de demonstração</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{session.user.isDemo ? 'Sim' : 'Não'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Último acesso</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{formatDateTime(session.user.lastLoginAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Sessão expira em</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{formatDateTime(session.expiresAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
