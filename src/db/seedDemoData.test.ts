import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import { isDemoDataLoaded, loadDemoData, removeDemoData } from './seedDemoData';
import { DEMO_ORG_ID } from './demoIds';

async function clearAllTables() {
  for (const table of db.tables) {
    await table.clear();
  }
}

describe('Dados de demonstração (carregar/remover) — seção 29 do briefing', () => {
  beforeEach(async () => {
    await clearAllTables();
  });

  it('cria escolas, turmas, alunos, responsáveis e usuários de demonstração', async () => {
    await loadDemoData();

    expect(await isDemoDataLoaded()).toBe(true);
    expect(await db.schools.count()).toBe(2);
    expect(await db.classes.count()).toBe(4);
    expect(await db.students.count()).toBe(4);
    expect(await db.guardians.count()).toBe(2);
    expect(await db.users.count()).toBe(5); // owner, admin, professor, responsável, aluno

    const allStudentsAreDemo = (await db.students.toArray()).every((s) => s.isDemo === true);
    expect(allStudentsAreDemo).toBe(true);
  });

  it('não duplica dados se carregado mais de uma vez (idempotente)', async () => {
    await loadDemoData();
    await loadDemoData();

    expect(await db.schools.count()).toBe(2);
    expect(await db.organizations.count()).toBe(1);
  });

  it('remove somente os registros marcados como demo, preservando cadastros reais', async () => {
    await loadDemoData();

    const actor = { userId: 'real-user', organizationId: DEMO_ORG_ID };
    const now = new Date().toISOString();
    await db.schools.add({
      id: 'real-school-1',
      organizationId: DEMO_ORG_ID,
      name: 'Escola Real Cadastrada Pelo Usuário',
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
      updatedBy: actor.userId,
      version: 1,
      status: 'active',
      isDemo: false,
    });

    await removeDemoData();

    expect(await isDemoDataLoaded()).toBe(false);
    expect(await db.schools.count()).toBe(1);
    const remaining = await db.schools.toArray();
    expect(remaining[0].id).toBe('real-school-1');
  });
});
