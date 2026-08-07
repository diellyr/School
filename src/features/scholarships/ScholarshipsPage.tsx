import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import { Award, Download, Pencil, Plus } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { usePermission } from '../../auth/usePermission';
import { formatDate } from '../../lib/utils';
import { downloadCsv } from '../../lib/csv';
import { nowIso } from '../../domain/common';
import type { ScholarshipAssignmentStatus, ScholarshipType, StudentScholarship } from '../../domain';
import { SCHOLARSHIP_ASSIGNMENT_STATUS_LABELS } from '../../domain';
import { calculateFinalAmountCents, calculateScholarshipDiscountCents } from '../financial/services/financialCalculationService';
import { computeScholarshipStatus } from '../financial/services/scholarshipService';
import { ScholarshipTypeDialog, type ScholarshipTypeFormValues } from './components/ScholarshipTypeDialog';
import { AssignScholarshipDialog, type AssignScholarshipInput } from './components/AssignScholarshipDialog';
import { EditScholarshipDialog } from './components/EditScholarshipDialog';

const STATUS_TONE: Record<ScholarshipAssignmentStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  scheduled: 'info', active: 'success', ending_soon: 'warning', expired: 'default', cancelled: 'default', suspended: 'danger',
};

export function ScholarshipsPage() {
  const [searchParams] = useSearchParams();
  const studentIdFilter = searchParams.get('studentId') ?? '';
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const canCreate = usePermission('scholarships', 'create');
  const canEdit = usePermission('scholarships', 'edit');
  const canExport = usePermission('scholarships', 'export');
  const canManage = canCreate || canEdit;

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ScholarshipType | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<StudentScholarship | null>(null);

  const today = nowIso();
  const types = useLiveQuery(() => db.scholarshipTypes.filter((t) => t.status === 'active').toArray(), []);
  const assignments = useLiveQuery(() => db.studentScholarships.filter((a) => a.status === 'active').toArray(), []);
  const students = useLiveQuery(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const allInstallments = useLiveQuery(() => db.installments.filter((i) => i.status === 'active').toArray(), []);

  const studentName = (id: string) => {
    const s = students?.find((s) => s.id === id);
    return s ? (s.socialName || s.fullName) : '—';
  };
  const typeName = (id: string) => types?.find((t) => t.id === id)?.name ?? '—';
  const visibleAssignments = (assignments ?? []).filter((a) => !studentIdFilter || a.studentId === studentIdFilter);

  async function actor() {
    if (!session) throw new Error('Sessão inválida.');
    return { userId: session.user.id, organizationId: session.user.organizationId };
  }

  async function saveType(values: ScholarshipTypeFormValues) {
    const act = await actor();
    if (editingType) {
      await repositories.scholarshipTypes.update(editingType.id, values, act);
      await repositories.audit.record({ ...act, role: session!.role }, { action: 'edit', module: 'scholarships', entityId: editingType.id });
    } else {
      const created = await repositories.scholarshipTypes.create(values, act);
      await repositories.audit.record({ ...act, role: session!.role }, { action: 'create', module: 'scholarships', entityId: created.id });
    }
    setEditingType(null);
  }

  async function assignScholarship(input: AssignScholarshipInput) {
    const act = await actor();

    if (input.replacesAssignmentId) {
      await repositories.studentScholarships.update(input.replacesAssignmentId, {
        scholarshipStatus: 'cancelled', cancelledAt: nowIso(), cancelledBy: act.userId,
        cancelReason: 'Substituída por nova concessão de bolsa.',
      }, act);
      await repositories.audit.record({ ...act, role: session!.role }, {
        action: 'edit', module: 'scholarships', entityId: input.replacesAssignmentId, reason: 'Substituída por nova concessão',
      });
    }

    const created = await repositories.studentScholarships.create({
      studentId: input.studentId, scholarshipTypeId: input.scholarshipTypeId, percentage: input.percentage,
      startDate: input.startDate, endDate: input.endDate, scholarshipStatus: 'active', reason: input.reason,
      notes: input.notes, approvedBy: act.userId, applyImmediately: input.applyImmediately,
      applyToExistingPendingInstallments: input.applyToExistingPendingInstallments, replacesAssignmentId: input.replacesAssignmentId,
    }, act);
    await repositories.audit.record({ ...act, role: session!.role }, { action: 'approve', module: 'scholarships', entityId: created.id });

    if (input.applyToExistingPendingInstallments) {
      const studentInstallments = (allInstallments ?? []).filter(
        (i) => i.studentId === input.studentId && i.installmentStatus !== 'paid' && i.installmentStatus !== 'cancelled'
          && i.competence >= input.startDate.slice(0, 7) && (!input.endDate || i.competence <= input.endDate.slice(0, 7)),
      );
      for (const installment of studentInstallments) {
        const discount = calculateScholarshipDiscountCents(installment.originalAmountCents, input.percentage);
        const finalAmount = calculateFinalAmountCents({
          originalAmountCents: installment.originalAmountCents, scholarshipDiscountCents: discount,
          otherDiscountCents: installment.otherDiscountCents, additionalAmountCents: installment.additionalAmountCents,
        });
        await repositories.installments.update(installment.id, {
          scholarshipDiscountCents: discount, finalAmountCents: finalAmount,
          appliedScholarshipAssignmentId: created.id, appliedScholarshipPercentage: input.percentage,
        }, act);
        await repositories.audit.record({ ...act, role: session!.role }, {
          action: 'edit', module: 'financial', entityId: installment.id, reason: 'Aplicação de bolsa concedida',
          previousValue: { finalAmountCents: installment.finalAmountCents }, newValue: { finalAmountCents: finalAmount },
        });
      }
    }
  }

  async function saveEdit(input: { percentage: number; endDate?: string; recalculate: boolean; affectedIds: string[] }) {
    if (!editingAssignment) return;
    const act = await actor();
    await repositories.studentScholarships.update(editingAssignment.id, { percentage: input.percentage, endDate: input.endDate }, act);
    await repositories.audit.record({ ...act, role: session!.role }, {
      action: 'edit', module: 'scholarships', entityId: editingAssignment.id,
      previousValue: { percentage: editingAssignment.percentage, endDate: editingAssignment.endDate },
      newValue: { percentage: input.percentage, endDate: input.endDate },
    });

    if (input.recalculate) {
      for (const installmentId of input.affectedIds) {
        const installment = (allInstallments ?? []).find((i) => i.id === installmentId);
        if (!installment) continue;
        const discount = calculateScholarshipDiscountCents(installment.originalAmountCents, input.percentage);
        const finalAmount = calculateFinalAmountCents({
          originalAmountCents: installment.originalAmountCents, scholarshipDiscountCents: discount,
          otherDiscountCents: installment.otherDiscountCents, additionalAmountCents: installment.additionalAmountCents,
        });
        await repositories.installments.update(installmentId, {
          scholarshipDiscountCents: discount, finalAmountCents: finalAmount, appliedScholarshipPercentage: input.percentage,
        }, act);
        await repositories.audit.record({ ...act, role: session!.role }, {
          action: 'edit', module: 'financial', entityId: installmentId, reason: 'Recálculo por alteração de bolsa',
          previousValue: { finalAmountCents: installment.finalAmountCents }, newValue: { finalAmountCents: finalAmount },
        });
      }
    }
    setEditingAssignment(null);
  }

  async function cancelAssignment(reason: string) {
    if (!editingAssignment) return;
    const act = await actor();
    await repositories.studentScholarships.update(editingAssignment.id, {
      scholarshipStatus: 'cancelled', cancelledAt: nowIso(), cancelledBy: act.userId, cancelReason: reason,
    }, act);
    await repositories.audit.record({ ...act, role: session!.role }, {
      action: 'edit', module: 'scholarships', entityId: editingAssignment.id, reason,
    });
    setEditingAssignment(null);
  }

  function exportAssignmentsCsv() {
    downloadCsv(
      'bolsas',
      ['Aluno', 'Tipo', 'Percentual', 'Início', 'Término', 'Status', 'Motivo'],
      visibleAssignments.map((a) => [
        studentName(a.studentId), typeName(a.scholarshipTypeId), `${a.percentage}%`,
        formatDate(a.startDate), a.endDate ? formatDate(a.endDate) : 'indeterminado',
        SCHOLARSHIP_ASSIGNMENT_STATUS_LABELS[computeScholarshipStatus(a, today)], a.reason ?? '',
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Bolsas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tipos de bolsa e concessões aos alunos.</p>
        </div>
        {canExport && <Button variant="outline" onClick={exportAssignmentsCsv}><Download className="h-4 w-4" /> Exportar CSV</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tipos de bolsa</CardTitle>
          {canManage && <Button size="sm" onClick={() => { setEditingType(null); setTypeDialogOpen(true); }}><Plus className="h-4 w-4" /> Novo tipo</Button>}
        </CardHeader>
        <CardContent>
          {types === undefined && <SkeletonList />}
          {types && types.length === 0 && <EmptyState icon={Award} title="Nenhum tipo de bolsa cadastrado" />}
          {types && types.length > 0 && (
            <div className="space-y-2">
              {types.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{t.name} — {t.defaultPercentage}%</p>
                    <p className="text-xs text-slate-500">{t.description || 'Sem descrição'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={t.active ? 'success' : 'default'}>{t.active ? 'Ativo' : 'Inativo'}</Badge>
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => { setEditingType(t); setTypeDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Concessões{studentIdFilter ? ` — ${studentName(studentIdFilter)}` : ''}</CardTitle>
          {canManage && <Button size="sm" onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4" /> Conceder bolsa</Button>}
        </CardHeader>
        <CardContent>
          {assignments === undefined && <SkeletonList />}
          {assignments && visibleAssignments.length === 0 && <EmptyState icon={Award} title="Nenhuma bolsa concedida ainda" />}
          {assignments && visibleAssignments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-2 py-2">Aluno</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">%</th>
                    <th className="px-2 py-2">Vigência</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAssignments.map((a) => {
                    const status = computeScholarshipStatus(a, today);
                    return (
                      <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">{studentName(a.studentId)}</td>
                        <td className="px-2 py-2">{typeName(a.scholarshipTypeId)}</td>
                        <td className="px-2 py-2">{a.percentage}%</td>
                        <td className="px-2 py-2">{formatDate(a.startDate)} – {a.endDate ? formatDate(a.endDate) : 'indeterminado'}</td>
                        <td className="px-2 py-2"><Badge tone={STATUS_TONE[status]}>{SCHOLARSHIP_ASSIGNMENT_STATUS_LABELS[status]}</Badge></td>
                        <td className="px-2 py-2">
                          {canManage && status !== 'cancelled' && status !== 'expired' && (
                            <Button size="sm" variant="ghost" onClick={() => setEditingAssignment(a)}>
                              <Pencil className="h-3.5 w-3.5" /> Alterar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ScholarshipTypeDialog open={typeDialogOpen} onClose={() => setTypeDialogOpen(false)} editing={editingType} onSave={saveType} />
      <AssignScholarshipDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        scholarshipTypes={types ?? []}
        existingAssignments={assignments ?? []}
        onAssign={assignScholarship}
      />
      <EditScholarshipDialog
        open={!!editingAssignment}
        onClose={() => setEditingAssignment(null)}
        assignment={editingAssignment}
        studentInstallments={(allInstallments ?? []).filter((i) => i.studentId === editingAssignment?.studentId)}
        onSave={saveEdit}
        onCancelScholarship={cancelAssignment}
      />
    </div>
  );
}
