import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Award, Wallet } from 'lucide-react';
import { db } from '../../db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { usePermission } from '../../auth/usePermission';
import { formatCompetence, formatCurrencyBRL, formatDate } from '../../lib/utils';
import { nowIso } from '../../domain/common';
import { INSTALLMENT_STATUS_LABELS, SCHOLARSHIP_ASSIGNMENT_STATUS_LABELS } from '../../domain';
import { computeInstallmentStatus, remainingAmountCents } from '../financial/services/financialCalculationService';
import { computeScholarshipStatus } from '../financial/services/scholarshipService';

/** Seção financeira do perfil do aluno (seção 6). Respeita permissão — quem não pode
 *  ver dados financeiros (ex.: professor sem autorização) não vê esta seção. */
export function StudentFinancialSection({ studentId }: { studentId: string }) {
  const canView = usePermission('financial', 'view');
  const today = nowIso();

  const installments = useLiveQuery(
    () => db.installments.filter((i) => i.status === 'active' && i.studentId === studentId).toArray(),
    [studentId],
  );
  const scholarships = useLiveQuery(
    () => db.studentScholarships.filter((a) => a.status === 'active' && a.studentId === studentId).toArray(),
    [studentId],
  );
  const notifications = useLiveQuery(
    () => db.notifications.filter((n) =>
      n.status === 'active' && n.studentId === studentId && n.notificationStatus === 'pending'
      && (n.category === 'financial' || n.category === 'scholarship'),
    ).toArray(),
    [studentId],
  );

  const currentScholarship = useMemo(() => {
    if (!scholarships) return null;
    return scholarships
      .filter((a) => {
        const status = computeScholarshipStatus(a, today);
        return status === 'active' || status === 'ending_soon' || status === 'scheduled';
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
  }, [scholarships, today]);

  const baseAmountCents = useMemo(() => {
    const mensalidades = (installments ?? []).filter((i) => i.chargeType === 'mensalidade');
    return mensalidades.sort((a, b) => b.competence.localeCompare(a.competence))[0]?.originalAmountCents;
  }, [installments]);

  const upcoming = useMemo(() => {
    return (installments ?? [])
      .filter((i) => ['pending', 'due_soon', 'due_today'].includes(computeInstallmentStatus(i, today)))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
  }, [installments, today]);

  const overdue = (installments ?? []).filter((i) => computeInstallmentStatus(i, today) === 'overdue');
  const paid = (installments ?? []).filter((i) => computeInstallmentStatus(i, today) === 'paid');
  const totalPaidCents = (installments ?? []).reduce((sum, i) => sum + i.paidAmountCents, 0);
  const totalPendingCents = (installments ?? [])
    .filter((i) => ['pending', 'due_soon', 'due_today', 'overdue', 'partially_paid'].includes(computeInstallmentStatus(i, today)))
    .reduce((sum, i) => sum + remainingAmountCents(i), 0);

  if (!canView) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financeiro</CardTitle>
        <Link to={`/parcelas?studentId=${studentId}`}>
          <Button variant="outline" size="sm"><Wallet className="h-4 w-4" /> Ver no módulo financeiro <ArrowRight className="h-3.5 w-3.5" /></Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Mensalidade base</p>
            <p className="font-medium text-slate-800 dark:text-slate-100">{baseAmountCents !== undefined ? formatCurrencyBRL(baseAmountCents) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total pago</p>
            <p className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrencyBRL(totalPaidCents)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total pendente</p>
            <p className="font-medium text-amber-600 dark:text-amber-400">{formatCurrencyBRL(totalPendingCents)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Parcelas atrasadas</p>
            <p className={`font-medium ${overdue.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>{overdue.length}</p>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500"><Award className="h-3.5 w-3.5" /> Bolsa atual</p>
          {currentScholarship ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-100">{currentScholarship.percentage}%</span>
              <Badge tone="success">{SCHOLARSHIP_ASSIGNMENT_STATUS_LABELS[computeScholarshipStatus(currentScholarship, today)]}</Badge>
              <span className="text-slate-500">
                {formatDate(currentScholarship.startDate)} – {currentScholarship.endDate ? formatDate(currentScholarship.endDate) : 'indeterminado'}
              </span>
            </div>
          ) : (
            <p className="text-slate-500">Nenhuma bolsa ativa.</p>
          )}
          {scholarships && scholarships.length > 0 && (
            <Link to={`/bolsas?studentId=${studentId}`} className="mt-1 inline-block text-xs text-sky-600 hover:underline dark:text-sky-400">
              Ver histórico de bolsas ({scholarships.length})
            </Link>
          )}
        </div>

        {notifications && notifications.length > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5" /> Alertas financeiros
            </p>
            {notifications.slice(0, 3).map((n) => (
              <div key={n.id} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                {n.title}
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Próximas parcelas</p>
          {upcoming.length === 0 && paid.length === 0 && overdue.length === 0 ? (
            <p className="text-slate-500">Nenhuma parcela cadastrada.</p>
          ) : upcoming.length === 0 ? (
            <p className="text-slate-500">Nenhuma parcela pendente no momento.</p>
          ) : (
            <ul className="space-y-1">
              {upcoming.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 dark:border-slate-800">
                  <span>{formatCompetence(i.competence)} · vence {formatDate(i.dueDate)}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrencyBRL(i.finalAmountCents)}</span>
                    <Badge tone="default">{INSTALLMENT_STATUS_LABELS[computeInstallmentStatus(i, today)]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
