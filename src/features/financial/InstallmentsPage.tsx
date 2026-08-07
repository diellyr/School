import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { Ban, CheckCircle2, Download, Plus, RotateCcw, ShieldOff, Wallet } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Card, CardContent } from '../../components/Card';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { Input, Label, Select, Textarea } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { useCurrentRole, usePermission } from '../../auth/usePermission';
import { downloadCsv } from '../../lib/csv';
import { formatCompetence, formatCurrencyBRL, formatDate } from '../../lib/utils';
import { nowIso } from '../../domain/common';
import type { Installment, InstallmentStatus, PaymentMethod } from '../../domain';
import { INSTALLMENT_STATUS_LABELS } from '../../domain';
import { computeInstallmentStatus } from './services/financialCalculationService';
import { PaymentDialog, UndoPaymentDialog } from './components/PaymentDialog';
import { GenerateInstallmentsDialog } from './components/GenerateInstallmentsDialog';
import type { InstallmentDraft } from './services/installmentGeneratorService';

const STATUS_TONE: Record<InstallmentStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  pending: 'default', due_soon: 'info', due_today: 'warning', overdue: 'danger',
  paid: 'success', partially_paid: 'warning', cancelled: 'default', exempt: 'purple',
};

export function InstallmentsPage() {
  const role = useCurrentRole();
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const canCreate = usePermission('financial', 'create');
  const canEdit = usePermission('financial', 'edit');
  const canApprove = usePermission('financial', 'approve');
  const canExport = usePermission('financial', 'export');
  const canManage = canCreate || canEdit;

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [competenceFilter, setCompetenceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [studentIdFilter, setStudentIdFilter] = useState(searchParams.get('studentId') ?? '');
  const appliedStudentParam = useRef(false);

  useEffect(() => {
    const fromUrl = searchParams.get('studentId');
    if (fromUrl && !appliedStudentParam.current) {
      appliedStudentParam.current = true;
      setStudentIdFilter(fromUrl);
    }
  }, [searchParams]);

  function clearStudentFilter() {
    setStudentIdFilter('');
    const next = new URLSearchParams(searchParams);
    next.delete('studentId');
    setSearchParams(next, { replace: true });
  }
  const [payTarget, setPayTarget] = useState<Installment | null>(null);
  const [undoTarget, setUndoTarget] = useState<Installment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ installment: Installment; mode: 'cancelled' | 'exempt' } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);

  const today = nowIso();

  const students = useLiveQuery(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const schools = useLiveQuery(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const classes = useLiveQuery(() => db.classes.filter((c) => c.status === 'active').toArray(), []);
  const scholarshipAssignments = useLiveQuery(() => db.studentScholarships.filter((s) => s.status === 'active').toArray(), []) ?? [];

  const installments = useLiveQuery(async () => {
    const all = await db.installments.filter((i) => i.status === 'active').toArray();
    let scoped = all;
    if (role === 'guardian' && session?.user.guardianId) {
      const links = await db.studentGuardians.filter((l) => l.guardianId === session.user.guardianId && l.status === 'active').toArray();
      const ids = new Set(links.map((l) => l.studentId));
      scoped = all.filter((i) => ids.has(i.studentId));
    } else if (role === 'student' && session?.user.studentId) {
      scoped = all.filter((i) => i.studentId === session.user.studentId);
    }
    return scoped.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [role, session?.user.guardianId, session?.user.studentId]);

  const studentName = (id: string) => {
    const s = students?.find((s) => s.id === id);
    return s ? (s.socialName || s.fullName) : '—';
  };
  const className = (id?: string) => classes?.find((c) => c.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    if (!installments) return undefined;
    return installments.filter((i) => {
      if (studentIdFilter && i.studentId !== studentIdFilter) return false;
      if (schoolFilter && i.schoolId !== schoolFilter) return false;
      if (classFilter && i.classId !== classFilter) return false;
      if (competenceFilter && i.competence !== competenceFilter) return false;
      if (statusFilter && computeInstallmentStatus(i, today) !== statusFilter) return false;
      if (search && !studentName(i.studentId).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [installments, studentIdFilter, schoolFilter, classFilter, competenceFilter, statusFilter, search, students, today]);

  async function actor() {
    if (!session) throw new Error('Sessão inválida.');
    return { userId: session.user.id, organizationId: session.user.organizationId };
  }

  async function handleConfirmPayment(input: { paymentDate: string; amountCents: number; paymentMethod: PaymentMethod; notes: string; receiptRef: string }) {
    if (!payTarget || !session) return;
    const act = await actor();
    const newPaidAmount = payTarget.paidAmountCents + input.amountCents;
    const newStatus: InstallmentStatus = newPaidAmount >= payTarget.finalAmountCents ? 'paid' : 'partially_paid';

    await repositories.installments.update(payTarget.id, {
      paidAmountCents: newPaidAmount,
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      notes: input.notes || payTarget.notes,
      receiptRef: input.receiptRef || payTarget.receiptRef,
      installmentStatus: newStatus,
    }, act);

    await repositories.payments.create({
      installmentId: payTarget.id, studentId: payTarget.studentId, amountCents: input.amountCents,
      paymentDate: input.paymentDate, paymentMethod: input.paymentMethod, notes: input.notes,
    }, act);

    await repositories.audit.record({ ...act, role: session.role }, {
      action: 'edit', module: 'financial', entityId: payTarget.id,
      previousValue: { paidAmountCents: payTarget.paidAmountCents, installmentStatus: payTarget.installmentStatus },
      newValue: { paidAmountCents: newPaidAmount, installmentStatus: newStatus },
    });

    await repositories.notifications.resolveByRelatedEntity('installment', payTarget.id, act);
    setPayTarget(null);
  }

  async function handleUndoPayment(reason: string) {
    if (!undoTarget || !session) return;
    const act = await actor();
    await repositories.installments.update(undoTarget.id, {
      paidAmountCents: 0, paymentDate: undefined, installmentStatus: 'pending',
    }, act);
    await repositories.audit.record({ ...act, role: session.role }, {
      action: 'edit', module: 'financial', entityId: undoTarget.id, reason,
      previousValue: { paidAmountCents: undoTarget.paidAmountCents, installmentStatus: undoTarget.installmentStatus },
      newValue: { paidAmountCents: 0, installmentStatus: 'pending' },
    });
    setUndoTarget(null);
  }

  async function handleCancelOrExempt() {
    if (!cancelTarget || !session) return;
    const act = await actor();
    const { installment, mode } = cancelTarget;
    await repositories.installments.update(installment.id, { installmentStatus: mode }, act);
    await repositories.audit.record({ ...act, role: session.role }, {
      action: 'edit', module: 'financial', entityId: installment.id, reason: cancelReason,
      previousValue: { installmentStatus: installment.installmentStatus },
      newValue: { installmentStatus: mode },
    });
    await repositories.notifications.resolveByRelatedEntity('installment', installment.id, act);
    setCancelTarget(null);
    setCancelReason('');
  }

  async function handleGenerate(drafts: InstallmentDraft[]) {
    if (!session) return;
    const act = await actor();
    for (const d of drafts) {
      const created = await repositories.installments.create({
        ...d, installmentStatus: 'pending', paidAmountCents: 0,
      }, act);
      await repositories.audit.record({ ...act, role: session.role }, { action: 'create', module: 'financial', entityId: created.id });
    }
  }

  function exportCsv() {
    if (!filtered) return;
    downloadCsv(
      'parcelas',
      ['Aluno', 'Turma', 'Competência', 'Descrição', 'Valor original', 'Desconto bolsa', 'Valor final', 'Vencimento', 'Status', 'Pago'],
      filtered.map((i) => [
        studentName(i.studentId), className(i.classId), formatCompetence(i.competence), i.description,
        formatCurrencyBRL(i.originalAmountCents), formatCurrencyBRL(i.scholarshipDiscountCents), formatCurrencyBRL(i.finalAmountCents),
        formatDate(i.dueDate), INSTALLMENT_STATUS_LABELS[computeInstallmentStatus(i, today)], formatCurrencyBRL(i.paidAmountCents),
      ]),
    );
  }

  async function exportPaymentsCsv() {
    if (!filtered) return;
    const ids = new Set(filtered.map((i) => i.id));
    const allPayments = await repositories.payments.list();
    const relevant = allPayments.filter((p) => ids.has(p.installmentId) && !p.reversedAt);
    downloadCsv(
      'pagamentos',
      ['Aluno', 'Valor', 'Data do pagamento', 'Forma de pagamento', 'Observação'],
      relevant.map((p) => [studentName(p.studentId), formatCurrencyBRL(p.amountCents), formatDate(p.paymentDate), p.paymentMethod, p.notes ?? '']),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Parcelas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Mensalidades, cobranças e baixas de pagamento.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard-financeiro"><Button variant="outline"><Wallet className="h-4 w-4" /> Dashboard financeiro</Button></Link>
          {canExport && <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar parcelas</Button>}
          {canExport && <Button variant="outline" onClick={exportPaymentsCsv}><Download className="h-4 w-4" /> Exportar pagamentos</Button>}
          {canCreate && <Button onClick={() => setGenerateOpen(true)}><Plus className="h-4 w-4" /> Nova cobrança</Button>}
        </div>
      </div>

      {studentIdFilter && (
        <div className="flex items-center gap-2">
          <Badge tone="info">Filtrando por: {studentName(studentIdFilter)}</Badge>
          <button className="text-xs text-sky-600 hover:underline dark:text-sky-400" onClick={clearStudentFilter}>
            limpar filtro
          </button>
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder="Buscar aluno…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={schoolFilter} onChange={(e) => { setSchoolFilter(e.target.value); setClassFilter(''); }}>
            <option value="">Todas as escolas</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">Todas as turmas</option>
            {classes?.filter((c) => !schoolFilter || c.schoolId === schoolFilter).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input type="month" value={competenceFilter} onChange={(e) => setCompetenceFilter(e.target.value)} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(INSTALLMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </CardContent>
      </Card>

      {filtered === undefined && <SkeletonList />}
      {filtered && filtered.length === 0 && (
        <EmptyState icon={Wallet} title="Nenhuma parcela encontrada" description="Ajuste os filtros ou gere novas cobranças." />
      )}
      {filtered && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Aluno</th>
                  <th className="px-4 py-3">Competência</th>
                  <th className="px-4 py-3">Valor original</th>
                  <th className="px-4 py-3">Bolsa</th>
                  <th className="px-4 py-3">Valor final</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const status = computeInstallmentStatus(i, today);
                  const canPay = canManage && status !== 'paid' && status !== 'cancelled' && status !== 'exempt';
                  const canUndo = canApprove && (status === 'paid' || status === 'partially_paid');
                  const canCancel = canManage && status !== 'paid' && status !== 'cancelled' && status !== 'exempt';
                  return (
                    <tr key={i.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{studentName(i.studentId)}</td>
                      <td className="px-4 py-3">{formatCompetence(i.competence)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatCurrencyBRL(i.originalAmountCents)}</td>
                      <td className="px-4 py-3 text-slate-500">{i.scholarshipDiscountCents > 0 ? `- ${formatCurrencyBRL(i.scholarshipDiscountCents)}` : '—'}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrencyBRL(i.finalAmountCents)}</td>
                      <td className="px-4 py-3">{formatDate(i.dueDate)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[status]}>{INSTALLMENT_STATUS_LABELS[status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {canPay && (
                            <Button size="sm" variant="outline" onClick={() => setPayTarget(i)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Dar baixa
                            </Button>
                          )}
                          {canUndo && (
                            <Button size="sm" variant="ghost" onClick={() => setUndoTarget(i)}>
                              <RotateCcw className="h-3.5 w-3.5" /> Desfazer
                            </Button>
                          )}
                          {canCancel && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setCancelTarget({ installment: i, mode: 'cancelled' })} title="Cancelar parcela">
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setCancelTarget({ installment: i, mode: 'exempt' })} title="Marcar como isenta">
                                <ShieldOff className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PaymentDialog
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        installment={payTarget}
        studentName={payTarget ? studentName(payTarget.studentId) : ''}
        onConfirm={handleConfirmPayment}
      />
      <UndoPaymentDialog open={!!undoTarget} onClose={() => setUndoTarget(null)} onConfirm={handleUndoPayment} />

      <Dialog
        open={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelReason(''); }}
        title={cancelTarget?.mode === 'exempt' ? 'Marcar parcela como isenta' : 'Cancelar parcela'}
        description="Esta ação encerra os alertas pendentes relacionados e fica registrada no histórico."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="cancel-reason">Motivo</Label>
            <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Explique o motivo (opcional)" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setCancelTarget(null); setCancelReason(''); }} type="button">Voltar</Button>
            <Button variant="danger" onClick={handleCancelOrExempt} type="button">Confirmar</Button>
          </div>
        </div>
      </Dialog>

      <GenerateInstallmentsDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        existingInstallments={installments ?? []}
        scholarshipAssignments={scholarshipAssignments}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
