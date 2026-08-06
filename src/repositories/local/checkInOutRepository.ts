import { db } from '../../db/schema';
import type { CheckInOut } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalCheckInOutRepository extends LocalBaseRepository<CheckInOut> {
  constructor() {
    super(db.checkInOuts);
  }

  async findByClassAndDate(classId: string, date: string): Promise<CheckInOut[]> {
    return this.list({ where: (c) => c.classId === classId && c.date === date });
  }

  async findByStudent(studentId: string): Promise<CheckInOut[]> {
    const items = await this.list({ where: (c) => c.studentId === studentId });
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }
}
