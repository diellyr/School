import { db } from '../../db/schema';
import type { Attendance } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalAttendanceRepository extends LocalBaseRepository<Attendance> {
  constructor() {
    super(db.attendance);
  }

  async findByStudent(studentId: string): Promise<Attendance[]> {
    const items = await this.list({ where: (a) => a.studentId === studentId });
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }

  async findByClassAndDate(classId: string, date: string): Promise<Attendance[]> {
    return this.list({ where: (a) => a.classId === classId && a.date === date });
  }
}
