import type { Address, BaseEntity, EducationStage, Shift } from './common';

export interface Organization extends BaseEntity {
  name: string;
  legalName?: string;
  document?: string;
  cloudStorageEnabled: boolean;
  retentionPolicyDays?: number;
  logoUrl?: string;
}

export interface School extends BaseEntity {
  name: string;
  document?: string;
  address?: Address;
  phone?: string;
  email?: string;
}

export interface SchoolUnit extends BaseEntity {
  schoolId: string;
  name: string;
  address?: Address;
}

export interface AcademicYear extends BaseEntity {
  schoolId: string;
  year: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Class extends BaseEntity {
  schoolId: string;
  schoolUnitId?: string;
  academicYearId: string;
  name: string;
  stage: EducationStage;
  grade: string; // e.g. "Maternal II", "3º ano"
  shift: Shift;
  homeroomTeacherId?: string;
}

export type EnrollmentStatus = 'active' | 'transferred' | 'graduated' | 'withdrawn' | 'inactive';

export interface Enrollment extends BaseEntity {
  studentId: string;
  schoolId: string;
  schoolUnitId?: string;
  classId: string;
  academicYearId: string;
  enrollmentDate: string;
  enrollmentStatus: EnrollmentStatus;
  internalCode?: string;
  endDate?: string;
  reason?: string; // motivo de transferência/saída, para preservar histórico
}
