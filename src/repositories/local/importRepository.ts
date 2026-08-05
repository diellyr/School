import { db } from '../../db/schema';
import type { ImportBatch, ImportRow } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalImportBatchRepository extends LocalBaseRepository<ImportBatch> {
  constructor() {
    super(db.imports);
  }

  async recent(): Promise<ImportBatch[]> {
    const items = await this.list();
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class LocalImportRowRepository extends LocalBaseRepository<ImportRow> {
  constructor() {
    super(db.importRows);
  }

  async findByImport(importId: string): Promise<ImportRow[]> {
    return this.list({ where: (r) => r.importId === importId });
  }
}
