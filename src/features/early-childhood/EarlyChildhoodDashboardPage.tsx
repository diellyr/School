import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Baby, CalendarClock, MessageSquare, Sparkles, TrendingUp } from 'lucide-react';
import { StudentPicker } from '../../components/StudentPicker';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import {
  MIN_RADAR_SAMPLES,
  evolutionByPeriod,
  rboDistribution,
  useEarlyChildhoodDashboardData,
} from './useEarlyChildhoodDashboardData';
import { ALERT_LEVEL_LABELS, RBO_LABELS, type RboLevel } from '../../domain';
import { formatDate } from '../../lib/utils';

const RBO_COLORS: Record<RboLevel, string> = { R: '#e11d48', B: '#f59e0b', O: '#059669' };
const Y_LABELS = ['', 'R', 'B', 'O'];

export function EarlyChildhoodDashboardPage() {
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');

  const data = useEarlyChildhoodDashboardData(studentId);

  const distribution = useMemo(() => (data ? rboDistribution(data.rows) : { R: 0, B: 0, O: 0 }), [data]);
  const total = distribution.R + distribution.B + distribution.O;
  const evolution = useMemo(() => (data ? evolutionByPeriod(data.rows) : []), [data]);

  const byCategory = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; R: number; B: number; O: number }>();
    for (const row of data.rows) {
      const name = data.categoryById.get(row.activity.categoryId ?? '')?.name ?? 'Sem categoria';
      const entry = map.get(name) ?? { name, R: 0, B: 0, O: 0 };
      if (row.assessment.rboLevel) entry[row.assessment.rboLevel]++;
      map.set(name, entry);
    }
    return [...map.values()];
  }, [data]);

  const radarData = useMemo(() => {
    if (!data) return { points: [], hasEnoughData: false };
    const map = new Map<string, number[]>();
    for (const row of data.rows) {
      const field = data.categoryById.get(row.activity.categoryId ?? '')?.bnccField;
      if (!field || !row.assessment.rboLevel) continue;
      const values = map.get(field) ?? [];
      values.push({ R: 1, B: 2, O: 3 }[row.assessment.rboLevel]);
      map.set(field, values);
    }
    const points = [...map.entries()].map(([field, values]) => ({
      field,
      value: values.length >= MIN_RADAR_SAMPLES ? values.reduce((s, v) => s + v, 0) / values.length : null,
      count: values.length,
    }));
    return { points, hasEnoughData: points.some((p) => p.value !== null) };
  }, [data]);

  const attendanceRate = useMemo(() => {
    if (!data || data.attendance.length === 0) return null;
    const present = data.attendance.filter((a) => a.attendanceStatus === 'present').length;
    return Math.round((present / data.attendance.length) * 100);
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard — Educação Infantil</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Acompanhamento individual da criança. A escala R/B/O nunca é exibida como nota — apenas como tendência.
        </p>
      </div>

      <StudentPicker
        stage="early_childhood"
        schoolId={schoolId}
        classId={classId}
        studentId={studentId}
        onSchoolChange={setSchoolId}
        onClassChange={setClassId}
        onStudentChange={setStudentId}
      />

      {!studentId && (
        <EmptyState icon={Baby} title="Selecione uma criança" description="Use os filtros acima para escolher escola, turma e aluno." />
      )}

      {studentId && data && total === 0 && (
        <EmptyState
          icon={Sparkles}
          title="Dados insuficientes para análise"
          description="Ainda não há atividades avaliadas para esta criança neste período. Cadastre atividades em Atividades e avalie em Avaliações."
        />
      )}

      {studentId && data && total > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Atividades avaliadas" value={String(total)} icon={Sparkles} />
            <StatCard label="Ótimo" value={`${Math.round((distribution.O / total) * 100)}%`} icon={TrendingUp} tone="success" />
            <StatCard label="Bom" value={`${Math.round((distribution.B / total) * 100)}%`} icon={TrendingUp} tone="warning" />
            <StatCard label="Regular" value={`${Math.round((distribution.R / total) * 100)}%`} icon={TrendingUp} tone="danger" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Evolução ao longo dos períodos</CardTitle></CardHeader>
              <CardContent>
                {evolution.length < 2 ? (
                  <p className="text-sm text-slate-500">Dados insuficientes para mostrar evolução (é preciso mais de um período com registros).</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={evolution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis domain={[1, 3]} ticks={[1, 2, 3]} tickFormatter={(v) => Y_LABELS[v]} width={30} />
                      <Tooltip
                        formatter={(_value, _name, item) => {
                          const level = item.payload.avg >= 2.5 ? 'Ótimo' : item.payload.avg >= 1.5 ? 'Bom' : 'Regular';
                          return [`Tendência predominante: ${level} (${item.payload.count} registro(s))`, 'Período'];
                        }}
                      />
                      <Line type="monotone" dataKey="avg" stroke="#0284c7" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Distribuição por categoria</CardTitle></CardHeader>
              <CardContent>
                {byCategory.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem categorias registradas ainda.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byCategory}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} width={30} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="R" stackId="a" fill={RBO_COLORS.R} name="Regular" />
                      <Bar dataKey="B" stackId="a" fill={RBO_COLORS.B} name="Bom" />
                      <Bar dataKey="O" stackId="a" fill={RBO_COLORS.O} name="Ótimo" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Campos de experiência (BNCC)</CardTitle></CardHeader>
              <CardContent>
                {!radarData.hasEnoughData ? (
                  <p className="text-sm text-slate-500">
                    Dados insuficientes para o gráfico radar — são necessárias pelo menos {MIN_RADAR_SAMPLES} atividades
                    avaliadas por campo de experiência.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData.points.map((p) => ({ field: p.field, value: p.value ?? 0 }))}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="field" tick={{ fontSize: 10 }} />
                      <Radar dataKey="value" stroke="#0284c7" fill="#0284c7" fillOpacity={0.35} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Resumo do período</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Frequência</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{attendanceRate !== null ? `${attendanceRate}%` : 'Sem registros'}</span>
                </div>
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
          </div>

          <Card>
            <CardHeader><CardTitle>Linha do tempo</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.rows.slice().reverse().slice(0, 10).map((row) => (
                  <li key={row.assessment.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2 text-sm dark:border-slate-800">
                    <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="text-slate-500">{formatDate(row.activity.date)}</span>
                    <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{row.activity.title}</span>
                    {row.assessment.rboLevel && (
                      <Badge tone={row.assessment.rboLevel === 'R' ? 'danger' : row.assessment.rboLevel === 'B' ? 'warning' : 'success'}>
                        {RBO_LABELS[row.assessment.rboLevel]}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Sparkles; tone?: 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : tone === 'danger' ? 'text-rose-600' : 'text-sky-600';
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
