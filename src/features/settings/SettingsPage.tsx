import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Cloud, Moon, Sun, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Badge } from '../../components/Badge';
import { db } from '../../db/schema';
import { useDemoDataActions, useDemoDataStatus } from './useDemoData';
import { applyThemeClass, useThemeStore } from '../../app/themeStore';
import { formatDateTime } from '../../lib/utils';
import { RetentionPoliciesCard } from './RetentionPoliciesCard';
import { useAuthStore } from '../../auth/authStore';

export function SettingsPage() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const loaded = useDemoDataStatus();
  const { loading, handleLoad, handleRemove } = useDemoDataActions();
  const [confirmLoadOpen, setConfirmLoadOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const session = useAuthStore((s) => s.session);

  const organization = useLiveQuery(
    () => (session ? db.organizations.get(session.user.organizationId) : undefined),
    [session?.user.organizationId],
  );

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">Modo claro ou escuro da interface.</p>
          <div className="flex gap-2">
            <Button
              variant={theme === 'light' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                setTheme('light');
                applyThemeClass('light');
              }}
            >
              <Sun className="h-4 w-4" /> Claro
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                setTheme('dark');
                applyThemeClass('dark');
              }}
            >
              <Moon className="h-4 w-4" /> Escuro
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Armazenamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Somente neste navegador (IndexedDB)</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Modo ativo nesta versão local.</p>
            </div>
            <Badge tone="success">Ativo</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 p-3 opacity-70 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Banco de dados em nuvem (Supabase)</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Preparado na arquitetura, ativado na Fase 6.</p>
              </div>
            </div>
            <Badge tone="default">Indisponível</Badge>
          </div>
          {organization && (
            <p className="text-xs text-slate-400">
              Organização: {organization.name} · Política de retenção: {organization.retentionPolicyDays} dias ·
              Criada em {formatDateTime(organization.createdAt)}
            </p>
          )}
        </CardContent>
      </Card>

      <RetentionPoliciesCard />

      <Card>
        <CardHeader>
          <CardTitle>Dados de demonstração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Os registros de demonstração ficam claramente marcados e podem ser removidos a qualquer momento sem
            afetar dados reais cadastrados por você.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setConfirmLoadOpen(true)} disabled={!!loaded} loading={loading}>
              Carregar dados de demonstração
            </Button>
            <Button variant="danger" onClick={() => setConfirmRemoveOpen(true)} disabled={!loaded} loading={loading}>
              <Trash2 className="h-4 w-4" /> Remover dados de demonstração
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            Status: {loaded === undefined ? 'verificando…' : loaded ? 'dados de demonstração carregados' : 'nenhum dado de demonstração carregado'}
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={confirmLoadOpen}
        onClose={() => setConfirmLoadOpen(false)}
        title="Carregar dados de demonstração?"
        description="Serão criadas escolas, turmas, alunos, responsáveis, professores e demais registros fictícios."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmLoadOpen(false)}>Cancelar</Button>
          <Button onClick={async () => { await handleLoad(); setConfirmLoadOpen(false); }} loading={loading}>
            Confirmar e carregar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={confirmRemoveOpen}
        onClose={() => setConfirmRemoveOpen(false)}
        title="Remover dados de demonstração?"
        description="Todos os registros marcados como demonstração serão apagados deste navegador. Dados reais cadastrados por você não são afetados. Se você estiver usando um usuário de demonstração, sua sessão será encerrada."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmRemoveOpen(false)}>Cancelar</Button>
          <Button variant="danger" onClick={async () => { await handleRemove(); setConfirmRemoveOpen(false); }} loading={loading}>
            Remover dados de demonstração
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
