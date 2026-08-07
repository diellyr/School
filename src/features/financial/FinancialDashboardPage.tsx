import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, Award, CheckCircle2, Clock, TrendingUp, Wallet } from 'lucide-react';
import { db } from '../../db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Select, Input } from '../../components/form/Field';
import { usePermission } from '../../auth/usePermission';
import { formatCurrencyBRL, formatCompetence } from '../../lib/utils';
import { nowIso } from '../../domain/common';
import { INSTALLMENT_STATUS_LABELS } from '../../domain';
import { computeFinancialSummary } from './services/financialDashboardService';

function currencyTooltipFormatter(value: unknown): string {
  return typeof value === 'number' ? formatCurrencyBRL(value) : String(value ?? '');
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8', due_soon: '#38bdf8', due_today: '#f59e0b', overdue: '#e11d48',
  paid: '#10b981', partially_paid: '#f59e0b', cancelled: '#cbd5e1', exempt: '#8b5cf6',
};

function StatCard({ icon: Icon, label, value, tone = 'sky' }: { icon: typeof Wallet; label: string; value: string; tone?: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' }) {
  const toneClasses = {
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${toneClasses[tone]}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinancialDashboardPage() {
  const canView = usePermission('financial', 'view');
  const today = nowIso();

  const [schoolFilter, setSchoolFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [competenceFilter, setCompetenceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scholarshipTypeFilter, setScholarshipTypeFilter] = useState('');

  const schools = useLiveQuery(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const classes = useLiveQuery(() => db.classes.filter((c) => c.status === 'active').toArray(), []);
  const students = useLiveQuery(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const scholarshipTypes = useLiveQuery(() => db.scholarshipTypes.filter((t) => t.status === 'active').toArray(), []) ?? [];
  const installments = useLiveQuery(() => db.installments.filter((i) => i.status === 'active').toArray(), []);
  const scholarshipAssignments = useLiveQuery(() => db.studentScholarships.filter((a) => a.status === 'active').toArray(), []) ?? [];

  const scholarshipTypeNameById = useMemo(() => new Map(scholarshipTypes.map((t) => [t.id, t.name])), [scholarshipTypes]);

  const filteredInstallments = useMemo(() => {
    if (!installments) return undefined;
    return installments.filter((i) => {
      if (schoolFilter && i.schoolId !== schoolFilter) return false;
      if (classFilter && i.classId !== classFilter) return false;
      if (studentFilter && i.studentId !== studentFilter) return false;
      if (competenceFilter && i.competence !== competenceFilter) return false;
      if (statusFilter) {
        const assignment = scholarshipAssignments.find((a) => a.id === i.appliedScholarshipAssignmentId);
        if (statusFilter === 'has_scholarship' && !assignment) return false;
      }
      if (scholarshipTypeFilter) {
        const assignment = scholarshipAssignments.find((a) => a.id === i.appliedScholarshipAssignmentId);
        if (assignment?.scholarshipTypeId !== scholarshipTypeFilter) return false;
      }
      return true;
    });
  }, [installments, schoolFilter, classFilter, studentFilter, competenceFilter, statusFilter, scholarshipTypeFilter, scholarshipAssignments]);

  const summary = useMemo(() => {
    if (!filteredInstallments) return undefined;
    return computeFinancialSummary(filteredInstallments, scholarshipAssignments, scholarshipTypeNameById, today);
  }, [filteredInstallments, scholarshipAssignments, scholarshipTypeNameById, today]);

  if (!canView) {
    return <EmptyState icon={Wallet} title="Sem acesso ao financeiro" description="Este painel exige permissão para visualizar dados financeiros." />;
  }

  const statusPieData = summary
    ? Object.entries(summary.statusBreakdown)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({ name: INSTALLMENT_STATUS_LABELS[status as keyof typeof INSTALLMENT_STATUS_LABELS], value: count, status }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard financeiro</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Visão geral de parcelas, recebimentos e bolsas.</p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Select value={schoolFilter} onChange={(e) => { setSchoolFilter(e.target.value); setClassFilter(''); }}>
            <option value="">Todas as escolas</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">Todas as turmas</option>
            {classes?.filter((c) => !schoolFilter || c.schoolId === schoolFilter).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
            <option value="">Todos os alunos</option>
            {students?.map((s) => <option key={s.id} value={s.id}>{s.socialName || s.fullName}</option>)}
          </Select>
          <Input type="month" value={competenceFilter} onChange={(e) => setCompetenceFilter(e.target.value)} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Com ou sem bolsa</option>
            <option value="has_scholarship">Somente com bolsa</option>
          </Select>
          <Select value={scholarshipTypeFilter} onChange={(e) => setScholarshipTypeFilter(e.target.value)}>
            <option value="">Todos os tipos de bolsa</option>
            {scholarshipTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </CardContent>
      </Card>

      {!summary && <p className="text-sm text-slate-500">Carregando…</p>}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Wallet} label="Previsto no período" value={formatCurrencyBRL(summary.totalForecastCents)} tone="sky" />
            <StatCard icon={CheckCircle2} label="Recebido" value={formatCurrencyBRL(summary.totalReceivedCents)} tone="emerald" />
            <StatCard icon={Clock} label="Pendente" value={formatCurrencyBRL(summary.totalPendingCents)} tone="amber" />
            <StatCard icon={AlertTriangle} label="Atrasado" value={formatCurrencyBRL(summary.totalOverdueCents)} tone="rose" />
            <StatCard icon={Award} label="Concedido em bolsas" value={formatCurrencyBRL(summary.totalScholarshipDiscountCents)} tone="violet" />
            <StatCard icon={TrendingUp} label="Taxa de inadimplência" value={`${(summary.delinquencyRate * 100).toFixed(1)}%`} tone="rose" />
            <StatCard icon={Award} label="Alunos com bolsa ativa" value={String(summary.studentsWithActiveScholarship)} tone="violet" />
            <StatCard icon={Clock} label="Bolsas vencendo em breve" value={String(summary.scholarshipsEndingSoon)} tone="amber" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Evolução mensal — previsto x recebido</CardTitle></CardHeader>
              <CardContent>
                {summary.monthlyReceived.length === 0 ? (
                  <EmptyState title="Sem dados no período" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={summary.monthlyReceived.map((m) => ({ ...m, competence: formatCompetence(m.competence) }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                      <XAxis dataKey="competence" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} width={60} />
                      <Tooltip formatter={currencyTooltipFormatter} />
                      <Legend />
                      <Line type="monotone" dataKey="forecastCents" name="Previsto" stroke="#38bdf8" strokeWidth={2} />
                      <Line type="monotone" dataKey="receivedCents" name="Recebido" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Distribuição por status</CardTitle></CardHeader>
              <CardContent>
                {statusPieData.length === 0 ? (
                  <EmptyState title="Sem parcelas no período" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {statusPieData.map((entry) => <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Previsto x recebido</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[{ name: 'Total', previsto: summary.totalForecastCents, recebido: summary.totalReceivedCents }]}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} width={60} />
                    <Tooltip formatter={currencyTooltipFormatter} />
                    <Legend />
                    <Bar dataKey="previsto" name="Previsto" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recebido" name="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Descontos concedidos por tipo de bolsa</CardTitle></CardHeader>
              <CardContent>
                {summary.discountByScholarshipType.length === 0 ? (
                  <EmptyState title="Nenhum desconto de bolsa no período" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={summary.discountByScholarshipType}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                      <XAxis dataKey="scholarshipTypeName" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} width={60} />
                      <Tooltip formatter={currencyTooltipFormatter} />
                      <Bar dataKey="discountCents" name="Desconto" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
