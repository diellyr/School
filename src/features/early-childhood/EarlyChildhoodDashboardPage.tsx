import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Baby, CalendarClock, MessageSquare, Sparkles, TrendingUp } from 'lucide-react';
import { db } from '../../db/schema';
import { StudentPicker } from '../../components/StudentPicker';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/form/Field';
import {
  MIN_RADAR_SAMPLES,
  rboDistribution,
  rowValue,
  useEarlyChildhoodDashboardData,
} from './useEarlyChildhoodDashboardData';
import { evolutionByGranularity, GRANULARITY_LABELS, type Granularity } from '../../lib/periodGranularity';
import { ALERT_LEVEL_LABELS, RBO_LABELS, type RboLevel } from '../../domain';
import { formatDate } from '../../lib/utils';

const RBO_COLORS: Record<RboLevel, string> = { R: '#e11d48', B: '#f59e0b', O: '#059669' };
const Y_LABELS = ['', 'R', 'B', 'O'];
const GRANULARITIES: Granularity[] = ['year', 'semester', 'bimester'];

// Anéis do gráfico radar, de fora para dentro: O (ótimo), B (bom), R (regular) e, no centro, o
// ponto zero — mesmas cores usadas em "Distribuição por categoria", para reforçar visualmente o
// mesmo código.
function RadarRadiusTick(props: { x?: string | number; y?: string | number; payload?: { value: number } }) {
  const { x, y, payload } = props;
  const value = payload?.value ?? 0;
  const label = Y_LABELS[value] as RboLevel | '';
  const color = label ? RBO_COLORS[label] : '#94a3b8';
  return (
    <text x={x} y={y} dy={4} textAnchor="middle" fontSize={10} fontWeight={600} fill={color}>
      {label || '0'}
    </text>
  );
}

