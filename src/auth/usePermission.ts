import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useAuthStore } from './authStore';
import { can } from './permissions';
import type { PermissionAction, SystemModule, UserPermission } from '../domain';

/**
 * Hook central de autorização de UI. Componentes usam `usePermission('students', 'edit')`
 * para decidir o que renderizar/habilitar — nunca leem o perfil "cru" para inferir regras,
 * o que manteria a lógica de RBAC espalhada pelas telas.
 */
export function usePermission(module: SystemModule, action: PermissionAction, scope?: { schoolId?: string; classId?: string; studentId?: string }): boolean {
  const session = useAuthStore((s) => s.session);

  const overrides = useLiveQuery<UserPermission[]>(
    () => (session ? db.userPermissions.where('userId').equals(session.user.id).toArray() : Promise.resolve<UserPermission[]>([])),
    [session?.user.id],
  );

  if (!session) return false;

  return can({
    role: session.role,
    module,
    action,
    overrides: overrides ?? [],
    ...scope,
  });
}

export function useCurrentUser() {
  return useAuthStore((s) => s.session?.user ?? null);
}

export function useCurrentRole() {
  return useAuthStore((s) => s.session?.role ?? null);
}
