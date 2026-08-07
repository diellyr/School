import { db } from '../../db/schema';
import type { Installment, Payment, ScholarshipType, StudentScholarship } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalInstallmentRepository extends LocalBaseRepository<Installment> {
  constructor() {
    super(db.installments);
  }

  async findByStudent(studentId: string): Promise<Installment[]> {
    const items = await this.list({ where: (i) => i.studentId === studentId });
    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  async findByStudentAndCompetenceAndChargeType(studentId: string, competence: string, chargeType: string): Promise<Installment[]> {
    return this.list({ where: (i) => i.studentId === studentId && i.competence === competence && i.chargeType === chargeType });
  }

  async findByScholarshipAssignment(assignmentId: string): Promise<Installment[]> {
    return this.list({ where: (i) => i.appliedScholarshipAssignmentId === assignmentId });
  }
}

export class LocalPaymentRepository extends LocalBaseRepository<Payment> {
  constructor() {
    super(db.payments);
  }

  async findByInstallment(installmentId: string): Promise<Payment[]> {
    const items = await this.list({ where: (p) => p.installmentId === installmentId });
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class LocalScholarshipTypeRepository extends LocalBaseRepository<ScholarshipType> {
  constructor() {
    super(db.scholarshipTypes);
  }
}

export class LocalStudentScholarshipRepository extends LocalBaseRepository<StudentScholarship> {
  constructor() {
    super(db.studentScholarships);
  }

  async findByStudent(studentId: string): Promise<StudentScholarship[]> {
    const items = await this.list({ where: (s) => s.studentId === studentId });
    return items.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }
}