export function EarlyChildhoodDashboardPage() {
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');

  // Chegando de um link "Ver dashboard" na ficha do aluno (?studentId=...): pré-seleciona escola,
  // turma e aluno de uma vez, em vez de deixar os filtros em branco.
  const [searchParams] = useSearchParams();
  const initialStudentId = searchParams.get('studentId');
  const initializedFromParam = useRef(false);
  const paramStudent = useLiveQuery(
    () => (initialStudentId && !initializedFromParam.current ? db.students.get(initialStudentId) : undefined),
    [initialStudentId],
  );
  useEffect(() => {
    if (paramStudent && !initializedFromParam.current) {
      initializedFromParam.current = true;
      setSchoolId(paramStudent.schoolId);
      setClassId(paramStudent.classId ?? '');
      setStudentId(paramStudent.id);
    }
  }, [paramStudent]);

  const data = useEarlyChildhoodDashboardData(studentId);
  const [categoryFilter, setCategoryFilter] = useState('');

  const distribution = useMemo(() => (data ? rboDistribution(data.rows) : { R: 0, B: 0, O: 0 }), [data]);
  const total = distribution.R + distribution.B + distribution.O;

  const categoryName = (row: NonNullable<typeof data>['rows'][number]) =>
    data?.categoryById.get(row.activity.categoryId ?? '')?.name ?? 'Sem categoria';

  const availableCategories = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.rows.map(categoryName))].sort((a, b) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (!categoryFilter) return data.rows;
    return data.rows.filter((r) => categoryName(r) === categoryFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, categoryFilter]);

  const evolutionByGranularityMap = useMemo(() => {
    const map = {} as Record<Granularity, { period: string; avg: number; count: number }[]>;
    for (const g of GRANULARITIES) {
      map[g] = evolutionByGranularity(filteredRows, g, (r) => r.activity.period, rowValue);
    }
    return map;
  }, [filteredRows]);

  const byCategory = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; R: number; B: number; O: number }>();
    for (const row of data.rows) {
      const name = categoryName(row);
      const entry = map.get(name) ?? { name, R: 0, B: 0, O: 0 };
      if (row.assessment.rboLevel) entry[row.assessment.rboLevel]++;
      map.set(name, entry);
    }
    // Ordem alfabética — garante que esta lista e a de `radarData` (radar + gráfico de barras
    // "mesma comparação") sempre mostrem as categorias na mesma posição, mesmo quando a primeira
    // atividade registrada de uma categoria ainda não tem R/B/O lançado.
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Compara todas as categorias entre si (não é afetado pelo filtro acima — o objetivo aqui é
  // mostrar em quais categorias a criança teve o melhor desempenho relativo, não uma só isolada).
  const radarData = useMemo(() => {
    if (!data) return { points: [], hasEnoughData: false };
    const map = new Map<string, number[]>();
    for (const row of data.rows) {
      if (!row.assessment.rboLevel) continue;
      const name = categoryName(row);
      const values = map.get(name) ?? [];
      values.push({ R: 1, B: 2, O: 3 }[row.assessment.rboLevel]);
      map.set(name, values);
    }
    const points = [...map.entries()]
      .map(([field, values]) => ({
        field,
        value: values.length >= MIN_RADAR_SAMPLES ? values.reduce((s, v) => s + v, 0) / values.length : null,
        count: values.length,
      }))
      .sort((a, b) => a.field.localeCompare(b.field));
    return { points, hasEnoughData: points.some((p) => p.value !== null) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Um registro por avaliação (não uma média) — cada categoria mostra uma barra fina por
  // atividade avaliada, na ordem em que aconteceram, cada uma com a cor do seu próprio nível.
  const recordsByCategory = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, RboLevel[]>();
    for (const row of data.rows) {
      if (!row.assessment.rboLevel) continue;
      const name = categoryName(row);
      const levels = map.get(name) ?? [];
      levels.push(row.assessment.rboLevel);
      map.set(name, levels);
    }
    return [...map.entries()].map(([name, levels]) => ({ name, levels })).sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const maxRecordsPerCategory = useMemo(
    () => recordsByCategory.reduce((max, c) => Math.max(max, c.levels.length), 0),
    [recordsByCategory],
  );

  const recordsChartData = useMemo(
    () =>
      recordsByCategory.map((c) => {
        const row: Record<string, string | number> = { name: c.name };
        c.levels.forEach((level, i) => {
          row[`v${i}`] = { R: 1, B: 2, O: 3 }[level];
          row[`level${i}`] = level;
        });
        return row;
      }),
    [recordsByCategory],
  );

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

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Evolução por período</CardTitle>
                {availableCategories.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Categoria:</span>
                    <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-auto">
                      <option value="">Todas</option>
                      {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {GRANULARITIES.map((granularity) => {
                  const points = evolutionByGranularityMap[granularity];
                  return (
                    <div key={granularity}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{GRANULARITY_LABELS[granularity]}</p>
                      {points.length < 2 ? (
                        <p className="text-sm text-slate-500">Dados insuficientes (é preciso mais de um período com registros).</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={points}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                            <YAxis domain={[1, 3]} ticks={[1, 2, 3]} tickFormatter={(v) => Y_LABELS[v]} width={26} />
                            <Tooltip
                              formatter={(_value, _name, item) => {
                                const level = item.payload.avg >= 2.5 ? 'Ótimo' : item.payload.avg >= 1.5 ? 'Bom' : 'Regular';
                                return [`Tendência predominante: ${level} (${item.payload.count} registro(s))`, 'Período'];
                              }}
                            />
                            <Line type="monotone" dataKey="avg" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
              <CardHeader><CardTitle>Comparação entre categorias</CardTitle></CardHeader>
              <CardContent>
                {!radarData.hasEnoughData ? (
                  <div className="text-sm text-slate-500">
                    <p>
                      Dados insuficientes para o gráfico radar — cada categoria precisa de pelo menos{' '}
                      {MIN_RADAR_SAMPLES} avaliações lançadas para entrar no gráfico (não é sobre ter{' '}
                      {MIN_RADAR_SAMPLES} categorias diferentes).
                    </p>
                    {radarData.points.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs">
                        {radarData.points.map((p) => (
                          <li key={p.field}>
                            {p.field}: {p.count}/{MIN_RADAR_SAMPLES}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <RadarChart data={radarData.points.map((p) => ({ field: p.field, value: p.value ?? 0 }))}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="field" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={RadarRadiusTick} axisLine={false} />
                        <Radar dataKey="value" stroke="#0284c7" fill="#0284c7" fillOpacity={0.35} />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RBO_COLORS.O }} />
                        Ótimo — 1º anel (borda externa)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RBO_COLORS.B }} />
                        Bom — 2º anel
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RBO_COLORS.R }} />
                        Regular — 3º anel
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                        0 — centro
                      </span>
                    </div>

                    <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Mesma comparação, em barras
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={radarData.points.map((p) => ({ field: p.field, value: p.value ?? 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                        <XAxis dataKey="field" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                        <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tickFormatter={(v) => Y_LABELS[v] || '0'} width={26} />
                        <Tooltip formatter={(v) => [Y_LABELS[Math.round(Number(v))] || '0', 'Tendência predominante']} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {radarData.points.map((p) => (
                            <Cell key={p.field} fill={p.value === null ? '#94a3b8' : p.value >= 2.5 ? RBO_COLORS.O : p.value >= 1.5 ? RBO_COLORS.B : RBO_COLORS.R} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Registros por categoria</CardTitle></CardHeader>
              <CardContent>
                {recordsChartData.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem categorias registradas ainda.</p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                      Cada barra é uma avaliação individual (não uma média) — na ordem em que foram lançadas.
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={recordsChartData} barGap={2} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                        <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tickFormatter={(v) => Y_LABELS[v] || ''} width={26} />
                        <Tooltip
                          formatter={(value, name) => [
                            Y_LABELS[Math.round(Number(value))] || '',
                            `Registro ${Number(String(name).replace('v', '')) + 1}`,
                          ]}
                        />
                        {Array.from({ length: maxRecordsPerCategory }).map((_, i) => (
                          <Bar key={i} dataKey={`v${i}`} barSize={8} radius={[2, 2, 0, 0]}>
                            {recordsChartData.map((row, idx) => (
                              <Cell key={idx} fill={row[`level${i}`] ? RBO_COLORS[row[`level${i}`] as RboLevel] : 'transparent'} />
                            ))}
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RBO_COLORS.O }} />
                        Ótimo
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RBO_COLORS.B }} />
                        Bom
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RBO_COLORS.R }} />
                        Regular
                      </span>
                    </div>
                  </>
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
