import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DoorOpen, Save } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { FormField, Input, Select } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import type { CheckInOut, Class, School, Student } from '../../domain';
import { initials } from '../../lib/utils';

interface Draft {
  checkInTime?: string;
  checkOutTime?: string;
}

export function CheckInOutPage() {
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState('');
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const canEdit = usePermission('check_in_out', 'edit') || usePermission('check_in_out', 'create');

  const schools = useLiveQuery<School[]>(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const classes = useLiveQuery<Class[]>(() => db.classes.filter((c) => c.status === 'active').toArray(), []);
  const filteredClasses = (classes ?? []).filter((c) => !schoolId || c.schoolId === schoolId);
  const selectedClass = classes?.find((c) => c.id === classId);

  const students = useLiveQuery<Student[]>(
    () => (classId ? db.students.filter((s) => s.classId === classId && s.status === 'active').toArray() : Promise.resolve<Student[]>([])),
    [classId],
  );
  const existing = useLiveQuery<CheckInOut[]>(
    () => (classId && date ? db.checkInOuts.filter((c) => c.classId === classId && c.date === date && c.status === 'active').toArray() : Promise.resolve<CheckInOut[]>([])),
    [classId, date],
  );

  const currentValues = useMemo(() => {
    const map: Record<string, Draft> = {};
    for (const c of existing ?? []) map[c.studentId] = { checkInTime: c.checkInTime, checkOutTime: c.checkOutTime };
    for (const [studentId, d] of Object.entries(draft)) map[studentId] = { ...map[studentId], ...d };
    return map;
  }, [existing, draft]);

  function setStudentDraft(studentId: string, changes: Draft) {
    setDraft((d) => ({ ...d, [studentId]: { ...currentValues[studentId], ...d[studentId], ...changes } }));
  }

  async function saveAll() {
    if (!session || !students || !selectedClass) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    let count = 0;
    for (const student of students) {
      const values = currentValues[student.id];
      if (!values || (!values.checkInTime && !values.checkOutTime)) continue;
      const found = existing?.find((c) => c.studentId === student.id);
      if (found) {
        await repositories.checkInOuts.update(found.id, { checkInTime: values.checkInTime, checkOutTime: values.checkOutTime, period }, actor);
      } else {
        await repositories.checkInOuts.create(
          {
            schoolId: selectedClass.schoolId,
            classId,
            studentId: student.id,
            stage: selectedClass.stage,
            date,
            period,
            checkInTime: values.checkInTime,
            checkOutTime: values.checkOutTime,
            registeredBy: session.user.id,
          },
          actor,
        );
      }
      count++;
    }
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'check_in_out' });
    setDraft({});
    setSavedMessage(`Entrada/saída de ${count} aluno(s) registrada para ${date}.`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Entrada e saída</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Registro do horário de entrada e saída dos alunos por escola, turma, data e período.</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <FormField label="Escola" htmlFor="schoolId">
          <Select
            id="schoolId"
            value={schoolId}
            onChange={(e) => { setSchoolId(e.target.value); setClassId(''); setDraft({}); setSavedMessage(null); }}
          >
            <option value="">Selecione…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Turma" htmlFor="classId">
          <Select
            id="classId"
            value={classId}
            onChange={(e) => { setClassId(e.target.value); setDraft({}); setSavedMessage(null); }}
            disabled={!schoolId}
          >
            <option value="">Selecione…</option>
            {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Data" htmlFor="date">
          <Input id="date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setSavedMessage(null); }} />
        </FormField>
        <FormField label="Período" htmlFor="period" hint="Ex.: 2026-B1">
          <Input id="period" placeholder="2026-B1" value={period} onChange={(e) => { setPeriod(e.target.value); setSavedMessage(null); }} />
        </FormField>
      </div>

      {!schoolId && <EmptyState icon={DoorOpen} title="Selecione uma escola" description="Escolha a escola, a turma, a data e o período para registrar entrada e saída." />}
      {schoolId && !classId && <EmptyState icon={DoorOpen} title="Selecione uma turma" description="Escolha a turma para listar os alunos." />}

      {classId && (
        <Card>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">{selectedClass?.name}</p>
              {savedMessage && <Badge tone="success">{savedMessage}</Badge>}
            </div>

            {!students?.length && <p className="text-sm text-slate-500">Nenhum aluno ativo nesta turma.</p>}

            <div className="space-y-2">
              {students?.map((student) => {
                const values = currentValues[student.id] ?? {};
                return (
                  <div key={student.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                      {initials(student.fullName)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{student.fullName}</span>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`checkin-${student.id}`} className="text-xs text-slate-500 dark:text-slate-400">Entrada</label>
                      <Input
                        id={`checkin-${student.id}`}
                        type="time"
                        className="w-28"
                        disabled={!canEdit}
                        value={values.checkInTime ?? ''}
                        onChange={(e) => setStudentDraft(student.id, { checkInTime: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`checkout-${student.id}`} className="text-xs text-slate-500 dark:text-slate-400">Saída</label>
                      <Input
                        id={`checkout-${student.id}`}
                        type="time"
                        className="w-28"
                        disabled={!canEdit}
                        value={values.checkOutTime ?? ''}
                        onChange={(e) => setStudentDraft(student.id, { checkOutTime: e.target.value })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {canEdit && students && students.length > 0 && (
              <div className="mt-4 flex items-center justify-end gap-2">
                {!period.trim() && <span className="text-xs text-amber-600 dark:text-amber-400">Informe o período antes de salvar.</span>}
                <Button onClick={saveAll} disabled={!period.trim()}><Save className="h-4 w-4" /> Salvar entrada/saída</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
