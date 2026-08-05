import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { Select, Textarea } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { useCurrentRole, usePermission } from '../../auth/usePermission';
import { evaluateStudentAlert, type AlertEvaluationResult } from './alertEngine';
import { ALERT_LEVEL_LABELS, ALERT_LEVEL_MESSAGES } from '../../domain';
import type { Alert, AlertLevel, AlertRule, Student } from '../../domain';
import { formatDateTime } from '../../lib/utils';

const LEVEL_TONE: Record<AlertLevel, 'info' | 'warning' | 'danger' | 'default'> = {
  informativo: 'info',
  atencao: 'warning',
  acompanhamento: 'warning',
  orientacao_profissional: 'danger',
};

export function AlertsPage() {
  const role = useCurrentRole();
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const canAnalyze = usePermission('alerts', 'create');

  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [preview, setPreview] = useState<AlertEvaluationResult | null>(null);
  const [contestingId, setContestingId] = useState<string | null>(null);
  const [contestText, setContestText] = useState('');

  const alerts = useLiveQuery(async () => {
    const items = await db.alerts.filter((a) => a.status === 'active').toArray();
    let scoped = items;
    if (role === 'guardian' && session?.user.guardianId) {
      const links = await db.studentGuardians.filter((l) => l.guardianId === session.user.guardianId && l.status === 'active').toArray();
      const ids = new Set(links.map((l) => l.studentId));
      scoped = items.filter((a) => ids.has(a.studentId));
    } else if (role === 'student' && session?.user.studentId) {
      scoped = items.filter((a) => a.studentId === session.user.studentId);
    }
    return scoped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [role, session?.user.guardianId, session?.user.studentId]);

  const students = useLiveQuery<Student[]>(() => db.students.filter((s) => s.status === 'active').toArray(), []);
  const studentName = (id: string) => students?.find((s) => s.id === id)?.fullName ?? '—';

  async function runAnalysis(studentId: string) {
    const assessments = await db.assessments.filter((a) => a.studentId === studentId && a.status === 'active' && !!a.rboLevel).toArray();
    const activityIds = [...new Set(assessments.map((a) => a.activityId))];
    const activities = await db.activities.bulkGet(activityIds);
    const periodByActivityId = new Map(activities.filter((a): a is NonNullable<typeof a> => !!a).map((a) => [a.id, a.period]));

    let rule: AlertRule | undefined = (await db.alertRules.filter((r) => r.status === 'active' && r.active).toArray())[0];
    if (!rule) {
      rule = {
        id: 'default', organizationId: session?.user.organizationId ?? '', createdAt: '', updatedAt: '', createdBy: '', updatedBy: '', version: 1, status: 'active',
        name: 'Padrão do sistema', stage: 'both', minActivitiesRequired: 4, minPeriodsForPattern: 2, rLevelPercentThreshold: 50, active: true,
      };
    }
    const result = evaluateStudentAlert({ studentId, assessments, periodByActivityId, rule });
    setPreview(result);
  }

  async function saveAlert() {
    if (!session || !preview || !selectedStudentId) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const created = await repositories.alerts.create(
      {
        studentId: selectedStudentId,
        level: preview.level,
        reason: preview.reason,
        periodStart: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        periodEnd: new Date().toISOString().slice(0, 10),
        recordsUsed: preview.recordsUsed,
        confidence: preview.confidence,
        recommendations: preview.recommendations,
        analyzedBy: session.user.id,
        alertStatus: 'active',
      },
      actor,
    );
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'alerts', entityId: created.id });
    setAnalyzeOpen(false);
    setPreview(null);
    setSelectedStudentId('');
  }

  async function contest(alert: Alert) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    await repositories.alerts.update(alert.id, { alertStatus: 'contested', contestNote: contestText }, actor);
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'alerts', entityId: alert.id, reason: 'Contestação' });
    setContestingId(null);
    setContestText('');
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Alertas educacionais</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sinais para acompanhamento — nunca um diagnóstico. Sempre baseados em múltiplos registros e períodos.
          </p>
        </div>
        {canAnalyze && (
          <Button onClick={() => setAnalyzeOpen(true)}><Sparkles className="h-4 w-4" /> Analisar aluno</Button>
        )}
      </div>

      {alerts === undefined && <SkeletonList />}
      {alerts?.length === 0 && <EmptyState icon={AlertTriangle} title="Nenhum alerta registrado" />}

      <div className="space-y-3">
        {alerts?.map((alert) => (
          <Card key={alert.id}>
            <CardContent>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={LEVEL_TONE[alert.level]}>{ALERT_LEVEL_LABELS[alert.level]}</Badge>
                <span className="font-medium text-slate-800 dark:text-slate-100">{studentName(alert.studentId)}</span>
                <Badge tone={alert.alertStatus === 'active' ? 'default' : alert.alertStatus === 'contested' ? 'warning' : 'success'}>
                  {alert.alertStatus}
                </Badge>
                <span className="text-xs text-slate-400">{formatDateTime(alert.createdAt)}</span>
              </div>
              <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{alert.reason}</p>
              <div className="mb-2 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
                <span>Período: {alert.periodStart} a {alert.periodEnd}</span>
                <span>Registros usados: {alert.recordsUsed}</span>
                <span>Confiança: {alert.confidence}</span>
                <span>Regra aplicada: motor educacional (Fase 4)</span>
              </div>
              {alert.recommendations.length > 0 && (
                <ul className="mb-2 list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
                  {alert.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
              {alert.contestNote && (
                <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  Contestação: {alert.contestNote}
                </p>
              )}
              {(role === 'guardian' || role === 'teacher') && alert.alertStatus === 'active' && (
                contestingId === alert.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea value={contestText} onChange={(e) => setContestText(e.target.value)} placeholder="Adicione contexto ou conteste este alerta…" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => contest(alert)}>Enviar</Button>
                      <Button size="sm" variant="outline" onClick={() => setContestingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setContestingId(alert.id)}>Contestar / adicionar contexto</Button>
                )
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={analyzeOpen} onClose={() => { setAnalyzeOpen(false); setPreview(null); }} title="Analisar aluno" size="lg">
        <div className="space-y-4">
          <Select
            value={selectedStudentId}
            onChange={(e) => { setSelectedStudentId(e.target.value); setPreview(null); if (e.target.value) runAnalysis(e.target.value); }}
          >
            <option value="">Selecione um aluno…</option>
            {students?.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </Select>

          {preview && (
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <Badge tone={LEVEL_TONE[preview.level]} className="mb-2">{ALERT_LEVEL_LABELS[preview.level]}</Badge>
              <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{preview.reason}</p>
              <p className="mb-2 text-xs text-slate-400">
                Baseado em {preview.recordsUsed} registro(s) em {preview.periodsAffected || '—'} período(s) com padrão. Confiança: {preview.confidence}.
              </p>
              {preview.level !== 'informativo' && (
                <p className="text-xs text-slate-400 italic">{ALERT_LEVEL_MESSAGES[preview.level]}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAnalyzeOpen(false); setPreview(null); }}>Cancelar</Button>
            <Button onClick={saveAlert} disabled={!preview}>Registrar alerta</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
