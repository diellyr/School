import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, Save } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { FormField, Input, Select } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import type { Attendance, AttendanceStatus, Class, Student } from '../../domain';
import { initials } from '../../lib/utils';

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Falta',
  justified_absence: 'Falta justificada',
  late: 'Atraso',
  early_departure: 'Saída antecipada',
  class_cancelled: 'Aula cancelada',
  remote_activity: 'Atividade remota',
};

const STATUS_TONE: Record<AttendanceStatus, 'success' | 'danger' | 'warning' | 'default' | 'info'> = {
  present: 'success',
  absent: 'danger',
  justified_absence: 'warning',
  late: 'warning',
  early_departure: 'warning',
  class_cancelled: 'default',
  remote_activity: 'info',
};

export function AttendancePage() {
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const canEdit = usePermission('attendance', 'edit') || usePermission('attendance', 'create');

  const classes = useLiveQuery<Class[]>(() => db.classes.filter((c) => c.status === 'active').toArray(), []);
  const students = useLiveQuery<Student[]>(
    () => (classId ? db.students.filter((s) => s.classId === classId && s.status === 'active').toArray() : Promise.resolve<Student[]>([])),
    [classId],
  );
  const existing = useLiveQuery<Attendance[]>(
    () => (classId && date ? db.attendance.filter((a) => a.classId === classId && a.date === date && a.status === 'active').toArray() : Promise.resolve<Attendance[]>([])),
    [classId, date],
  );

  const currentValues = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    for (const a of existing ?? []) map[a.studentId] = a.attendanceStatus;
    return { ...map, ...draft };
  }, [existing, draft]);

  async function saveAll() {
    if (!session || !students) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    let count = 0;
    for (const student of students) {
      const status = currentValues[student.id];
      if (!status) continue;
      const found = existing?.find((a) => a.studentId === student.id);
      if (found) {
        await repositories.attendance.update(found.id, { attendanceStatus: status }, actor);
      } else {
        await repositories.attendance.create({ studentId: student.id, classId, date, attendanceStatus: status, registeredBy: session.user.id }, actor);
      }
      count++;
    }
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'attendance' });
    setDraft({});
    setSavedMessage(`Frequência de ${count} aluno(s) registrada para ${date}.`);
  }

  function markAll(status: AttendanceStatus) {
    if (!students) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const s of students) next[s.id] = status;
    setDraft(next);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Frequência</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Lançamento de presença por turma e data.</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Turma" htmlFor="classId">
          <Select id="classId" value={classId} onChange={(e) => { setClassId(e.target.value); setDraft({}); setSavedMessage(null); }}>
            <option value="">Selecione…</option>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Data" htmlFor="date">
          <Input id="date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setSavedMessage(null); }} />
        </FormField>
      </div>

      {!classId && <EmptyState icon={Activity} title="Selecione uma turma" description="Escolha a turma e a data para lançar a frequência." />}

      {classId && (
        <Card>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => markAll('present')}>Marcar todos presentes</Button>
                <Button size="sm" variant="outline" onClick={() => markAll('absent')}>Marcar todos faltosos</Button>
              </div>
              {savedMessage && <Badge tone="success">{savedMessage}</Badge>}
            </div>

            {!students?.length && <p className="text-sm text-slate-500">Nenhum aluno ativo nesta turma.</p>}

            <div className="space-y-2">
              {students?.map((student) => (
                <div key={student.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                    {initials(student.fullName)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{student.fullName}</span>
                  {currentValues[student.id] && <Badge tone={STATUS_TONE[currentValues[student.id]]}>{STATUS_LABELS[currentValues[student.id]]}</Badge>}
                  <div className="w-56 shrink-0">
                    <Select
                      disabled={!canEdit}
                      value={currentValues[student.id] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [student.id]: e.target.value as AttendanceStatus }))}
                    >
                      <option value="">—</option>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {canEdit && students && students.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button onClick={saveAll}><Save className="h-4 w-4" /> Salvar frequência</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
