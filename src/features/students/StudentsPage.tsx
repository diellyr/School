import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Input, Select, Textarea } from '../../components/form/Field';
import { studentSchema, type StudentFormValues } from './studentSchema';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { useCurrentRole, usePermission } from '../../auth/usePermission';
import type { Student } from '../../domain';
import { calculateAge, initials } from '../../lib/utils';

const STATUS_TONE = { active: 'success', pending: 'warning', transferred: 'info', graduated: 'purple', withdrawn: 'danger' } as const;
const STATUS_LABEL = { active: 'Ativa', pending: 'Pendente', transferred: 'Transferido', graduated: 'Concluído', withdrawn: 'Desligado' } as const;

export function StudentsPage() {
  const role = useCurrentRole();
  const session = useAuthStore((s) => s.session);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const canCreate = usePermission('students', 'create');
  const canEdit = usePermission('students', 'edit');

  const schools = useLiveQuery(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const classes = useLiveQuery(() => db.classes.filter((c) => c.status === 'active').toArray(), []);

  const allStudents = useLiveQuery(() => db.students.filter((s) => s.status === 'active').toArray(), []);

  const visibleStudents = useMemo(() => {
    if (!allStudents) return undefined;
    let items = allStudents;
    // Escopo por perfil: aluno vê só a si mesmo; responsável vê só os vínculos (aplicado via studentGuardians em telas específicas — aqui restringe para segurança básica de UI).
    if (role === 'student' && session?.user.studentId) {
      items = items.filter((s) => s.id === session.user.studentId);
    }
    if (schoolFilter) items = items.filter((s) => s.schoolId === schoolFilter);
    if (classFilter) items = items.filter((s) => s.classId === classFilter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      items = items.filter((s) => s.fullName.toLowerCase().includes(term) || (s.internalCode ?? '').toLowerCase().includes(term));
    }
    return items;
  }, [allStudents, role, session, schoolFilter, classFilter, search]);

  const schoolName = (id: string) => schools?.find((s) => s.id === id)?.name ?? '—';
  const className = (id?: string) => classes?.find((c) => c.id === id)?.name ?? '—';

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Alunos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cadastro de alunos da Educação Infantil e do Ensino Fundamental.</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo aluno
          </Button>
        )}
      </div>

      {role !== 'student' && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input placeholder="Buscar por nome ou código…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={schoolFilter} onChange={(e) => { setSchoolFilter(e.target.value); setClassFilter(''); }}>
            <option value="">Todas as escolas</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">Todas as turmas</option>
            {classes?.filter((c) => !schoolFilter || c.schoolId === schoolFilter).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      )}

      {visibleStudents === undefined && <SkeletonList />}

      {visibleStudents?.length === 0 && (
        <EmptyState icon={Users} title="Nenhum aluno encontrado" description="Ajuste os filtros ou cadastre um novo aluno." />
      )}

      {visibleStudents && visibleStudents.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStudents.map((student) => (
            <div
              key={student.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <Link to={`/alunos/${student.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                  {initials(student.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">{student.socialName || student.fullName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {schoolName(student.schoolId)} · {className(student.classId)} · {calculateAge(student.birthDate)} anos
                  </p>
                </div>
              </Link>
              <Badge tone={STATUS_TONE[student.matriculationStatus]}>{STATUS_LABEL[student.matriculationStatus]}</Badge>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => { setEditing(student); setDialogOpen(true); }}>
                  Editar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <StudentFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        schools={schools ?? []}
        classes={classes ?? []}
      />
    </div>
  );
}

function StudentFormDialog({
  open,
  onClose,
  editing,
  schools,
  classes,
}: {
  open: boolean;
  onClose: () => void;
  editing: Student | null;
  schools: { id: string; name: string }[];
  classes: { id: string; name: string; schoolId: string }[];
}) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    values: editing
      ? {
          fullName: editing.fullName,
          socialName: editing.socialName ?? '',
          birthDate: editing.birthDate,
          schoolId: editing.schoolId,
          classId: editing.classId ?? '',
          internalCode: editing.internalCode ?? '',
          matriculationStatus: editing.matriculationStatus,
          authorizedNotes: editing.authorizedNotes ?? '',
        }
      : {
          fullName: '', socialName: '', birthDate: '', schoolId: schools[0]?.id ?? '', classId: '',
          internalCode: '', matriculationStatus: 'active', authorizedNotes: '',
        },
  });

  const selectedSchool = watch('schoolId');
  const filteredClasses = classes.filter((c) => c.schoolId === selectedSchool);

  async function onSubmit(values: StudentFormValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const targetClass = classes.find((c) => c.id === values.classId);
    const payload = {
      fullName: values.fullName,
      socialName: values.socialName || undefined,
      birthDate: values.birthDate,
      schoolId: values.schoolId,
      classId: values.classId,
      grade: undefined,
      internalCode: values.internalCode || undefined,
      matriculationStatus: values.matriculationStatus,
      authorizedNotes: values.authorizedNotes || undefined,
      enrollmentDate: editing?.enrollmentDate ?? new Date().toISOString().slice(0, 10),
    };
    if (editing) {
      await repositories.students.update(editing.id, payload, actor);
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'students', entityId: editing.id });
    } else {
      const created = await repositories.students.create(payload, actor);
      await repositories.enrollments.create(
        { studentId: created.id, schoolId: values.schoolId, classId: values.classId, academicYearId: targetClass ? await currentAcademicYear(targetClass.schoolId) : '', enrollmentDate: payload.enrollmentDate, enrollmentStatus: 'active' },
        actor,
      );
      await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'students', entityId: created.id });
    }
    reset();
    onClose();
  }

  async function currentAcademicYear(schoolId: string): Promise<string> {
    const year = await db.academicYears.filter((y) => y.schoolId === schoolId && y.isCurrent).first();
    return year?.id ?? '';
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar aluno' : 'Novo aluno'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nome completo" htmlFor="fullName" error={errors.fullName?.message} required>
            <Input id="fullName" {...register('fullName')} />
          </FormField>
          <FormField label="Nome social (opcional)" htmlFor="socialName" error={errors.socialName?.message}>
            <Input id="socialName" {...register('socialName')} />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Data de nascimento" htmlFor="birthDate" error={errors.birthDate?.message} required>
            <Input id="birthDate" type="date" {...register('birthDate')} />
          </FormField>
          <FormField label="Código interno" htmlFor="internalCode" error={errors.internalCode?.message}>
            <Input id="internalCode" {...register('internalCode')} />
          </FormField>
          <FormField label="Situação da matrícula" htmlFor="matriculationStatus" error={errors.matriculationStatus?.message} required>
            <Select id="matriculationStatus" {...register('matriculationStatus')}>
              <option value="active">Ativa</option>
              <option value="pending">Pendente</option>
              <option value="transferred">Transferido</option>
              <option value="graduated">Concluído</option>
              <option value="withdrawn">Desligado</option>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Escola" htmlFor="schoolId" error={errors.schoolId?.message} required>
            <Select id="schoolId" {...register('schoolId')}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Turma" htmlFor="classId" error={errors.classId?.message} required>
            <Select id="classId" {...register('classId')}>
              <option value="">Selecione…</option>
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField
          label="Observações autorizadas"
          htmlFor="authorizedNotes"
          error={errors.authorizedNotes?.message}
          hint="Não inclua informações médicas — dados sensíveis têm controle de acesso separado."
        >
          <Textarea id="authorizedNotes" {...register('authorizedNotes')} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>{editing ? 'Salvar alterações' : 'Cadastrar aluno'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
