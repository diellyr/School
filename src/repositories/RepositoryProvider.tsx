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
import { LocalCheckInOutRepository } from './local/checkInOutRepository';
import {
  LocalActivityHistoryRepository,
  LocalFamilyPreferencesRepository,
  LocalRecommendationHistoryRepository,
  LocalWeeklyPlanRepository,
} from './local/pedagogicalHistoryRepository';
import { JsonPedagogicalRepository } from './pedagogical/JsonPedagogicalRepository';
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
import { LocalSyncQueueRepository } from './local/syncQueueRepository';
import { LocalDataRetentionRuleRepository } from './local/retentionRepository';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { SupabaseClassRepository, SupabaseOrganizationRepository, SupabaseSchoolRepository } from './supabase/schoolRepository';
import {
  SupabaseGuardianRepository,
  SupabaseStudentGuardianRepository,
  SupabaseStudentRepository,
} from './supabase/studentRepository';

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
  checkInOuts: LocalCheckInOutRepository;

  pedagogical: JsonPedagogicalRepository;
  activityHistory: LocalActivityHistoryRepository;
  recommendationHistory: LocalRecommendationHistoryRepository;
  weeklyPlans: LocalWeeklyPlanRepository;
  familyPreferences: LocalFamilyPreferencesRepository;

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
  syncQueue: LocalSyncQueueRepository;
  dataRetentionRules: LocalDataRetentionRuleRepository;
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
    checkInOuts: new LocalCheckInOutRepository(),

    pedagogical: new JsonPedagogicalRepository(),
    activityHistory: new LocalActivityHistoryRepository(),
    recommendationHistory: new LocalRecommendationHistoryRepository(),
    weeklyPlans: new LocalWeeklyPlanRepository(),
    familyPreferences: new LocalFamilyPreferencesRepository(),

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
    syncQueue: new LocalSyncQueueRepository(),
    dataRetentionRules: new LocalDataRetentionRuleRepository(),
  };
}

/**
 * Decide entre Local* e Supabase* por entidade. Enquanto `VITE_SUPABASE_URL` e
 * `VITE_SUPABASE_ANON_KEY` não estiverem definidas (o padrão nesta versão), este
 * bloco nem executa — tudo continua no IndexedDB, exatamente como antes. Quando a
 * organização ativar a nuvem (Fase 6), as entidades que já têm implementação
 * Supabase* (organizations, schools, classes, students, guardians, studentGuardians)
 * passam a gravar direto no Postgres; as demais permanecem locais até ganharem sua
 * própria Supabase*Repository — nenhuma tela precisa saber disso.
 *
 * Os casts abaixo existem porque `Local*Repository` e `Supabase*Repository` derivam
 * de bases distintas (Dexie vs. Supabase-js) e por isso o TypeScript não os considera
 * estruturalmente intercambiáveis mesmo implementando os mesmos métodos públicos —
 * em tempo de execução só os métodos públicos são chamados, então é seguro.
 */
function createRepositories(): Repositories {
  const local = createLocalRepositories();
  if (!isSupabaseConfigured || !supabase) return local;

  return {
    ...local,
    organizations: new SupabaseOrganizationRepository(supabase) as unknown as Repositories['organizations'],
    schools: new SupabaseSchoolRepository(supabase) as unknown as Repositories['schools'],
    classes: new SupabaseClassRepository(supabase) as unknown as Repositories['classes'],
    students: new SupabaseStudentRepository(supabase) as unknown as Repositories['students'],
    guardians: new SupabaseGuardianRepository(supabase) as unknown as Repositories['guardians'],
    studentGuardians: new SupabaseStudentGuardianRepository(supabase) as unknown as Repositories['studentGuardians'],
  };
}

const RepositoryContext = createContext<Repositories | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repositories = useMemo(() => createRepositories(), []);
  return <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>;
}

export function useRepositories(): Repositories {
  const ctx = useContext(RepositoryContext);
  if (!ctx) {
    throw new Error('useRepositories deve ser usado dentro de <RepositoryProvider>.');
  }
  return ctx;
}
