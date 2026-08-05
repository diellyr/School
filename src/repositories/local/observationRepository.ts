import { db } from '../../db/schema';
import type { ParentObservation, TeacherObservation } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalTeacherObservationRepository extends LocalBaseRepository<TeacherObservation> {
  constructor() {
    super(db.teacherObservations);
  }

  async findByStudent(studentId: string): Promise<TeacherObservation[]> {
    const items = await this.list({ where: (o) => o.studentId === studentId });
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }
}

export class LocalParentObservationRepository extends LocalBaseRepository<ParentObservation> {
  constructor() {
    super(db.parentObservations);
  }

  async findByStudent(studentId: string): Promise<ParentObservation[]> {
    const items = await this.list({ where: (o) => o.studentId === studentId });
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }
}
