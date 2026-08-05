# Migrações Supabase (Fase 6)

Este diretório contém o schema Postgres completo do Acompanha Escola, pronto para ser
aplicado a um projeto Supabase real. **Nenhuma destas migrações foi executada** —
o app roda 100% em IndexedDB local até que você decida ativar a nuvem.

## Arquivos

1. `0001_init_schema.sql` — todas as ~38 tabelas, enums e índices, espelhando
   `src/domain/*.ts` e `docs/data-model.md`.
2. `0002_rls_policies.sql` — Row Level Security em todas as tabelas sensíveis, com
   funções auxiliares (`is_owner_or_admin`, `teaches_class`, `guardian_of_student`,
   `is_own_student`, `has_granted_permission`) que replicam a mesma precedência de
   `src/auth/permissions.ts`.
3. `0003_privileged_functions.sql` — funções `security definer` para exclusão
   definitiva, gravação de auditoria e aplicação de políticas de retenção. Nunca
   fazem um DELETE/INSERT direto sem checar permissão e sem auditar.

## Como aplicar

Com a [Supabase CLI](https://supabase.com/docs/guides/cli) e um projeto já criado:

```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```

Ou, com um agente que tenha acesso ao MCP do Supabase, usando `apply_migration` para
cada arquivo, em ordem.

## Depois de aplicar

1. Copie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (nunca a service role key) do
   painel do projeto para um `.env.local` (não commitado):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
2. Reinicie o `npm run dev`. `src/repositories/RepositoryProvider.tsx` detecta as
   variáveis e passa a usar `Supabase*Repository` para organizations, schools,
   classes, students, guardians e student_guardians — as demais entidades continuam
   em IndexedDB até ganharem sua própria implementação (mesmo padrão de
   `src/repositories/supabase/*.ts`).
3. Troque a autenticação demo por Supabase Auth em `src/auth/authStore.ts`
   (`loginWithPassword`) — hoje ele compara hash local; a assinatura de `Session`
   já é a mesma que o app espera.
4. Migre os dados existentes: exporte o IndexedDB local pela tela **Backup** e
   escreva um importador que faça `upsert` em lote respeitando a mesma detecção de
   duplicidade usada no assistente de importação.

Nada disso é necessário para continuar usando e testando o app localmente.
