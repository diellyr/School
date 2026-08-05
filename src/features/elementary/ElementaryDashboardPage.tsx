import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BookOpen, CalendarClock, GraduationCap, MessageSquare, RotateCcw } from 'lucide-react';
import { StudentPicker } from '../../components/StudentPicker';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { useElementaryDashboardData, normalizedScore, displayGrade } from './useElementaryDashboardData';
import { ALERT_LEVEL_LABELS } from '../../domain';

export function ElementaryDashboardPage() {
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');

  const data = useElementaryDashboardData(studentId);

  const bySubject = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number[]>();
    for (const g of data.grades) {
      const score = normalizedScore(g, data.scalesById.get(g.scaleId));
      if (score === null) continue;
      const values = map.get(g.subject) ?? [];
      values.push(score);
      map.set(g.subject, values);
    }
    return [...map.entries()].map(([subject, values]) => ({ subject, avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length) }));
  }, [data]);

  const evolution = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number[]>();
    for (const g of data.grades) {
      const score = normalizedScore(g, data.scalesById.get(g.scaleId));
      if (score === null) continue;
      const values = map.get(g.period) ?? [];
      values.push(score);
      map.set(g.period, values);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, values]) => ({
      period,
      avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
    }));
  }, [data]);

  const attendanceRate = useMemo(() => {
    if (!data || data.attendance.length === 0) return null;
    const present = data.attendance.filter((a) => a.attendanceStatus === 'present').length;
    return Math.round((present / data.attendance.length) * 100);
  }, [data]);

  const recoveryCount = data?.grades.filter((g) => g.isRecovery).length ?? 0;
  const belowCriteria = useMemo(() => {
    if (!data) return 0;
    return data.grades.filter((g) => {
      const score = normalizedScore(g, data.scalesById.get(g.scaleId));
      return score !== null && score < 50;
    }).length;
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard — Ensino Fundamental</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Notas normalizadas por escala apenas para gráficos de tendência — o boletim mostra o valor real lançado.</p>
      </div>

      <StudentPicker
        stage="elementary"
        schoolId={schoolId}
        classId={classId}
        studentId={studentId}
        onSchoolChange={setSchoolId}
        onClassChange={setClassId}
        onStudentChange={setStudentId}
      />

      {!studentId && <EmptyState icon={GraduationCap} title="Selecione um aluno" description="Use os filtros acima para escolher escola, turma e aluno." />}

      {studentId && data && data.grades.length === 0 && (
        <EmptyState icon={BookOpen} title="Dados insuficientes para análise" description="Ainda não há notas lançadas para este aluno. Lance notas em Notas." />
      )}

      {studentId && data && data.grades.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={BookOpen} label="Notas lançadas" value={String(data.grades.length)} />
            <StatCard icon={GraduationCap} label="Frequência" value={attendanceRate !== null ? `${attendanceRate}%` : 'Sem registros'} />
            <StatCard icon={RotateCcw} label="Recuperações" value={String(recoveryCount)} tone={recoveryCount > 0 ? 'warning' : undefined} />
            <StatCard icon={AlertTriangle} label="Abaixo do critério (50%)" value={String(belowCriteria)} tone={belowCriteria > 0 ? 'danger' : undefined} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Média por disciplina (normalizada)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bySubject}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                    <XAxis dataKey="subject" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis domain={[0, 100]} width={35} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Desempenho relativo']} />
                    <Bar dataKey="avg" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Evolução por período</CardTitle></CardHeader>
              <CardContent>
                {evolution.length < 2 ? (
                  <p className="text-sm text-slate-500">Dados insuficientes para mostrar evolução (é preciso mais de um período com notas).</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={evolution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} width={35} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Desempenho relativo']} />
                      <Line type="monotone" dataKey="avg" stroke="#0284c7" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Tabela de notas</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                    <tr>
                      <th className="py-2 pr-3">Disciplina</th>
                      <th className="py-2 pr-3">Período</th>
                      <th className="py-2 pr-3">Nota/Conceito</th>
                      <th className="py-2 pr-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.grades.slice().reverse().map((g) => (
                      <tr key={g.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{g.subject}</td>
                        <td className="py-2 pr-3 text-slate-500">{g.period}</td>
                        <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-100">{displayGrade(g, data.scalesById.get(g.scaleId))}</td>
                        <td className="py-2 pr-3">
                          {g.isRecovery ? <Badge tone="warning">Recuperação</Badge> : <Badge tone={g.publicationStatus === 'published' ? 'success' : 'default'}>{g.publicationStatus === 'published' ? 'Publicada' : 'Rascunho'}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Observações recentes</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{data.observations.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Alertas ativos</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{data.alerts.length}</span>
                </div>
                {data.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    <Badge tone="warning" className="mb-1">{ALERT_LEVEL_LABELS[alert.level]}</Badge>
                    <p>{alert.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Linha do tempo</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.grades.slice().reverse().slice(0, 8).map((g) => (
                    <li key={g.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2 text-sm dark:border-slate-800">
                      <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{g.subject} — {g.period}</span>
                      <Badge>{displayGrade(g, data.scalesById.get(g.scaleId))}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof BookOpen; label: string; value: string; tone?: 'warning' | 'danger' }) {
  const toneClass = tone === 'warning' ? 'text-amber-600' : tone === 'danger' ? 'text-rose-600' : 'text-sky-600';
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${toneClass}`} />
        <div>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
