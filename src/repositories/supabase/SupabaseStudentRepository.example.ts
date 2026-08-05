import type { Student } from '../../domain';
import type { ActorContext, ListOptions, Repository } from '../interfaces/Repository';

/**
 * Esqueleto de referência para a Fase 6 (migração para Supabase).
 * Implementa o MESMO contrato `Repository<Student>` usado por `LocalStudentRepository`,
 * então o `RepositoryProvider` poderá trocar uma implementação pela outra sem tocar
 * em nenhuma tela. Não é usado em runtime nesta fase — arquivo `.example.ts` para não
 * entrar no build nem sugerir uma dependência ativa do @supabase/supabase-js ainda.
 *
 * Pontos a implementar quando o Supabase entrar:
 * - client vem de um módulo `lib/supabaseClient.ts` com a anon key pública (nunca a
 *   service role key, que fica só em Edge Functions/servidor).
 * - list() -> select com RLS já filtrando por organização/escola/turma/vínculo.
 * - create/update -> respeitam policies; nunca fazem hard delete direto (usar RPC
 *   segura para exclusão definitiva, com auditoria).
 * - softDelete -> update status='deleted' (mesma semântica do local).
 */
export class SupabaseStudentRepository implements Repository<Student> {
  async list(_options?: ListOptions<Student>): Promise<Student[]> {
    throw new Error('SupabaseStudentRepository ainda não implementado (Fase 6).');
  }
  async getById(_id: string): Promise<Student | undefined> {
    throw new Error('SupabaseStudentRepository ainda não implementado (Fase 6).');
  }
  async create(): Promise<Student> {
    throw new Error('SupabaseStudentRepository ainda não implementado (Fase 6).');
  }
  async update(): Promise<Student> {
    throw new Error('SupabaseStudentRepository ainda não implementado (Fase 6).');
  }
  async softDelete(): Promise<void> {
    throw new Error('SupabaseStudentRepository ainda não implementado (Fase 6).');
  }
  async restore(): Promise<void> {
    throw new Error('SupabaseStudentRepository ainda não implementado (Fase 6).');
  }
  async hardDelete(): Promise<void> {
    throw new Error('SupabaseStudentRepository ainda não implementado (Fase 6).');
  }
  async _actorUnused(_actor?: ActorContext) {
    /* placeholder to keep type import used */
  }
}
