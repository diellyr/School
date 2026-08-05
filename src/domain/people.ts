import type { BaseEntity } from './common';

export type MatriculationStatus = 'active' | 'pending' | 'transferred' | 'graduated' | 'withdrawn';

export interface AccessibilityInfo {
  notes?: string;
  supportNeeded?: boolean;
}

export interface Student extends BaseEntity {
  fullName: string;
  socialName?: string;
  birthDate: string;
  photoUrl?: string;
  schoolId: string;
  schoolUnitId?: string;
  classId?: string;
  grade?: string;
  shift?: string;
  academicYearId?: string;
  enrollmentDate?: string;
  matriculationStatus: MatriculationStatus;
  internalCode?: string;
  accessibility?: AccessibilityInfo;
  authorizedNotes?: string;
  contacts?: { label: string; value: string }[];
}

export type GuardianRelationship =
  | 'mother'
  | 'father'
  | 'grandparent'
  | 'legal_guardian'
  | 'other';

export interface Guardian extends BaseEntity {
  fullName: string;
  document?: string;
  email?: string;
  phone?: string;
  relationship: GuardianRelationship;
  address?: string;
}

export interface StudentGuardian extends BaseEntity {
  studentId: string;
  guardianId: string;
  relationship: GuardianRelationship;
  isPrimary: boolean;
  canPickUp: boolean;
  financialResponsible: boolean;
}

export type SystemRole = 'owner' | 'admin' | 'teacher' | 'guardian' | 'student';

export interface AppUser extends BaseEntity {
  fullName: string;
  email: string;
  role: SystemRole;
  passwordHash: string;
  isDemo: boolean;
  isBlocked: boolean;
  guardianId?: string; // se role = guardian
  studentId?: string; // se role = student
  teacherTitle?: string; // se role = teacher/coordinator
  lastLoginAt?: string;
  failedLoginAttempts: number;
}

export interface TeacherAssignment extends BaseEntity {
  teacherUserId: string;
  classId: string;
  schoolId: string;
  subject?: string; // Ensino Fundamental
  isHomeroom: boolean;
  academicYearId: string;
}
