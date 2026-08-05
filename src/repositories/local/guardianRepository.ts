import { db } from '../../db/schema';
import type { Guardian, StudentGuardian } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalGuardianRepository extends LocalBaseRepository<Guardian> {
  constructor() {
    super(db.guardians);
  }
}

export class LocalStudentGuardianRepository extends LocalBaseRepository<StudentGuardian> {
  constructor() {
    super(db.studentGuardians);
  }

  async findByStudent(studentId: string): Promise<StudentGuardian[]> {
    return this.list({ where: (l) => l.studentId === studentId });
  }

  async findByGuardian(guardianId: string): Promise<StudentGuardian[]> {
    return this.list({ where: (l) => l.guardianId === guardianId });
  }
}
