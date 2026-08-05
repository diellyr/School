import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw, Sparkles } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import { nowIso } from '../../domain/common';
import { formatDateTime } from '../../lib/utils';
import type { SyncQueueItem } from '../../domain';

export function SyncPage() {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const canAdminister = usePermission('sync', 'administer') || usePermission('sync', 'view');
  const [syncing, setSyncing] = useState(false);
  const [conflictItem, setConflictItem] = useState<SyncQueueItem | null>(null);

  const queue = useLiveQuery(async () => {
    const items = await db.syncQueue.filter((i) => i.status === 'active').toArray();
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);

  const pending = queue?.filter((i) => i.syncStatus === 'pending') ?? [];
  const conflicts = queue?.filter((i) => i.syncStatus === 'conflict') ?? [];
  const synced = queue?.filter((i) => i.syncStatus === 'synced') ?? [];
  const lastSync = synced.length > 0 ? synced[0].lastAttemptAt : undefined;

  async function simulatePending() {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const students = await db.students.filter((s) => s.status === 'active').toArray();
    const sample = students.slice(0, 2);
    for (const student of sample) {
      await repositories.syncQueue.create(
        {
          entityType: 'students',
          entityId: student.id,
          operation: 'update',
          payload: { fullName: student.fullName },
          attempts: 0,
          syncStatus: 'pending',
        },
        actor,
      );
    }
    if (sample[0]) {
      await repositories.syncQueue.create(
        {
          entityType: 'students',
          entityId: sample[0].id,
          operation: 'update',
          payload: { fullName: sample[0].fullName },
          attempts: 1,
          syncStatus: 'conflict',
          conflictLocalVersion: { fullName: sample[0].fullName, updatedAt: sample[0].updatedAt },
          conflictRemoteVersion: { fullName: `${sample[0].fullName} (editado em outro dispositivo)`, updatedAt: nowIso() },
        },
        actor,
      );
    }
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'sync', module: 'sync', reason: 'Pendências simuladas para demonstração' });
  }

  async function syncNow() {
    if (!session || !pending.length) return;
    setSyncing(true);
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    try {
      for (const item of pending) {
        await repositories.syncQueue.update(item.id, { syncStatus: 'synced', lastAttemptAt: nowIso(), attempts: item.attempts + 1 }, actor);
      }
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'sync', module: 'sync', reason: `${pending.length} item(ns) sincronizado(s)` });
    } finally {
      setSyncing(false);
    }
  }

  async function resolveConflict(item: SyncQueueItem, resolution: 'local' | 'remote') {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    if (resolution === 'remote' && item.entityType === 'students' && item.conflictRemoteVersion?.fullName) {
      await repositories.students.update(item.entityId, { fullName: String(item.conflictRemoteVersion.fullName) }, actor);
    }
    await repositories.syncQueue.update(item.id, { syncStatus: 'synced', lastAttemptAt: nowIso() }, actor);
    await repositories.audit.record(
      { ...actor, role: session.role },
      { action: 'sync', module: 'sync', entityId: item.entityId, reason: `Conflito resolvido mantendo versão ${resolution === 'local' ? 'local' : 'remota'}` },
    );
    setConflictItem(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Sincronização</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Fila de sincronização local, pronta para a Fase 6 (Supabase). Sem um projeto em nuvem
          conectado, esta tela funciona em modo demonstração.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3">
          <CloudOff className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="font-medium text-slate-800 dark:text-slate-100">Nuvem desativada nesta organização</p>
            <p className="text-xs text-slate-500">
              {lastSync ? `Última sincronização simulada: ${formatDateTime(lastSync)}` : 'Nenhuma sincronização realizada ainda.'}
            </p>
          </div>
          <Badge tone="default">Modo local (IndexedDB)</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pendentes" value={pending.length} icon={RefreshCw} />
        <StatCard label="Conflitos" value={conflicts.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Sincronizados" value={synced.length} icon={CheckCircle2} tone="success" />
      </div>

      {canAdminister && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={simulatePending}>
            <Sparkles className="h-4 w-4" /> Simular pendências (demonstração)
          </Button>
          <Button onClick={syncNow} loading={syncing} disabled={pending.length === 0}>
            <RefreshCw className="h-4 w-4" /> Sincronizar agora
          </Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Fila de sincronização</CardTitle></CardHeader>
        <CardContent>
          {!queue?.length && <EmptyState icon={RefreshCw} title="Nenhum item na fila" description="Tudo sincronizado ou nada foi alterado desde a última sincronização." />}
          <div className="space-y-2">
            {queue?.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
                <Badge tone={item.syncStatus === 'synced' ? 'success' : item.syncStatus === 'conflict' ? 'danger' : 'warning'}>
                  {item.syncStatus === 'synced' ? 'Sincronizado' : item.syncStatus === 'conflict' ? 'Conflito' : 'Pendente'}
                </Badge>
                <span className="text-slate-500">{item.entityType}</span>
                <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{item.operation}</span>
                <span className="text-xs text-slate-400">{item.attempts} tentativa(s)</span>
                {item.syncStatus === 'conflict' && (
                  <Button size="sm" variant="outline" onClick={() => setConflictItem(item)}>Resolver conflito</Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!conflictItem} onClose={() => setConflictItem(null)} title="Resolver conflito de sincronização" size="lg">
        {conflictItem && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Este registro foi alterado localmente e (de forma simulada) também em outro dispositivo. Escolha qual
              versão manter.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-sky-200 p-3 dark:border-sky-900/50">
                <p className="mb-1 text-xs font-semibold uppercase text-sky-600">Versão local</p>
                <pre className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{JSON.stringify(conflictItem.conflictLocalVersion, null, 2)}</pre>
              </div>
              <div className="rounded-lg border border-amber-200 p-3 dark:border-amber-900/50">
                <p className="mb-1 text-xs font-semibold uppercase text-amber-600">Versão remota (simulada)</p>
                <pre className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{JSON.stringify(conflictItem.conflictRemoteVersion, null, 2)}</pre>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => resolveConflict(conflictItem, 'local')}>Manter local</Button>
              <Button onClick={() => resolveConflict(conflictItem, 'remote')}>Manter remoto</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof RefreshCw; tone?: 'success' | 'warning' }) {
  const toneClass = tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : 'text-sky-600';
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${toneClass}`} />
        <div>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
