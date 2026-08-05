import { useRef, useState } from 'react';
import { Database, Download, Upload } from 'lucide-react';
import { db } from '../../db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { useAuthStore } from '../../auth/authStore';
import { useRepositories } from '../../repositories/RepositoryProvider';

interface BackupFile {
  generatedAt: string;
  tables: Record<string, unknown[]>;
}

export async function exportBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    tables[table.name] = await table.toArray();
  }
  return { generatedAt: new Date().toISOString(), tables };
}

export async function importBackup(file: BackupFile): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rows = file.tables[table.name];
      if (!rows?.length) continue;
      await table.bulkPut(rows as never[]);
      counts[table.name] = rows.length;
    }
  });
  return counts;
}

export function BackupPage() {
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const [preview, setPreview] = useState<BackupFile | null>(null);
  const [importResult, setImportResult] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-escola-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (session) {
      await repositories.audit.record(
        { userId: session.user.id, role: session.role, organizationId: session.user.organizationId },
        { action: 'export', module: 'backup' },
      );
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as BackupFile;
        if (!parsed.tables) throw new Error('invalid');
        setPreview(parsed);
      } catch {
        alert('Arquivo de backup inválido.');
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!preview) return;
    const counts = await importBackup(preview);
    setImportResult(counts);
    setPreview(null);
    if (session) {
      await repositories.audit.record(
        { userId: session.user.id, role: session.role, organizationId: session.user.organizationId },
        { action: 'import', module: 'backup' },
      );
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Backup e restauração</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Exporte todos os dados locais para um arquivo JSON ou restaure um backup anterior neste navegador.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Exportar</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Gera um arquivo com todos os registros do IndexedDB local. Lembre-se: apagar os dados do navegador
            elimina informações que não tenham sido exportadas ou sincronizadas com a nuvem.
          </p>
          <Button onClick={handleExport}><Download className="h-4 w-4" /> Exportar todos os dados locais</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Restaurar</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Selecione um arquivo de backup para pré-visualizar antes de restaurar. Registros com o mesmo ID serão
            atualizados; os demais serão adicionados.
          </p>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Selecionar arquivo de backup
          </Button>

          {importResult && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              Backup restaurado. Registros processados: {Object.values(importResult).reduce((a, b) => a + b, 0)}.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Pré-visualização do backup"
        description={preview ? `Gerado em ${new Date(preview.generatedAt).toLocaleString('pt-BR')}` : undefined}
      >
        {preview && (
          <div className="space-y-3">
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(preview.tables).filter(([, rows]) => rows.length > 0).map(([name, rows]) => (
                    <tr key={name} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200">{name}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500">{rows.length} registro(s)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
              <Button onClick={confirmImport}><Database className="h-4 w-4" /> Confirmar restauração</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
