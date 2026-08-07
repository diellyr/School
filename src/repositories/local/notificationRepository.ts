import { db } from '../../db/schema';
import type { Notification } from '../../domain';
import { nowIso } from '../../domain/common';
import { LocalBaseRepository } from './LocalBaseRepository';
import type { ActorContext } from '../interfaces/Repository';

export class LocalNotificationRepository extends LocalBaseRepository<Notification> {
  constructor() {
    super(db.notifications);
  }

  async findByDeduplicationKey(deduplicationKey: string): Promise<Notification | undefined> {
    const items = await this.list({ where: (n) => n.deduplicationKey === deduplicationKey, includeArchived: true });
    return items[0];
  }

  async findAll(): Promise<Notification[]> {
    const items = await this.list();
    return items.sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
  }

  async markRead(id: string, actor: ActorContext): Promise<void> {
    await this.update(id, { readAt: nowIso() } as Partial<Notification>, actor);
  }

  async markAllRead(ids: string[], actor: ActorContext): Promise<void> {
    const now = nowIso();
    for (const id of ids) {
      await this.update(id, { readAt: now } as Partial<Notification>, actor);
    }
  }

  async resolve(id: string, actor: ActorContext): Promise<void> {
    await this.update(id, { notificationStatus: 'resolved', resolvedAt: nowIso(), resolvedBy: actor.userId } as Partial<Notification>, actor);
  }

  /** Encerra (resolve) todas as notificações pendentes ligadas a um registro — usado ao
   *  pagar/cancelar/isentar uma parcela ou ao encerrar uma bolsa (seção 4.6/4.7). */
  async resolveByRelatedEntity(relatedEntityType: string, relatedEntityId: string, actor: ActorContext): Promise<void> {
    const items = await this.list({
      where: (n) => n.relatedEntityType === relatedEntityType && n.relatedEntityId === relatedEntityId && n.notificationStatus === 'pending',
    });
    for (const item of items) {
      await this.resolve(item.id, actor);
    }
  }
}
