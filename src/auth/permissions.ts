import type { PermissionAction, SystemModule, SystemRole, UserPermission } from '../domain';

/**
 * Matriz de permissões padrão por perfil (RBAC base). O Owner pode sobrepor este
 * padrão por usuário/escola/turma/aluno/módulo através de registros `UserPermission`
 * (ver domain/rbac.ts e módulo "Permissões do Owner") — a função `can()` abaixo
 * primeiro procura uma sobreposição aplicável e só usa o padrão se não encontrar.
 *
 * Estes limites nascem diretamente da seção 5 do briefing:
 * aluno = somente leitura dos próprios dados; responsável = leitura/edição limitada
 * dos vínculos; professor = sem exclusão definitiva; admin = exclusão só quando
 * concedida; owner = tudo, mas dado sensível de criança só com finalidade registrada.
 */
const FULL: PermissionAction[] = ['view', 'create', 'edit', 'import', 'export', 'approve', 'delete', 'administer'];
const NONE: PermissionAction[] = [];

function moduleMap(actions: PermissionAction[]): Record<SystemModule, PermissionAction[]> {
  const modules: SystemModule[] = [
    'students', 'guardians', 'teachers', 'schools', 'classes', 'imports', 'manual_entry',
    'activities', 'assessments', 'grades', 'attendance', 'check_in_out', 'family_development', 'alerts', 'observations', 'events',
    'portfolio', 'documents', 'reports', 'users', 'permissions', 'audit', 'sync', 'backup',
    'recommendations', 'settings',
  ];
  return Object.fromEntries(modules.map((m) => [m, actions])) as Record<SystemModule, PermissionAction[]>;
}

const OWNER_MATRIX = moduleMap(FULL);

const ADMIN_MATRIX: Record<SystemModule, PermissionAction[]> = {
  ...moduleMap(['view', 'create', 'edit', 'import', 'export', 'approve']),
  students: ['view', 'create', 'edit', 'import', 'export'],
  guardians: ['view', 'create', 'edit', 'import', 'export'],
  teachers: ['view', 'create', 'edit'],
  schools: ['view', 'create', 'edit'],
  classes: ['view', 'create', 'edit'],
  users: ['view', 'create', 'edit'],
  permissions: ['view'],
  audit: ['view'],
  sync: ['view', 'administer'],
  backup: ['view', 'export'],
  settings: ['view', 'edit'],
};
// Exclusão definitiva (`delete`) fica de fora do padrão do admin: só entra por
// concessão explícita do Owner via UserPermission (ver seção 5 do briefing).

const TEACHER_MATRIX: Record<SystemModule, PermissionAction[]> = {
  ...moduleMap(['view']),
  students: ['view'],
  guardians: ['view'],
  classes: ['view'],
  attendance: ['view', 'create', 'edit'],
  check_in_out: ['view', 'create', 'edit'],
  family_development: ['view', 'create', 'edit'],
  activities: ['view', 'create', 'edit'],
  assessments: ['view', 'create', 'edit', 'approve'],
  grades: ['view', 'create', 'edit', 'approve'],
  observations: ['view', 'create', 'edit'],
  alerts: ['view', 'create', 'edit'],
  events: ['view', 'create', 'edit'],
  portfolio: ['view', 'create', 'edit'],
  documents: ['view', 'create', 'import'],
  manual_entry: ['view', 'create', 'edit'],
  imports: ['view', 'create', 'import'],
  reports: ['view', 'export'],
  recommendations: ['view'],
  teachers: NONE,
  schools: NONE,
  users: NONE,
  permissions: NONE,
  audit: NONE,
  sync: NONE,
  backup: NONE,
  settings: NONE,
};

const GUARDIAN_MATRIX: Record<SystemModule, PermissionAction[]> = {
  ...moduleMap(['view']),
  students: ['view'],
  attendance: ['view'],
  check_in_out: ['view'],
  family_development: ['view', 'create', 'edit'],
  activities: ['view'],
  assessments: ['view'],
  grades: ['view'],
  observations: ['view', 'create'],
  alerts: ['view'],
  events: ['view'],
  portfolio: ['view', 'create'],
  documents: ['view', 'create', 'import'],
  manual_entry: ['view', 'create'],
  imports: ['view', 'create', 'import'],
  reports: ['view', 'export'],
  recommendations: ['view'],
  guardians: NONE,
  teachers: NONE,
  schools: NONE,
  classes: NONE,
  users: NONE,
  permissions: NONE,
  audit: NONE,
  sync: NONE,
  backup: NONE,
  settings: NONE,
};

const STUDENT_MATRIX: Record<SystemModule, PermissionAction[]> = {
  ...moduleMap(NONE),
  students: ['view'],
  attendance: ['view'],
  check_in_out: ['view'],
  family_development: ['view'],
  activities: ['view'],
  assessments: ['view'],
  grades: ['view'],
  events: ['view'],
  portfolio: ['view'],
  documents: ['view'],
  recommendations: ['view'],
};

const ROLE_MATRICES: Record<SystemRole, Record<SystemModule, PermissionAction[]>> = {
  owner: OWNER_MATRIX,
  admin: ADMIN_MATRIX,
  teacher: TEACHER_MATRIX,
  guardian: GUARDIAN_MATRIX,
  student: STUDENT_MATRIX,
};

export function roleDefaultActions(role: SystemRole, module: SystemModule): PermissionAction[] {
  return ROLE_MATRICES[role]?.[module] ?? NONE;
}

export interface PermissionCheckArgs {
  role: SystemRole;
  module: SystemModule;
  action: PermissionAction;
  overrides?: UserPermission[];
  schoolId?: string;
  classId?: string;
  studentId?: string;
}

function overrideMatches(o: UserPermission, args: PermissionCheckArgs): boolean {
  if (o.module !== args.module) return false;
  if (o.studentId && o.studentId !== args.studentId) return false;
  if (o.classId && o.classId !== args.studentId && o.classId !== args.classId) return false;
  if (o.schoolId && o.schoolId !== args.schoolId) return false;
  const now = new Date().toISOString();
  if (o.validFrom && o.validFrom > now) return false;
  if (o.validUntil && o.validUntil < now) return false;
  return true;
}

/** Decide se uma ação é permitida: sobreposição específica (mais granular) vence o padrão do perfil. */
export function can(args: PermissionCheckArgs): boolean {
  const applicable = (args.overrides ?? [])
    .filter((o) => o.status === 'active')
    .filter((o) => overrideMatches(o, args))
    .sort((a, b) => specificity(b) - specificity(a));

  if (applicable.length > 0) {
    return applicable[0].actions.includes(args.action);
  }
  return roleDefaultActions(args.role, args.module).includes(args.action);
}

function specificity(o: UserPermission): number {
  return (o.studentId ? 4 : 0) + (o.classId ? 2 : 0) + (o.schoolId ? 1 : 0);
}
