/**
 * Campos comuns a (quase) toda entidade persistida. Espelha o que no Postgres/Supabase
 * seria: id uuid, organization_id uuid, created_at, updated_at, created_by, updated_by,
 * version int, status text, deleted_at, deleted_by, delete_reason.
 */
export type RecordStatus = 'active' | 'archived' | 'deleted';

export interface BaseEntity {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  status: RecordStatus;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  isDemo?: boolean;
}

export type EducationStage = 'early_childhood' | 'elementary';

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type Shift = 'morning' | 'afternoon' | 'full_time' | 'evening';

export interface Address {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
