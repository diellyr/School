import { db } from '../../db/schema';
import type { Enrollment, Student } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalStudentRepository extends LocalBaseRepository<Student> {
  constructor() {
    super(db.students);
  }

  async findByClass(classId: string): Promise<Student[]> {
    return this.list({ where: (s) => s.classId === classId });
  }

  async findBySchool(schoolId: string): Promise<Student[]> {
    return this.list({ where: (s) => s.schoolId === schoolId });
  }

  async search(term: string): Promise<Student[]> {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return this.list();
    return this.list({
      where: (s) =>
        s.fullName.toLowerCase().includes(normalized) ||
        (s.socialName?.toLowerCase().includes(normalized) ?? false) ||
        (s.internalCode?.toLowerCase().includes(normalized) ?? false),
    });
  }
}

export class LocalEnrollmentRepository extends LocalBaseRepository<Enrollment> {
  constructor() {
    super(db.enrollments);
  }

  async findByStudent(studentId: string): Promise<Enrollment[]> {
    const items = await this.list({ where: (e) => e.studentId === studentId });
    return items.sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate));
  }
}
