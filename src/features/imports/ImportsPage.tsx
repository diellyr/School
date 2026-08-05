import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Import, Plus } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { usePermission } from '../../auth/usePermission';
import { DOCUMENT_TYPE_LABELS } from './importTypes';
import { ImportWizard } from './ImportWizard';
import { formatDateTime } from '../../lib/utils';

const STATUS_TONE = { completed: 'success', partially_completed: 'warning', failed: 'danger', draft: 'default', extracting: 'default', mapping: 'default', validating: 'default', previewing: 'default', cancelled: 'default' } as const;

export function ImportsPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const canImport = usePermission('imports', 'import') || usePermission('imports', 'create');

  const imports = useLiveQuery(async () => {
    const items = await db.imports.filter((i) => i.status === 'active').toArray();
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);

  if (wizardOpen) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Nova importação</h1>
          <Button variant="outline" onClick={() => setWizardOpen(false)}>Cancelar</Button>
        </div>
        <ImportWizard onFinished={() => setWizardOpen(false)} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Importação</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Assistente de importação de arquivos CSV e XLSX.</p>
        </div>
        {canImport && <Button onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4" /> Nova importação</Button>}
      </div>

      <p className="mb-6 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        ATENÇÃO: escolha onde os dados serão armazenados. Dados mantidos apenas neste navegador poderão ser perdidos
        caso o histórico, os dados do aplicativo ou o dispositivo sejam apagados.
      </p>

      {imports === undefined && <SkeletonList />}
      {imports?.length === 0 && <EmptyState icon={Import} title="Nenhuma importação realizada ainda" />}

      {imports && imports.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Encontrados</th>
                <th className="px-4 py-3">Importados</th>
                <th className="px-4 py-3">Rejeitados</th>
                <th className="px-4 py-3">Duplicados</th>
                <th className="px-4 py-3">Armazenamento</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(imp.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{imp.fileName}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{DOCUMENT_TYPE_LABELS[imp.documentType]}</td>
                  <td className="px-4 py-3 text-slate-500">{imp.periodLabel}</td>
                  <td className="px-4 py-3 text-slate-500">{imp.totalRowsFound}</td>
                  <td className="px-4 py-3 text-emerald-600">{imp.totalImported}</td>
                  <td className="px-4 py-3 text-rose-600">{imp.totalRejected}</td>
                  <td className="px-4 py-3 text-amber-600">{imp.totalDuplicates}</td>
                  <td className="px-4 py-3">
                    <Badge tone={imp.storageDestination === 'local' ? 'default' : 'info'}>
                      {imp.storageDestination === 'local' ? 'Somente neste navegador' : 'Nuvem'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[imp.importStatus]}>
                      {imp.importStatus === 'completed' ? 'Concluída' : imp.importStatus === 'partially_completed' ? 'Parcial' : imp.importStatus}
                    </Badge>
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
