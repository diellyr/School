import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Save } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import { RBO_LABELS, type Assessment, type RboLevel, type Student } from '../../domain';
import { formatDate, initials } from '../../lib/utils';

const RBO_OPTIONS: RboLevel[] = ['R', 'B', 'O'];
const RBO_TONE: Record<RboLevel, 'danger' | 'warning' | 'success'> = { R: 'danger', B: 'warning', O: 'success' };

export function AssessmentsPage() {
  const [activityId, setActivityId] = useState('');
  const [draft, setDraft] = useState<Record<string, RboLevel | undefined>>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const canEdit = usePermission('assessments', 'edit') || usePermission('assessments', 'create');

  const activities = useLiveQuery(async () => {
    const items = await db.activities.filter((a) => a.status === 'active').toArray();
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  const activity = activities?.find((a) => a.id === activityId);

  const classes = useLiveQuery(() => db.classes.toArray(), []);
  const klass = classes?.find((c) => c.id === activity?.classId);

  const students = useLiveQuery<Student[]>(
    () => (activity ? db.students.filter((s) => s.classId === activity.classId && s.status === 'active').toArray() : Promise.resolve<Student[]>([])),
    [activity?.classId],
  );

  const existingAssessments = useLiveQuery<Assessment[]>(
    () => (activityId ? db.assessments.filter((a) => a.activityId === activityId).toArray() : Promise.resolve<Assessment[]>([])),
    [activityId],
  );

  const currentValues: Record<string, RboLevel | undefined> = useMemo(() => {
    const map: Record<string, RboLevel | undefined> = {};
    for (const a of existingAssessments ?? []) {
      if (a.rboLevel) map[a.studentId] = a.rboLevel;
    }
    return { ...map, ...draft };
  }, [existingAssessments, draft]);

  async function saveAll(status: 'draft' | 'published') {
    if (!session || !activity || !students) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    let count = 0;
    for (const student of students) {
      const level = currentValues[student.id];
      if (!level) continue;
      const existing = existingAssessments?.find((a) => a.studentId === student.id);
      if (existing) {
        await repositories.assessments.update(existing.id, { rboLevel: level, publicationStatus: status, publishedAt: status === 'published' ? new Date().toISOString() : undefined }, actor);
      } else {
        await repositories.assessments.create(
          { activityId: activity.id, studentId: student.id, stage: 'early_childhood', rboLevel: level, publicationStatus: status, publishedAt: status === 'published' ? new Date().toISOString() : undefined },
          actor,
        );
      }
      count++;
    }
    await repositories.audit.record({ ...actor, role: session.role }, { action: status === 'published' ? 'publish' : 'edit', module: 'assessments', entityId: activity.id });
    setDraft({});
    setSavedMessage(`${count} avaliação(ões) salva(s) como ${status === 'published' ? 'publicada(s)' : 'rascunho'}.`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Avaliações</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Escolha uma atividade e registre a classificação R (Regular), B (Bom) ou O (Ótimo) de cada aluno.
        </p>
      </div>

      <div className="mb-4 max-w-md">
        <Select value={activityId} onChange={(e) => { setActivityId(e.target.value); setDraft({}); setSavedMessage(null); }}>
          <option value="">Selecione uma atividade…</option>
          {activities?.map((a) => (
            <option key={a.id} value={a.id}>{a.title} — {formatDate(a.date)} ({a.period})</option>
          ))}
        </Select>
      </div>

      {!activity && (
        <EmptyState icon={BookOpen} title="Selecione uma atividade acima" description="Ou cadastre uma nova em Atividades." />
      )}

      {activity && (
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">{activity.title}</p>
                <p className="text-xs text-slate-500">{klass?.name} · {activity.period}</p>
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
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {student.socialName || student.fullName}
                  </span>
                  <div className="flex gap-1.5">
                    {RBO_OPTIONS.map((level) => {
                      const active = currentValues[student.id] === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setDraft((d) => ({ ...d, [student.id]: level }))}
                          className={`h-9 w-16 rounded-lg text-xs font-semibold transition-colors ${
                            active
                              ? level === 'R'
                                ? 'bg-rose-600 text-white'
                                : level === 'B'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                          title={RBO_LABELS[level]}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {canEdit && students && students.length > 0 && (
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => saveAll('draft')}>
                  <Save className="h-4 w-4" /> Salvar como rascunho
                </Button>
                <Button onClick={() => saveAll('published')}>
                  <Save className="h-4 w-4" /> Publicar para as famílias
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-3 flex gap-3 text-xs text-slate-400">
        {RBO_OPTIONS.map((l) => (
          <span key={l} className="flex items-center gap-1">
            <Badge tone={RBO_TONE[l]}>{l}</Badge> {RBO_LABELS[l]}
          </span>
        ))}
      </div>
    </div>
  );
}
