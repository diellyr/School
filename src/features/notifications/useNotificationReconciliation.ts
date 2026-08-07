import { useEffect, useRef } from 'react';
import { db } from '../../db/schema';
import { useAuthStore } from '../../auth/authStore';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { nowIso } from '../../domain/common';
import {
  buildInstallmentNotificationDraft,
  buildScholarshipNotificationDraft,
  buildStaleScholarshipNotificationDraft,
  findInstallmentsWithStaleScholarshipDiscount,
} from '../financial/services/notificationRulesService';

/**
 * "Job" de geração de alertas financeiros e de bolsa (seções 4.6/4.7). Como este é um
 * app local sem servidor/cron, a reconciliação roda uma vez por carregamento do app
 * (chamada pelo AppShell) — numa implantação real, o mesmo cálculo rodaria num job
 * agendado no backend. Cada alerta só é criado se ainda não existir um com a mesma
 * `deduplicationKey` (nunca duplica o mesmo evento).
 */
export function useNotificationReconciliation() {
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const ran = useRef(false);

  useEffect(() => {
    if (!session || ran.current) return;
    ran.current = true;

    (async () => {
      const actor = { userId: session.user.id, organizationId: session.user.organizationId };
      const today = nowIso();

      const [installments, scholarshipAssignments, scholarshipTypes, students] = await Promise.all([
        db.installments.filter((i) => i.status === 'active' && i.organizationId === actor.organizationId).toArray(),
        db.studentScholarships.filter((a) => a.status === 'active' && a.organizationId === actor.organizationId).toArray(),
        db.scholarshipTypes.filter((t) => t.status === 'active').toArray(),
        db.students.filter((s) => s.status === 'active').toArray(),
      ]);

      const studentName = (id: string) => {
        const s = students.find((s) => s.id === id);
        return s ? s.socialName || s.fullName : 'aluno';
      };
      const typeName = (id: string) => scholarshipTypes.find((t) => t.id === id)?.name ?? 'Bolsa';

      const drafts = [
        ...installments
          .map((i) => buildInstallmentNotificationDraft(i, studentName(i.studentId), today, actor.organizationId))
          .filter((d): d is NonNullable<typeof d> => !!d),
        ...scholarshipAssignments
          .map((a) => buildScholarshipNotificationDraft(a, studentName(a.studentId), typeName(a.scholarshipTypeId), today, actor.organizationId))
          .filter((d): d is NonNullable<typeof d> => !!d),
        ...scholarshipAssignments.flatMap((a) =>
          findInstallmentsWithStaleScholarshipDiscount(a, installments).map((installment) =>
            buildStaleScholarshipNotificationDraft(a, installment, studentName(installment.studentId), today, actor.organizationId),
          ),
        ),
      ];

      for (const draft of drafts) {
        const existing = await repositories.notifications.findByDeduplicationKey(draft.deduplicationKey);
        if (!existing) {
          await repositories.notifications.create(draft, actor);
        }
      }
    })().catch(() => {
      // Reconciliação de alertas é best-effort — uma falha aqui não deve travar o app.
    });
  }, [session, repositories]);
}
