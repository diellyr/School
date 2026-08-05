import { describe, expect, it } from 'vitest';
import { can, roleDefaultActions } from './permissions';
import type { UserPermission } from '../domain';

function override(partial: Partial<UserPermission>): UserPermission {
  const now = new Date().toISOString();
  return {
    id: 'ov-1',
    organizationId: 'org-1',
    createdAt: now,
    updatedAt: now,
    createdBy: 'owner-1',
    updatedBy: 'owner-1',
    version: 1,
    status: 'active',
    userId: 'user-1',
    module: 'students',
    actions: ['view'],
    grantedBy: 'owner-1',
    validFrom: '2020-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('RBAC — regras críticas de perfis (seção 5 do briefing)', () => {
  it('aluno só tem leitura: nunca pode criar, editar, importar ou apagar', () => {
    for (const module of ['students', 'grades', 'attendance', 'documents', 'portfolio'] as const) {
      expect(roleDefaultActions('student', module)).toEqual(['view']);
    }
    expect(can({ role: 'student', module: 'students', action: 'edit' })).toBe(false);
    expect(can({ role: 'student', module: 'documents', action: 'import' })).toBe(false);
    expect(can({ role: 'student', module: 'students', action: 'delete' })).toBe(false);
  });

  it('aluno não acessa módulos internos (observações de professor, auditoria, permissões)', () => {
    expect(can({ role: 'student', module: 'observations', action: 'view' })).toBe(false);
    expect(can({ role: 'student', module: 'audit', action: 'view' })).toBe(false);
    expect(can({ role: 'student', module: 'permissions', action: 'view' })).toBe(false);
  });

  it('responsável nunca pode apagar definitivamente nem administrar usuários', () => {
    expect(can({ role: 'guardian', module: 'students', action: 'delete' })).toBe(false);
    expect(can({ role: 'guardian', module: 'documents', action: 'delete' })).toBe(false);
    expect(can({ role: 'guardian', module: 'users', action: 'administer' })).toBe(false);
  });

  it('professor pode criar atividades e observações, mas nunca apaga definitivamente', () => {
    expect(can({ role: 'teacher', module: 'activities', action: 'create' })).toBe(true);
    expect(can({ role: 'teacher', module: 'observations', action: 'create' })).toBe(true);
    expect(can({ role: 'teacher', module: 'students', action: 'delete' })).toBe(false);
    expect(can({ role: 'teacher', module: 'grades', action: 'delete' })).toBe(false);
  });

  it('admin não recebe exclusão definitiva por padrão — só por concessão explícita do Owner', () => {
    expect(can({ role: 'admin', module: 'students', action: 'delete' })).toBe(false);
    const grant = override({ role: undefined, userId: 'admin-1', module: 'students', actions: ['delete'] });
    expect(can({ role: 'admin', module: 'students', action: 'delete', overrides: [grant] })).toBe(true);
  });

  it('owner tem acesso completo a todos os módulos administrativos', () => {
    for (const action of ['view', 'create', 'edit', 'import', 'export', 'approve', 'delete', 'administer'] as const) {
      expect(can({ role: 'owner', module: 'permissions', action })).toBe(true);
    }
  });

  it('sobreposição específica (aluno) vence a sobreposição mais genérica (escola)', () => {
    const schoolLevelDeny = override({ schoolId: 'school-1', module: 'grades', actions: [] });
    const studentLevelAllow = override({ id: 'ov-2', schoolId: 'school-1', studentId: 'student-1', module: 'grades', actions: ['view'] });
    const result = can({
      role: 'guardian',
      module: 'grades',
      action: 'view',
      schoolId: 'school-1',
      studentId: 'student-1',
      overrides: [schoolLevelDeny, studentLevelAllow],
    });
    expect(result).toBe(true);
  });

  it('sobreposição expirada (validUntil no passado) é ignorada e cai no padrão do perfil', () => {
    const expired = override({ module: 'students', actions: ['delete'], validUntil: '2000-01-01T00:00:00.000Z' });
    expect(can({ role: 'admin', module: 'students', action: 'delete', overrides: [expired] })).toBe(false);
  });
});
