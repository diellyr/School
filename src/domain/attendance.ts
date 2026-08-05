import type { BaseEntity } from './common';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'justified_absence'
  | 'late'
  | 'early_departure'
  | 'class_cancelled'
  | 'remote_activity';

export interface Attendance extends BaseEntity {
  studentId: string;
  classId: string;
  date: string;
  attendanceStatus: AttendanceStatus;
  justification?: string;
  registeredBy: string;
}
