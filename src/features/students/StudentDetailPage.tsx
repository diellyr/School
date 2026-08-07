import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Baby, Cake, GraduationCap, LayoutDashboard, School as SchoolIcon, Users2 } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { calculateAge, formatDate, initials } from '../../lib/utils';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { StudentFinancialSection } from './StudentFinancialSection';

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const loggedForId = useRef<string | null>(null);

  const student = useLiveQuery(() => (id ? db.students.get(id) : undefined), [id]);

  useEffect(() => {
    if (!id || !student || !session || loggedForId.current === id) return;
    loggedForId.current = id;
    repositories.audit.record(
      { userId: session.user.id, role: session.role, organizationId: session.user.organizationId },
      { action: 'view_sensitive', module: 'students', entityId: id },
    );
  }, [id, student, session, repositories]);
  const school = useLiveQuery(() => (student ? db.schools.get(student.schoolId) : undefined), [student?.schoolId]);
  const klass = useLiveQuery(() => (student?.classId ? db.classes.get(student.classId) : undefined), [student?.classId]);
  const links = useLiveQuery(() => (id ? db.studentGuardians.filter((l) => l.studentId === id && l.status === 'active').toArray() : []), [id]);
  const guardians = useLiveQuery(async () => {
    if (!links?.length) return [];
    const items = await Promise.all(links.map((l) => db.guardians.get(l.guardianId)));
    return items.filter((g): g is NonNullable<typeof g> => !!g);
  }, [links]);
  const enrollments = useLiveQuery(
    () => (id ? db.enrollments.filter((e) => e.studentId === id).toArray() : []),
    [id],
  );

  if (student === undefined) return null;
  if (!student) {
    return <EmptyState icon={Baby} title="Aluno não encontrado" description="O cadastro pode ter sido removido." />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/alunos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-sky-600">
        <ArrowLeft className="h-4 w-4" /> Voltar para alunos
      </Link>

      <div className="flex items-center gap-4">
        {student.photoUrl ? (
          <img
            src={student.photoUrl}
            alt={student.fullName}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
            {initials(student.fullName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{student.socialName || student.fullName}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {klass?.stage === 'early_childhood' ? 'Educação Infantil' : 'Ensino Fundamental'} · {klass?.name ?? 'Sem turma'}
          </p>
        </div>
        {student.isDemo && <Badge tone="default">demo</Badge>}
        <Link to={`/${klass?.stage === 'elementary' ? 'ensino-fundamental' : 'educacao-infantil'}?studentId=${student.id}`}>
          <Button variant="outline">
            <LayoutDashboard className="h-4 w-4" /> Ver dashboard
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Dados do aluno</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow icon={Cake} label="Nascimento" value={`${formatDate(student.birthDate)} (${calculateAge(student.birthDate)} anos)`} />
            <InfoRow icon={SchoolIcon} label="Escola" value={school?.name ?? '—'} />
            <InfoRow icon={GraduationCap} label="Turma" value={klass?.name ?? '—'} />
            <InfoRow icon={Baby} label="Código interno" value={student.internalCode ?? '—'} />
            {student.authorizedNotes && (
              <div className="pt-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Observações autorizadas</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{student.authorizedNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Responsáveis</CardTitle></CardHeader>
          <CardContent>
            {!guardians?.length && <p className="text-sm text-slate-500">Nenhum responsável vinculado.</p>}
            <div className="space-y-2">
              {guardians?.map((g) => (
                <div key={g.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-sm dark:border-slate-800">
                  <Users2 className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{g.fullName}</p>
                    <p className="text-xs text-slate-500">{g.email ?? g.phone ?? '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <StudentFinancialSection studentId={student.id} />

      <Card>
        <CardHeader><CardTitle>Histórico de matrícula</CardTitle></CardHeader>
        <CardContent>
          {!enrollments?.length && <p className="text-sm text-slate-500">Sem histórico de matrícula registrado.</p>}
          <ul className="space-y-2 text-sm">
            {enrollments?.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                <span>Matrícula em {formatDate(e.enrollmentDate)}</span>
                <Badge tone={e.status === 'active' ? 'success' : 'default'}>{e.status}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Acesso rápido</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link to={`/${klass?.stage === 'elementary' ? 'ensino-fundamental' : 'educacao-infantil'}?studentId=${student.id}`}>
            <Button variant="outline">Dashboard individual</Button>
          </Link>
          <Link to={klass?.stage === 'elementary' ? '/notas' : '/avaliacoes'}>
            <Button variant="outline">{klass?.stage === 'elementary' ? 'Notas' : 'Avaliações'}</Button>
          </Link>
          <Link to="/frequencia"><Button variant="outline">Frequência</Button></Link>
          <Link to="/entrada-saida"><Button variant="outline">Entrada e saída</Button></Link>
          {klass?.stage === 'early_childhood' && (
            <Link to={`/desenvolvimento?studentId=${student.id}`}><Button variant="outline">Desenvolvimento</Button></Link>
          )}
          <Link to="/portfolio"><Button variant="outline">Portfólio</Button></Link>
          <Link to="/documentos"><Button variant="outline">Documentos</Button></Link>
          <Link to={`/parcelas?studentId=${student.id}`}><Button variant="outline">Financeiro</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Cake; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  );
}
