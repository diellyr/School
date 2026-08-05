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
