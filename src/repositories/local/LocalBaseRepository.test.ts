import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/schema';
import { LocalSchoolRepository } from './schoolRepository';

const actor = { userId: 'user-1', organizationId: 'org-1' };

describe('LocalBaseRepository — CRUD e exclusão lógica (usada por todos os repositórios locais)', () => {
  beforeEach(async () => {
    await db.schools.clear();
  });

  it('cria um registro preenchendo campos de auditoria automaticamente', async () => {
    const repo = new LocalSchoolRepository();
    const school = await repo.create({ name: 'Escola Teste' }, actor);
    expect(school.id).toBeTruthy();
    expect(school.createdBy).toBe(actor.userId);
    expect(school.version).toBe(1);
    expect(school.status).toBe('active');
  });

  it('list() nunca retorna registros com status "deleted" por padrão', async () => {
    const repo = new LocalSchoolRepository();
    const school = await repo.create({ name: 'Escola A' }, actor);
    await repo.softDelete(school.id, actor, 'Duplicidade cadastral');

    const visible = await repo.list();
    expect(visible.find((s) => s.id === school.id)).toBeUndefined();

    const withDeleted = await repo.list({ includeDeleted: true });
    expect(withDeleted.find((s) => s.id === school.id)).toBeDefined();
  });

  it('softDelete preserva o histórico (motivo, quem apagou, quando) em vez de destruir o registro', async () => {
    const repo = new LocalSchoolRepository();
    const school = await repo.create({ name: 'Escola B' }, actor);
    await repo.softDelete(school.id, actor, 'Fechamento da unidade');

    const stored = await repo.getById(school.id);
    expect(stored?.status).toBe('deleted');
    expect(stored?.deletedBy).toBe(actor.userId);
    expect(stored?.deleteReason).toBe('Fechamento da unidade');
  });

  it('restore() traz um registro excluído logicamente de volta para "active"', async () => {
    const repo = new LocalSchoolRepository();
    const school = await repo.create({ name: 'Escola C' }, actor);
    await repo.softDelete(school.id, actor, 'Teste');
    await repo.restore(school.id, actor);

    const restored = await repo.getById(school.id);
    expect(restored?.status).toBe('active');
    expect(restored?.deletedAt).toBeUndefined();

    const visible = await repo.list();
    expect(visible.find((s) => s.id === school.id)).toBeDefined();
  });

  it('update() incrementa a versão e mantém o histórico de quem criou o registro', async () => {
    const repo = new LocalSchoolRepository();
    const school = await repo.create({ name: 'Escola D' }, actor);
    const updated = await repo.update(school.id, { name: 'Escola D Renomeada' }, { userId: 'user-2', organizationId: 'org-1' });

    expect(updated.name).toBe('Escola D Renomeada');
    expect(updated.version).toBe(2);
    expect(updated.createdBy).toBe(actor.userId);
    expect(updated.updatedBy).toBe('user-2');
  });

  it('hardDelete() remove o registro definitivamente (usado apenas com permissão explícita)', async () => {
    const repo = new LocalSchoolRepository();
    const school = await repo.create({ name: 'Escola E' }, actor);
    await repo.hardDelete(school.id, actor, 'Solicitação legal de exclusão');

    const stored = await repo.getById(school.id);
    expect(stored).toBeUndefined();
  });
});
