import type { SupabaseClient } from '@supabase/supabase-js';
import type { BaseEntity } from '../../domain/common';
import { newId, nowIso } from '../../domain/common';
import type { ActorContext, ListOptions, Repository } from '../interfaces/Repository';

/**
 * Implementação genérica de Repository sobre uma tabela Postgres/Supabase, espelhando
 * `LocalBaseRepository` campo a campo (mesma semântica de exclusão lógica, versão e
 * autoria) para que `RepositoryProvider` possa trocar uma pela outra sem que nenhuma
 * tela precise mudar.
 *
 * RLS (Row Level Security) no Postgres é quem decide o que cada usuário pode ler/gravar
 * — este repositório não duplica essa lógica no cliente, apenas assume que as policies
 * já filtram o que a query pode enxergar.
 */
export class SupabaseBaseRepository<T extends BaseEntity> implements Repository<T> {
  protected client: SupabaseClient;
  protected table: string;

  constructor(client: SupabaseClient, table: string) {
    this.client = client;
    this.table = table;
  }

  async list(options: ListOptions<T> = {}): Promise<T[]> {
    let query = this.client.from(this.table).select('*');
    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        query = query.eq(snakeCase(key), value);
      }
    }
    if (!options.includeDeleted) {
      query = query.neq('status', 'deleted');
    }
    const { data, error } = await query;
    if (error) throw error;
    let items = (data ?? []).map(fromRow) as T[];
    if (options.where) items = items.filter(options.where);
    return items;
  }

  async getById(id: string): Promise<T | undefined> {
    const { data, error } = await this.client.from(this.table).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? (fromRow(data) as T) : undefined;
  }

  async create(data: Omit<T, keyof BaseEntity> & Partial<BaseEntity>, actor: ActorContext): Promise<T> {
    const now = nowIso();
    const entity = {
      ...data,
      id: data.id ?? newId(),
      organizationId: data.organizationId ?? actor.organizationId,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
      updatedBy: actor.userId,
      version: 1,
      status: data.status ?? 'active',
    } as T;
    const { error } = await this.client.from(this.table).insert(toRow(entity));
    if (error) throw error;
    return entity;
  }

  async update(id: string, changes: Partial<T>, actor: ActorContext): Promise<T> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Registro ${id} não encontrado.`);
    const updated: T = { ...existing, ...changes, id, updatedAt: nowIso(), updatedBy: actor.userId, version: existing.version + 1 };
    const { error } = await this.client.from(this.table).update(toRow(updated)).eq('id', id);
    if (error) throw error;
    return updated;
  }

  async softDelete(id: string, actor: ActorContext, reason: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    const updated = { ...existing, status: 'deleted' as const, deletedAt: nowIso(), deletedBy: actor.userId, deleteReason: reason, updatedAt: nowIso(), updatedBy: actor.userId, version: existing.version + 1 };
    const { error } = await this.client.from(this.table).update(toRow(updated)).eq('id', id);
    if (error) throw error;
  }

  async restore(id: string, actor: ActorContext): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    const updated = { ...existing, status: 'active' as const, deletedAt: undefined, deletedBy: undefined, deleteReason: undefined, updatedAt: nowIso(), updatedBy: actor.userId, version: existing.version + 1 };
    const { error } = await this.client.from(this.table).update(toRow(updated)).eq('id', id);
    if (error) throw error;
  }

  /**
   * Exclusão definitiva nunca deve ser um DELETE direto do cliente — mesmo com RLS,
   * fica mais seguro e mais fácil de auditar como uma função Postgres (`security
   * definer`) chamada via RPC, que valida a permissão e grava em audit_logs no mesmo
   * commit. Ver docs/supabase-migration.md.
   */
  async hardDelete(id: string, actor: ActorContext, reason: string): Promise<void> {
    const { error } = await this.client.rpc('hard_delete_record', {
      p_table: this.table,
      p_id: id,
      p_reason: reason,
      p_actor: actor.userId,
    });
    if (error) throw error;
  }
}

function snakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function camelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function toRow(entity: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(entity).map(([key, value]) => [snakeCase(key), value]));
}

function fromRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [camelCase(key), value]));
}
