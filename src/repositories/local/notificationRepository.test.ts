import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/schema';
import { LocalNotificationRepository } from './notificationRepository';
import type { NotificationDraft } from '../../features/financial/services/notificationRulesService';

const actor = { userId: 'user-1', organizationId: 'org-1' };

function draft(overrides: Partial<NotificationDraft> = {}): NotificationDraft {
  return {
    title: 'Parcela vence hoje',
    description: 'Descrição',
    category: 'financial',
    priority: 'alto',
    studentId: 'student-1',
    relatedEntityType: 'installment',
    relatedEntityId: 'installment-1',
    scheduledFor: '2026-08-15',
    notificationStatus: 'pending',
    source: 'financial_installment_due',
    deduplicationKey: 'financial:installment:installment-1:vence_hoje',
    ...overrides,
  };
}

describe('LocalNotificationRepository — Central de Alertas (cenário 19-20)', () => {
  beforeEach(async () => {
    await db.notifications.clear();
  });

  it('findByDeduplicationKey encontra um registro já criado com a mesma chave (evita duplicidade)', async () => {
    const repo = new LocalNotificationRepository();
    await repo.create(draft(), actor);
    const found = await repo.findByDeduplicationKey('financial:installment:installment-1:vence_hoje');
    expect(found).toBeDefined();
    const notFound = await repo.findByDeduplicationKey('outra-chave');
    expect(notFound).toBeUndefined();
  });

  it('cenário 19: resolveByRelatedEntity encerra todos os alertas pendentes de uma parcela ao ser paga', async () => {
    const repo = new LocalNotificationRepository();
    const a = await repo.create(draft({ deduplicationKey: 'k1' }), actor);
    const b = await repo.create(draft({ deduplicationKey: 'k2', title: 'Outro evento' }), actor);

    await repo.resolveByRelatedEntity('installment', 'installment-1', actor);

    const refreshedA = await repo.getById(a.id);
    const refreshedB = await repo.getById(b.id);
    expect(refreshedA?.notificationStatus).toBe('resolved');
    expect(refreshedA?.resolvedBy).toBe(actor.userId);
    expect(refreshedA?.resolvedAt).toBeTruthy();
    expect(refreshedB?.notificationStatus).toBe('resolved');
  });

  it('resolveByRelatedEntity nunca mexe em notificações de outro registro', async () => {
    const repo = new LocalNotificationRepository();
    const other = await repo.create(draft({ deduplicationKey: 'k3', relatedEntityId: 'installment-OUTRA' }), actor);
    await repo.resolveByRelatedEntity('installment', 'installment-1', actor);
    const refreshed = await repo.getById(other.id);
    expect(refreshed?.notificationStatus).toBe('pending');
  });

  it('markRead marca a data de leitura sem alterar o status de resolução', async () => {
    const repo = new LocalNotificationRepository();
    const created = await repo.create(draft(), actor);
    await repo.markRead(created.id, actor);
    const refreshed = await repo.getById(created.id);
    expect(refreshed?.readAt).toBeTruthy();
    expect(refreshed?.notificationStatus).toBe('pending');
  });
});
