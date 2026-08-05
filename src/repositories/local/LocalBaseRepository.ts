import type { EntityTable } from 'dexie';
import type { BaseEntity } from '../../domain/common';
import { newId, nowIso } from '../../domain/common';
import type { ActorContext, ListOptions, Repository } from '../interfaces/Repository';

/**
 * Implementação genérica de Repository sobre uma tabela Dexie.
 * Toda entidade com BaseEntity ganha CRUD + exclusão lógica "de graça".
 * Repositórios específicos devem estender esta classe para adicionar consultas próprias
 * (ex.: findByStudent, findByClass) mantendo a mesma interface pública.
 *
 * Os casts `as never` nas chamadas de tabela contornam uma limitação de inferência do
 * Dexie ao tipar `EntityTable<T, 'id'>` com T genérico: a chave primária é sempre
 * `string` (id), mas o TypeScript não consegue provar isso a partir de um T aberto.
 */
export class LocalBaseRepository<T extends BaseEntity> implements Repository<T> {
  protected table: EntityTable<T, 'id'>;

  constructor(table: EntityTable<T, 'id'>) {
    this.table = table;
  }

  async list(options: ListOptions<T> = {}): Promise<T[]> {
    let items = await this.table.toArray();
    if (options.filter) {
      const entries = Object.entries(options.filter);
      items = items.filter((item) =>
        entries.every(([key, value]) => (item as Record<string, unknown>)[key] === value),
      );
    }
    if (options.where) {
      items = items.filter(options.where);
    }
    if (!options.includeDeleted) {
      items = items.filter((item) => item.status !== 'deleted');
    }
    if (!options.includeArchived) {
      items = items.filter((item) => item.status !== 'archived');
    }
    return items;
  }

  async getById(id: string): Promise<T | undefined> {
    return this.table.get(id as never);
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
    await this.table.add(entity);
    return entity;
  }

  async update(id: string, changes: Partial<T>, actor: ActorContext): Promise<T> {
    const existing = await this.table.get(id as never);
    if (!existing) {
      throw new Error(`Registro ${id} não encontrado.`);
    }
    const updated: T = {
      ...existing,
      ...changes,
      id: existing.id,
      updatedAt: nowIso(),
      updatedBy: actor.userId,
      version: existing.version + 1,
    };
    await this.table.put(updated);
    return updated;
  }

  async softDelete(id: string, actor: ActorContext, reason: string): Promise<void> {
    const existing = await this.table.get(id as never);
    if (!existing) return;
    await this.table.put({
      ...existing,
      status: 'deleted',
      deletedAt: nowIso(),
      deletedBy: actor.userId,
      deleteReason: reason,
      updatedAt: nowIso(),
      updatedBy: actor.userId,
      version: existing.version + 1,
    });
  }

  async restore(id: string, actor: ActorContext): Promise<void> {
    const existing = await this.table.get(id as never);
    if (!existing) return;
    await this.table.put({
      ...existing,
      status: 'active',
      deletedAt: undefined,
      deletedBy: undefined,
      deleteReason: undefined,
      updatedAt: nowIso(),
      updatedBy: actor.userId,
      version: existing.version + 1,
    });
  }

  async hardDelete(id: string, _actor: ActorContext, _reason: string): Promise<void> {
    await this.table.delete(id as never);
  }
}
