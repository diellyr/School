import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  LocalAcademicYearRepository,
  LocalClassRepository,
  LocalOrganizationRepository,
  LocalSchoolRepository,
  LocalSchoolUnitRepository,
} from './local/schoolRepository';
import { LocalEnrollmentRepository, LocalStudentRepository } from './local/studentRepository';
import { LocalGuardianRepository, LocalStudentGuardianRepository } from './local/guardianRepository';
import {
  LocalTeacherAssignmentRepository,
  LocalUserPermissionRepository,
  LocalUserRepository,
} from './local/userRepository';
import { LocalAuditRepository } from './local/auditRepository';
import {
  LocalActivityRepository,
  LocalAssessmentCategoryRepository,
  LocalAssessmentRepository,
  LocalAssessmentScaleRepository,
  LocalGradeRepository,
} from './local/assessmentRepository';
import { LocalAttendanceRepository } from './local/attendanceRepository';
import { LocalParentObservationRepository, LocalTeacherObservationRepository } from './local/observationRepository';
import {
  LocalAlertAcknowledgementRepository,
  LocalAlertRepository,
  LocalAlertRuleRepository,
  LocalTeacherAlertRepository,
} from './local/alertRepository';
import {
  LocalEventConfirmationRepository,
  LocalEventParticipantRepository,
  LocalSchoolEventRepository,
} from './local/eventRepository';
import { LocalDocumentRepository, LocalPortfolioRepository } from './local/portfolioRepository';
import { LocalImportBatchRepository, LocalImportRowRepository } from './local/importRepository';
import { LocalRecommendationRepository } from './local/recommendationRepository';

/**
 * Ponto único de acesso aos repositórios. Hoje instancia as implementações Local*
 * (Dexie/IndexedDB). Na Fase 6, este provider passa a decidir — por configuração da
 * organização (Owner: "ativar armazenamento em nuvem") — se injeta Local*, Supabase*,
 * ou uma composição de ambas (grava local e enfileira sincronização). As telas
 * continuam consumindo apenas `useRepositories()` e não precisam ser reescritas.
 */
export interface Repositories {
  organizations: LocalOrganizationRepository;
  schools: LocalSchoolRepository;
  schoolUnits: LocalSchoolUnitRepository;
  academicYears: LocalAcademicYearRepository;
  classes: LocalClassRepository;
  enrollments: LocalEnrollmentRepository;
  students: LocalStudentRepository;
  guardians: LocalGuardianRepository;
  studentGuardians: LocalStudentGuardianRepository;
  users: LocalUserRepository;
  teacherAssignments: LocalTeacherAssignmentRepository;
  userPermissions: LocalUserPermissionRepository;
  audit: LocalAuditRepository;

  assessmentScales: LocalAssessmentScaleRepository;
  assessmentCategories: LocalAssessmentCategoryRepository;
  activities: LocalActivityRepository;
  assessments: LocalAssessmentRepository;
  grades: LocalGradeRepository;
  attendance: LocalAttendanceRepository;

  teacherObservations: LocalTeacherObservationRepository;
  parentObservations: LocalParentObservationRepository;

  alertRules: LocalAlertRuleRepository;
  alerts: LocalAlertRepository;
  alertAcknowledgements: LocalAlertAcknowledgementRepository;
  teacherAlerts: LocalTeacherAlertRepository;

  schoolEvents: LocalSchoolEventRepository;
  eventParticipants: LocalEventParticipantRepository;
  eventConfirmations: LocalEventConfirmationRepository;

  portfolio: LocalPortfolioRepository;
  documents: LocalDocumentRepository;

  imports: LocalImportBatchRepository;
  importRows: LocalImportRowRepository;

  recommendations: LocalRecommendationRepository;
}

function createLocalRepositories(): Repositories {
  return {
    organizations: new LocalOrganizationRepository(),
    schools: new LocalSchoolRepository(),
    schoolUnits: new LocalSchoolUnitRepository(),
    academicYears: new LocalAcademicYearRepository(),
    classes: new LocalClassRepository(),
    enrollments: new LocalEnrollmentRepository(),
    students: new LocalStudentRepository(),
    guardians: new LocalGuardianRepository(),
    studentGuardians: new LocalStudentGuardianRepository(),
    users: new LocalUserRepository(),
    teacherAssignments: new LocalTeacherAssignmentRepository(),
    userPermissions: new LocalUserPermissionRepository(),
    audit: new LocalAuditRepository(),

    assessmentScales: new LocalAssessmentScaleRepository(),
    assessmentCategories: new LocalAssessmentCategoryRepository(),
    activities: new LocalActivityRepository(),
    assessments: new LocalAssessmentRepository(),
    grades: new LocalGradeRepository(),
    attendance: new LocalAttendanceRepository(),

    teacherObservations: new LocalTeacherObservationRepository(),
    parentObservations: new LocalParentObservationRepository(),

    alertRules: new LocalAlertRuleRepository(),
    alerts: new LocalAlertRepository(),
    alertAcknowledgements: new LocalAlertAcknowledgementRepository(),
    teacherAlerts: new LocalTeacherAlertRepository(),

    schoolEvents: new LocalSchoolEventRepository(),
    eventParticipants: new LocalEventParticipantRepository(),
    eventConfirmations: new LocalEventConfirmationRepository(),

    portfolio: new LocalPortfolioRepository(),
    documents: new LocalDocumentRepository(),

    imports: new LocalImportBatchRepository(),
    importRows: new LocalImportRowRepository(),

    recommendations: new LocalRecommendationRepository(),
  };
}

const RepositoryContext = createContext<Repositories | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repositories = useMemo(() => createLocalRepositories(), []);
  return <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>;
}

export function useRepositories(): Repositories {
  const ctx = useContext(RepositoryContext);
  if (!ctx) {
    throw new Error('useRepositories deve ser usado dentro de <RepositoryProvider>.');
  }
  return ctx;
}
