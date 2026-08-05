import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Images, Plus, Upload } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Select, Textarea } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { useCurrentRole, usePermission } from '../../auth/usePermission';
import { readFileAsDataUrl, sha256OfFile } from '../../lib/files';
import { formatDate } from '../../lib/utils';
import type { PortfolioCategory, Student } from '../../domain';

const CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  desenho: 'Desenho', foto: 'Foto', video: 'Vídeo', trabalho: 'Trabalho', producao_textual: 'Produção textual',
  audio: 'Áudio', certificado: 'Certificado', projeto: 'Projeto',
};

const portfolioSchema = z.object({
  studentId: z.string().min(1, 'Selecione o aluno.'),
  category: z.enum(['desenho', 'foto', 'video', 'trabalho', 'producao_textual', 'audio', 'certificado', 'projeto']),
  description: z.string().optional(),
  imageAuthorization: z.boolean(),
});
type PortfolioFormValues = z.infer<typeof portfolioSchema>;

export function PortfolioPage() {
  const role = useCurrentRole();
  const session = useAuthStore((s) => s.session);
  const canCreate = usePermission('portfolio', 'create');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentFilter, setStudentFilter] = useState('');

  const items = useLiveQuery(async () => {
    const all = await db.portfolioItems.filter((p) => p.status === 'active').toArray();
    let scoped = all;
    if (role === 'guardian' && session?.user.guardianId) {
      const links = await db.studentGuardians.filter((l) => l.guardianId === session.user.guardianId && l.status === 'active').toArray();
      const ids = new Set(links.map((l) => l.studentId));
      scoped = all.filter((p) => ids.has(p.studentId));
    } else if (role === 'student' && session?.user.studentId) {
      scoped = all.filter((p) => p.studentId === session.user.studentId);
    }
    return scoped.sort((a, b) => b.date.localeCompare(a.date));
  }, [role, session?.user.guardianId, session?.user.studentId]);

  const documents = useLiveQuery(() => db.documents.toArray(), []);
  const students = useLiveQuery<Student[]>(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const studentName = (id: string) => students?.find((s) => s.id === id)?.fullName ?? '—';

  const visibleItems = studentFilter ? items?.filter((i) => i.studentId === studentFilter) : items;
  const fileUrl = (fileId: string) => documents?.find((d) => d.id === fileId)?.blobRef;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Portfólio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Trabalhos, fotos e produções dos alunos.</p>
        </div>
        {canCreate && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Novo item</Button>}
      </div>

      {role !== 'student' && role !== 'guardian' && (
        <div className="mb-4 max-w-xs">
          <Select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
            <option value="">Todos os alunos</option>
            {students?.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </Select>
        </div>
      )}

      {visibleItems === undefined && <SkeletonList />}
      {visibleItems?.length === 0 && <EmptyState icon={Images} title="Nenhum item no portfólio ainda" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems?.map((item) => (
          <Card key={item.id}>
            {item.fileIds[0] && fileUrl(item.fileIds[0]) && (
              <img src={fileUrl(item.fileIds[0])} alt={item.description ?? 'Item do portfólio'} className="h-40 w-full rounded-t-xl object-cover" />
            )}
            <CardContent>
              <div className="mb-1 flex items-center justify-between">
                <Badge>{CATEGORY_LABELS[item.category]}</Badge>
                <span className="text-xs text-slate-400">{formatDate(item.date)}</span>
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{studentName(item.studentId)}</p>
              {item.description && <p className="text-sm text-slate-600 dark:text-slate-300">{item.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <PortfolioFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} students={students ?? []} />
    </div>
  );
}

function PortfolioFormDialog({ open, onClose, students }: { open: boolean; onClose: () => void; students: Student[] }) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioSchema),
    values: { studentId: students[0]?.id ?? '', category: 'foto', description: '', imageAuthorization: true },
  });

  async function onSubmit(values: PortfolioFormValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const student = students.find((s) => s.id === values.studentId);
    if (!student) return;

    const fileIds: string[] = [];
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      const [dataUrl, hash] = await Promise.all([readFileAsDataUrl(file), sha256OfFile(file)]);
      const doc = await repositories.documents.create(
        {
          studentId: student.id, schoolId: student.schoolId, category: 'anexo', fileName: file.name, mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size, hash, tags: ['portfolio'], storageLocation: 'local', blobRef: dataUrl,
        },
        actor,
      );
      fileIds.push(doc.id);
    }

    const created = await repositories.portfolio.create(
      {
        studentId: student.id, date: new Date().toISOString().slice(0, 10), category: values.category,
        description: values.description || undefined, fileIds, visibility: 'school_and_family',
        imageAuthorization: values.imageAuthorization, tags: [],
      },
      actor,
    );
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'portfolio', entityId: created.id });
    reset();
    setFileName(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Novo item de portfólio">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Aluno" htmlFor="studentId" error={errors.studentId?.message} required>
          <Select id="studentId" {...register('studentId')}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </Select>
        </FormField>
        <FormField label="Categoria" htmlFor="category" error={errors.category?.message} required>
          <Select id="category" {...register('category')}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </FormField>
        <FormField label="Descrição" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" {...register('description')} />
        </FormField>
        <FormField label="Arquivo (opcional)" htmlFor="file">
          <input
            ref={fileInputRef}
            id="file"
            type="file"
            accept="image/*"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200 dark:file:bg-slate-800"
          />
          {fileName && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Upload className="h-3 w-3" /> {fileName}</p>}
        </FormField>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" className="rounded border-slate-300" {...register('imageAuthorization')} />
          Autorização de uso de imagem confirmada
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>Adicionar ao portfólio</Button>
        </div>
      </form>
    </Dialog>
  );
}
