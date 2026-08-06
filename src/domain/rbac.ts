import type { BaseEntity } from './common';
import type { SystemRole } from './people';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'import'
  | 'export'
  | 'approve'
  | 'delete'
  | 'administer';

/** Módulos do sistema, usados para conceder/restringir acesso granular. */
export type SystemModule =
  | 'students'
  | 'guardians'
  | 'teachers'
  | 'schools'
  | 'classes'
  | 'imports'
  | 'manual_entry'
  | 'activities'
  | 'assessments'
  | 'grades'
  | 'attendance'
  | 'check_in_out'
  | 'alerts'
  | 'observations'
  | 'events'
  | 'portfolio'
  | 'documents'
  | 'reports'
  | 'users'
  | 'permissions'
  | 'audit'
  | 'sync'
  | 'backup'
  | 'recommendations'
  | 'settings';

export interface RoleDefinition {
  role: SystemRole;
  label: string;
  description: string;
}

/**
 * Matriz de permissões: usuário/perfil x organização/escola/turma/aluno/módulo x ação.
 * Um registro sem studentId/classId/schoolId vale para todo o escopo superior.
 * scope mais específico sempre prevalece sobre o mais genérico.
 */
export interface UserPermission extends BaseEntity {
  userId: string;
  role?: SystemRole; // permissão aplicada a um perfil inteiro (definida pelo Owner)
  schoolId?: string;
  classId?: string;
  studentId?: string;
  module: SystemModule;
  actions: PermissionAction[];
  grantedBy: string;
  validFrom: string;
  validUntil?: string;
  reason?: string;
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  { role: 'owner', label: 'Owner', description: 'Autoridade máxima da plataforma.' },
  { role: 'admin', label: 'Administrador', description: 'Gestão operacional da organização/escola.' },
  { role: 'teacher', label: 'Professor', description: 'Lança dados pedagógicos das turmas autorizadas.' },
  { role: 'guardian', label: 'Responsável', description: 'Acompanha os filhos vinculados.' },
  { role: 'student', label: 'Aluno', description: 'Consulta somente os próprios dados.' },
];
