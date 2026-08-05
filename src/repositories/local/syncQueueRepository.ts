import { db } from '../../db/schema';
import type { SyncQueueItem } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalSyncQueueRepository extends LocalBaseRepository<SyncQueueItem> {
  constructor() {
    super(db.syncQueue);
  }

  async pending(): Promise<SyncQueueItem[]> {
    const items = await this.list();
    return items.filter((i) => i.syncStatus === 'pending' || i.syncStatus === 'conflict');
  }
}
