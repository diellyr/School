export type AuditAction =
  | 'login'
  | 'login_attempt'
  | 'create'
  | 'view_sensitive'
  | 'edit'
  | 'import'
  | 'export'
  | 'approve'
  | 'publish'
  | 'soft_delete'
  | 'restore'
  | 'permission_change'
  | 'sync'
  | 'sync_failure'
  | 'report_query';

export interface AuditLog {
  id: string;
  organizationId: string;
  createdAt: string;
  userId: string;
  role: string;
  action: AuditAction;
  module: string;
  entityId?: string;
  reason?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  deviceOrSession?: string;
  result: 'success' | 'failure';
}
