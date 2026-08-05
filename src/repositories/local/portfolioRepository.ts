import { db } from '../../db/schema';
import type { PortfolioItem, StoredDocument } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalPortfolioRepository extends LocalBaseRepository<PortfolioItem> {
  constructor() {
    super(db.portfolioItems);
  }

  async findByStudent(studentId: string): Promise<PortfolioItem[]> {
    const items = await this.list({ where: (p) => p.studentId === studentId });
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }
}

export class LocalDocumentRepository extends LocalBaseRepository<StoredDocument> {
  constructor() {
    super(db.documents);
  }

  async findByStudent(studentId: string): Promise<StoredDocument[]> {
    return this.list({ where: (d) => d.studentId === studentId });
  }

  async findBySchool(schoolId: string): Promise<StoredDocument[]> {
    return this.list({ where: (d) => d.schoolId === schoolId });
  }
}
