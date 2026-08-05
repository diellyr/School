import type { BaseEntity } from './common';
import type { PublicationStatus } from './assessment';

export interface TeacherObservation extends BaseEntity {
  studentId: string;
  teacherId: string;
  classId: string;
  date: string;
  categoryId?: string;
  text: string;
  visibleToGuardians: boolean;
  publicationStatus: PublicationStatus;
}

export interface ParentObservation extends BaseEntity {
  studentId: string;
  guardianId: string;
  date: string;
  text: string;
}
