import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, FolderOpen, Upload } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { Input, Select } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import { readFileAsDataUrl, sha256OfFile, formatFileSize } from '../../lib/files';
import { formatDateTime } from '../../lib/utils';
import type { DocumentCategory, Student } from '../../domain';

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  relatorio_original: 'Relatório original', arquivo_importado: 'Arquivo importado', relatorio_processado: 'Relatório processado',
  boletim: 'Boletim', autorizacao: 'Autorização', comunicado: 'Comunicado', comprovante: 'Comprovante', anexo: 'Anexo',
};

export function DocumentsPage() {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const canUpload = usePermission('documents', 'create');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploading, setUploading] = useState(false);

  const documents = useLiveQuery(async () => {
    const items = await db.documents.filter((d) => d.status === 'active').toArray();
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);
  const students = useLiveQuery<Student[]>(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const studentName = (id?: string) => (id ? students?.find((s) => s.id === id)?.fullName : undefined);

  const filtered = documents?.filter((d) => {
    if (categoryFilter && d.category !== categoryFilter) return false;
    if (search.trim() && !d.fileName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setUploading(true);
    try {
      const actor = { userId: session.user.id, organizationId: session.user.organizationId };
      const [dataUrl, hash] = await Promise.all([readFileAsDataUrl(file), sha256OfFile(file)]);
      const created = await repositories.documents.create(
        {
          schoolId: session.user.organizationId, category: 'anexo', fileName: file.name, mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size, hash, tags: [], storageLocation: 'local', blobRef: dataUrl,
        },
        actor,
      );
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'import', module: 'documents', entityId: created.id });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Documentos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Central de arquivos: relatórios, boletins, autorizações e anexos.</p>
        </div>
        {canUpload && (
          <>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileInputRef.current?.click()} loading={uploading}><Upload className="h-4 w-4" /> Enviar arquivo</Button>
          </>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input placeholder="Buscar por nome do arquivo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>

      {filtered === undefined && <SkeletonList />}
      {filtered?.length === 0 && <EmptyState icon={FolderOpen} title="Nenhum documento encontrado" />}

      {filtered && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">Tamanho</th>
                <th className="px-4 py-3">Enviado em</th>
                <th className="px-4 py-3">Armazenamento</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{d.fileName}</td>
                  <td className="px-4 py-3"><Badge>{CATEGORY_LABELS[d.category]}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{studentName(d.studentId) ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatFileSize(d.sizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={d.storageLocation === 'local' ? 'default' : 'info'}>
                      {d.storageLocation === 'local' ? 'Somente neste navegador' : 'Nuvem'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.blobRef && (
                      <a href={d.blobRef} download={d.fileName} className="inline-flex items-center gap-1 text-sky-600 hover:underline">
                        <Download className="h-4 w-4" /> Baixar
                      </a>
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
