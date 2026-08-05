import type { BaseEntity } from '../../domain/common';

export interface ListOptions<T> {
  filter?: Partial<T>;
  where?: (item: T) => boolean;
  includeDeleted?: boolean;
  includeArchived?: boolean;
}

export interface ActorContext {
  userId: string;
  organizationId: string;
}

/**
 * Contrato comum a todos os repositórios de domínio. `Local*Repository` implementa
 * isso sobre Dexie/IndexedDB hoje; `Supabase*Repository` (Fase 6) implementa o mesmo
 * contrato sobre Postgres — as telas dependem apenas desta interface.
 */
export interface Repository<T extends BaseEntity> {
  list(options?: ListOptions<T>): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  create(data: Omit<T, keyof BaseEntity> & Partial<BaseEntity>, actor: ActorContext): Promise<T>;
  update(id: string, changes: Partial<T>, actor: ActorContext): Promise<T>;
  softDelete(id: string, actor: ActorContext, reason: string): Promise<void>;
  restore(id: string, actor: ActorContext): Promise<void>;
  hardDelete(id: string, actor: ActorContext, reason: string): Promise<void>;
}
