import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { GraduationCap, Save } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { FormField, Input, Select } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import type { AssessmentScale, Class, Grade, Student } from '../../domain';
import { initials } from '../../lib/utils';

const SUBJECT_OPTIONS = ['Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia', 'Arte', 'Educação Física', 'Inglês'];

export function GradesPage() {
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [period, setPeriod] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);
  const [draft, setDraft] = useState<Record<string, { scaleLevelCode?: string; numericScore?: number }>>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const canEdit = usePermission('grades', 'edit') || usePermission('grades', 'create');

  const classes = useLiveQuery<Class[]>(
    () => db.classes.filter((c) => c.status === 'active' && c.stage === 'elementary').toArray(),
    [],
  );
  const klass = classes?.find((c) => c.id === classId);

  const scale = useLiveQuery<AssessmentScale | undefined>(
    async () => {
      if (!klass) return undefined;
      const scales = await db.assessmentScales.filter((s) => s.schoolId === klass.schoolId && s.stage === 'elementary' && s.status === 'active').toArray();
      return scales.find((s) => s.isDefault) ?? scales[0];
    },
    [klass?.schoolId],
  );

  const students = useLiveQuery<Student[]>(
    () => (classId ? db.students.filter((s) => s.classId === classId && s.status === 'active').toArray() : Promise.resolve<Student[]>([])),
    [classId],
  );

  const existingGrades = useLiveQuery<Grade[]>(
    () =>
      classId && subject && period
        ? db.grades.filter((g) => g.classId === classId && g.subject === subject && g.period === period && g.isRecovery === isRecovery && g.status === 'active').toArray()
        : Promise.resolve<Grade[]>([]),
    [classId, subject, period, isRecovery],
  );

  const currentValues = useMemo(() => {
    const map: Record<string, { scaleLevelCode?: string; numericScore?: number }> = {};
    for (const g of existingGrades ?? []) map[g.studentId] = { scaleLevelCode: g.scaleLevelCode, numericScore: g.numericScore };
    return { ...map, ...draft };
  }, [existingGrades, draft]);

  const sortedLevels = useMemo(() => [...(scale?.levels ?? [])].sort((a, b) => a.order - b.order), [scale]);

  async function saveAll(status: 'draft' | 'published') {
    if (!session || !klass || !scale || !students) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    let count = 0;
    for (const student of students) {
      const value = currentValues[student.id];
      if (!value || (value.scaleLevelCode === undefined && value.numericScore === undefined)) continue;
      const existing = existingGrades?.find((g) => g.studentId === student.id);
      const payload = {
        studentId: student.id,
        classId,
        subject,
        period,
        scaleId: scale.id,
        scaleLevelCode: value.scaleLevelCode,
        numericScore: value.numericScore,
        isRecovery,
        publicationStatus: status,
      };
      if (existing) {
        await repositories.grades.update(existing.id, payload, actor);
      } else {
        await repositories.grades.create(payload, actor);
      }
      count++;
    }
    await repositories.audit.record({ ...actor, role: session.role }, { action: status === 'published' ? 'publish' : 'edit', module: 'grades' });
    setDraft({});
    setSavedMessage(`${count} nota(s) salva(s) como ${status === 'published' ? 'publicada(s)' : 'rascunho'}.`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Notas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Lançamento de notas por turma, disciplina e período, respeitando a escala configurada pela escola.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <FormField label="Turma" htmlFor="classId">
          <Select id="classId" value={classId} onChange={(e) => { setClassId(e.target.value); setDraft({}); setSavedMessage(null); }}>
            <option value="">Selecione…</option>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Disciplina" htmlFor="subject">
          <Input id="subject" list="subjects" value={subject} onChange={(e) => { setSubject(e.target.value); setSavedMessage(null); }} placeholder="Ex.: Matemática" />
          <datalist id="subjects">{SUBJECT_OPTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        </FormField>
        <FormField label="Período" htmlFor="period" hint="Ex.: 2026-B1">
          <Input id="period" value={period} onChange={(e) => { setPeriod(e.target.value); setSavedMessage(null); }} placeholder="2026-B1" />
        </FormField>
        <FormField label="Tipo" htmlFor="recovery">
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input id="recovery" type="checkbox" className="rounded border-slate-300" checked={isRecovery} onChange={(e) => setIsRecovery(e.target.checked)} />
            Recuperação
          </label>
        </FormField>
      </div>

      {(!classId || !subject || !period) && (
        <EmptyState icon={GraduationCap} title="Preencha turma, disciplina e período" description="Os campos acima definem quais alunos e notas serão exibidos." />
      )}

      {classId && subject && period && !scale && (
        <EmptyState icon={GraduationCap} title="Nenhuma escala de avaliação cadastrada para esta escola" description="O administrador precisa configurar uma escala (conceitos ou notas numéricas) antes de lançar notas." />
      )}

      {classId && subject && period && scale && (
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">{subject} — {period}{isRecovery ? ' (Recuperação)' : ''}</p>
                <p className="text-xs text-slate-500">Escala: {scale.name}</p>
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
                  {scale.type === 'numeric' ? (
                    <div className="w-24 shrink-0">
                      <Input
                        type="number"
                        step="0.1"
                        min={scale.minValue}
                        max={scale.maxValue}
                        disabled={!canEdit}
                        value={currentValues[student.id]?.numericScore ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [student.id]: { numericScore: e.target.value === '' ? undefined : Number(e.target.value) } }))}
                      />
                    </div>
                  ) : (
                    <div className="w-40 shrink-0">
                      <Select
                        disabled={!canEdit}
                        value={currentValues[student.id]?.scaleLevelCode ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [student.id]: { scaleLevelCode: e.target.value || undefined } }))}
                      >
                        <option value="">—</option>
                        {sortedLevels.map((l) => <option key={l.code} value={l.code}>{l.code} — {l.label}</option>)}
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {canEdit && students && students.length > 0 && (
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => saveAll('draft')}><Save className="h-4 w-4" /> Salvar como rascunho</Button>
                <Button onClick={() => saveAll('published')}><Save className="h-4 w-4" /> Publicar para as famílias</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
