import { useLiveQuery } from 'dexie-react-hooks';
import { ShieldCheck } from 'lucide-react';
import { db } from '../../db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { roleDefaultActions } from '../../auth/permissions';
import { ROLE_DEFINITIONS } from '../../domain';
import type { PermissionAction, SystemModule } from '../../domain';

const MODULES: { key: SystemModule; label: string }[] = [
  { key: 'students', label: 'Alunos' }, { key: 'guardians', label: 'Responsáveis' }, { key: 'teachers', label: 'Professores' },
  { key: 'schools', label: 'Escolas' }, { key: 'classes', label: 'Turmas' }, { key: 'imports', label: 'Importação' },
  { key: 'manual_entry', label: 'Lançamento manual' }, { key: 'assessments', label: 'Avaliações' }, { key: 'grades', label: 'Notas' },
  { key: 'attendance', label: 'Frequência' }, { key: 'alerts', label: 'Alertas' }, { key: 'observations', label: 'Observações' },
  { key: 'events', label: 'Eventos' }, { key: 'portfolio', label: 'Portfólio' }, { key: 'documents', label: 'Documentos' },
  { key: 'reports', label: 'Relatórios' }, { key: 'users', label: 'Usuários' }, { key: 'audit', label: 'Auditoria' },
  { key: 'backup', label: 'Backup' }, { key: 'settings', label: 'Configurações' },
];

const ACTION_ABBR: Record<PermissionAction, string> = {
  view: 'V', create: 'C', edit: 'E', import: 'I', export: 'X', approve: 'A', delete: 'D', administer: 'Adm',
};

export function PermissionsAdminPage() {
  const overrides = useLiveQuery(() => db.userPermissions.filter((p) => p.status === 'active').toArray(), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Permissões do Owner</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Matriz padrão por perfil. Sobreposições específicas (por usuário/escola/turma/aluno/módulo) têm prioridade
          sobre este padrão e são cadastradas na tabela <code>user_permissions</code>.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Matriz padrão por perfil</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-2 pr-3">Módulo</th>
                {ROLE_DEFINITIONS.map((r) => (
                  <th key={r.role} className="px-2 py-2">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.key} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">{m.label}</td>
                  {ROLE_DEFINITIONS.map((r) => (
                    <td key={r.role} className="px-2 py-2 text-slate-500 dark:text-slate-400">
                      {roleDefaultActions(r.role, m.key).map((a) => ACTION_ABBR[a]).join(' ') || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-slate-400">
            V=Visualizar · C=Criar · E=Editar · I=Importar · X=Exportar · A=Aprovar · D=Apagar · Adm=Administrar
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sobreposições específicas (usuário/escola/turma/aluno)</CardTitle></CardHeader>
        <CardContent>
          {!overrides?.length ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nenhuma sobreposição cadastrada"
              description="O editor completo de concessões e restrições granulares (por usuário, escola, turma e aluno, com data de expiração) é entregue em uma fase futura. A estrutura de dados já existe e está pronta para essa tela."
            />
          ) : (
            <ul className="space-y-1 text-sm">
              {overrides.map((o) => (
                <li key={o.id}>{o.userId} · {o.module} · {o.actions.join(', ')}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
