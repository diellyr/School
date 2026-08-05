import { db } from '../../db/schema';
import type { AuditAction, AuditLog } from '../../domain';
import { newId, nowIso } from '../../domain/common';

export interface AuditContext {
  userId: string;
  role: string;
  organizationId: string;
}

/**
 * Log de auditoria: append-only, nunca editável por usuários comuns.
 * Sem exclusão lógica — auditoria é o próprio histórico.
 */
export class LocalAuditRepository {
  async record(
    actor: AuditContext,
    entry: {
      action: AuditAction;
      module: string;
      entityId?: string;
      reason?: string;
      previousValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      result?: 'success' | 'failure';
    },
  ): Promise<AuditLog> {
    const log: AuditLog = {
      id: newId(),
      organizationId: actor.organizationId,
      createdAt: nowIso(),
      userId: actor.userId,
      role: actor.role,
      action: entry.action,
      module: entry.module,
      entityId: entry.entityId,
      reason: entry.reason,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      deviceOrSession: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      result: entry.result ?? 'success',
    };
    await db.auditLogs.add(log);
    return log;
  }

  async list(): Promise<AuditLog[]> {
    const items = await db.auditLogs.toArray();
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findByUser(userId: string): Promise<AuditLog[]> {
    const items = await this.list();
    return items.filter((log) => log.userId === userId);
  }
}
