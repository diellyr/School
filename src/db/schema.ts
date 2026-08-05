import Dexie, { type EntityTable } from 'dexie';
import type {
  Organization,
  School,
  SchoolUnit,
  AcademicYear,
  Class,
  Enrollment,
  Student,
  Guardian,
  StudentGuardian,
  AppUser,
  TeacherAssignment,
  UserPermission,
  AssessmentScale,
  AssessmentCategory,
  Activity,
  Assessment,
  Grade,
  Attendance,
  TeacherObservation,
  ParentObservation,
  Alert,
  AlertRule,
  AlertAcknowledgement,
  TeacherAlert,
  SchoolEvent,
  EventParticipant,
  EventConfirmation,
  PortfolioItem,
  StoredDocument,
  ImportBatch,
  ImportRow,
  StorageLog,
  SyncQueueItem,
  AuditLog,
  Consent,
  Recommendation,
  Notification,
  DataRetentionRule,
} from '../domain';

/**
 * Banco IndexedDB local (Dexie). Espelha o modelo relacional que futuramente
 * viverá no Postgres/Supabase — mesma forma de entidade, mesmos relacionamentos por id.
 * Ao adicionar uma tabela nova, incremente a versão e mantenha o `stores()` anterior
 * disponível para upgrade incremental (Dexie versiona automaticamente).
 */
export class SchoolTrackerDB extends Dexie {
  organizations!: EntityTable<Organization, 'id'>;
  schools!: EntityTable<School, 'id'>;
  schoolUnits!: EntityTable<SchoolUnit, 'id'>;
  academicYears!: EntityTable<AcademicYear, 'id'>;
  classes!: EntityTable<Class, 'id'>;
  enrollments!: EntityTable<Enrollment, 'id'>;
  students!: EntityTable<Student, 'id'>;
  guardians!: EntityTable<Guardian, 'id'>;
  studentGuardians!: EntityTable<StudentGuardian, 'id'>;
  users!: EntityTable<AppUser, 'id'>;
  teacherAssignments!: EntityTable<TeacherAssignment, 'id'>;
  userPermissions!: EntityTable<UserPermission, 'id'>;

  assessmentScales!: EntityTable<AssessmentScale, 'id'>;
  assessmentCategories!: EntityTable<AssessmentCategory, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  assessments!: EntityTable<Assessment, 'id'>;
  grades!: EntityTable<Grade, 'id'>;
  attendance!: EntityTable<Attendance, 'id'>;

  teacherObservations!: EntityTable<TeacherObservation, 'id'>;
  parentObservations!: EntityTable<ParentObservation, 'id'>;

  alerts!: EntityTable<Alert, 'id'>;
  alertRules!: EntityTable<AlertRule, 'id'>;
  alertAcknowledgements!: EntityTable<AlertAcknowledgement, 'id'>;
  teacherAlerts!: EntityTable<TeacherAlert, 'id'>;

  schoolEvents!: EntityTable<SchoolEvent, 'id'>;
  eventParticipants!: EntityTable<EventParticipant, 'id'>;
  eventConfirmations!: EntityTable<EventConfirmation, 'id'>;

  portfolioItems!: EntityTable<PortfolioItem, 'id'>;
  documents!: EntityTable<StoredDocument, 'id'>;

  imports!: EntityTable<ImportBatch, 'id'>;
  importRows!: EntityTable<ImportRow, 'id'>;
  storageLogs!: EntityTable<StorageLog, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  auditLogs!: EntityTable<AuditLog, 'id'>;
  consents!: EntityTable<Consent, 'id'>;
  recommendations!: EntityTable<Recommendation, 'id'>;
  notifications!: EntityTable<Notification, 'id'>;
  dataRetentionRules!: EntityTable<DataRetentionRule, 'id'>;

  constructor() {
    super('school-tracker-db');

    this.version(1).stores({
      organizations: 'id, name, status',
      schools: 'id, organizationId, name, status',
      schoolUnits: 'id, organizationId, schoolId, status',
      academicYears: 'id, organizationId, schoolId, year, status',
      classes: 'id, organizationId, schoolId, academicYearId, stage, status',
      enrollments: 'id, organizationId, studentId, classId, schoolId, academicYearId, status',
      students: 'id, organizationId, schoolId, classId, fullName, status',
      guardians: 'id, organizationId, fullName, email, status',
      studentGuardians: 'id, organizationId, studentId, guardianId, status',
      users: 'id, organizationId, email, role, status',
      teacherAssignments: 'id, organizationId, teacherUserId, classId, status',
      userPermissions: 'id, organizationId, userId, module, status',

      assessmentScales: 'id, organizationId, schoolId, stage, status',
      assessmentCategories: 'id, organizationId, schoolId, stage, status',
      activities: 'id, organizationId, schoolId, classId, stage, period, status',
      assessments: 'id, organizationId, activityId, studentId, stage, status',
      grades: 'id, organizationId, studentId, classId, subject, period, status',
      attendance: 'id, organizationId, studentId, classId, date, status',

      teacherObservations: 'id, organizationId, studentId, teacherId, status',
      parentObservations: 'id, organizationId, studentId, guardianId, status',

      alerts: 'id, organizationId, studentId, level, status',
      alertRules: 'id, organizationId, schoolId, status',
      alertAcknowledgements: 'id, organizationId, alertId, status',
      teacherAlerts: 'id, organizationId, studentId, teacherId, status',

      schoolEvents: 'id, organizationId, schoolId, classId, startAt, status',
      eventParticipants: 'id, organizationId, eventId, studentId, status',
      eventConfirmations: 'id, organizationId, eventId, guardianId, status',

      portfolioItems: 'id, organizationId, studentId, category, status',
      documents: 'id, organizationId, studentId, schoolId, category, status',

      imports: 'id, organizationId, documentType, status',
      importRows: 'id, organizationId, importId, status',
      storageLogs: 'id, organizationId, entityType, entityId',
      syncQueue: 'id, organizationId, entityType, syncStatus',

      auditLogs: 'id, organizationId, userId, action, createdAt',
      consents: 'id, organizationId, studentId, guardianId, status',
      recommendations: 'id, organizationId, ageRange, published, status',
      notifications: 'id, organizationId, userId, read',
      dataRetentionRules: 'id, organizationId, entityType, status',
    });
  }
}

export const db = new SchoolTrackerDB();
