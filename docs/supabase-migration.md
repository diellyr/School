# Plano de migração para Supabase/PostgreSQL (Fase 6)

Este documento descreve como a versão local (IndexedDB/Dexie) evolui para usar Supabase, sem
reescrever as telas React — apenas trocando a implementação injetada pelo `RepositoryProvider`.

> **Status:** o código desta fase já existe e compila (`src/repositories/supabase/*.ts`,
> `supabase/migrations/*.sql`), mas **nenhuma migração foi executada contra um projeto real** e
> nenhuma variável `VITE_SUPABASE_*` está configurada — o app continua 100% em IndexedDB local até
> uma decisão explícita de ativar a nuvem. Ver `supabase/README.md` para o passo a passo de ativação.

## 1. Por que a migração é de baixo risco aqui

- Toda tela consome `useRepositories()` (`src/repositories/RepositoryProvider.tsx`), nunca o Dexie
  diretamente.
- Cada repositório implementa a mesma interface `Repository<T>`
  (`src/repositories/interfaces/Repository.ts`): `list`, `getById`, `create`, `update`,
  `softDelete`, `restore`, `hardDelete`.
- Os tipos de domínio (`src/domain/*.ts`) já espelham o formato relacional (ids, timestamps,
  organização, autoria, versão, status) — ver [`data-model.md`](./data-model.md).
- Implementações reais (não apenas esqueleto) já existem para as entidades mais usadas:
  `SupabaseOrganizationRepository`, `SupabaseSchoolRepository`, `SupabaseClassRepository`
  (`src/repositories/supabase/schoolRepository.ts`) e `SupabaseStudentRepository`,
  `SupabaseGuardianRepository`, `SupabaseStudentGuardianRepository`
  (`src/repositories/supabase/studentRepository.ts`), todas sobre `SupabaseBaseRepository`
  (genérica, espelha `LocalBaseRepository` campo a campo). `RepositoryProvider` já sabe alternar
  entre Local* e Supabase* por entidade quando `isSupabaseConfigured` for verdadeiro
  (`src/lib/supabaseClient.ts`).
- O schema SQL completo (~38 tabelas) e as políticas RLS estão em `supabase/migrations/`, prontos
  para `supabase db push` — não são mais só um esboço no doc, são arquivos executáveis.

## 2. Passo a passo

1. ✅ **Schema SQL e políticas RLS escritos** — `supabase/migrations/0001_init_schema.sql`,
   `0002_rls_policies.sql`, `0003_privileged_functions.sql`. Faltando: **aplicar** contra um projeto
   real (`supabase db push` ou `apply_migration`).
2. ✅ **`Supabase*Repository` implementados** para `organizations`, `schools`, `classes`, `students`,
   `guardians`, `student_guardians` (`src/repositories/supabase/*.ts`), sobre uma
   `SupabaseBaseRepository` genérica que espelha `LocalBaseRepository`. As demais entidades ainda
   usam apenas `Local*Repository`.
3. ✅ **`RepositoryProvider` já decide** Local* vs. Supabase* por entidade, condicionado a
   `isSupabaseConfigured` (`src/lib/supabaseClient.ts`) — hoje sempre falso porque nenhuma variável
   de ambiente foi definida, então o comportamento atual não muda.
4. ⬜ **Trocar a autenticação demo por Supabase Auth**: `src/auth/authStore.ts` isola
   `loginWithPassword()` como único ponto de entrada — a troca fica encapsulada ali, mantendo a
   mesma forma de `Session` usada pelo resto do app. Ainda não feito.
5. ⬜ **Mover toda lógica privilegiada para o backend**: nunca incluir a `service_role key` no
   frontend. `hard_delete_record` e `record_audit_log` (migração 0003) já existem como funções
   `security definer` para isso — falta o RPC de "aprovar concessão de permissão entre
   organizações" e qualquer relatório agregado entre escolas.
6. ⬜ **Migrar dados existentes**: usar o módulo de Backup (`src/features/backup`) para exportar o
   IndexedDB local em JSON e escrever um importador único que faz `upsert` em lote no Postgres,
   respeitando a mesma detecção de duplicidade por hash usada na importação de arquivos. Ainda não
   escrito — o backup local já exporta o JSON, falta o lado que importa para o Postgres.

## 3. Autenticação e RLS — princípios

- **Supabase Auth** substitui `passwordHash`/`failedLoginAttempts` locais; `AppUser` passa a
  referenciar `auth.users.id`.
- **Row Level Security habilitado em todas as tabelas.** Nenhuma tabela fica acessível sem policy
  explícita.
- Policies são compostas por **organização → escola → turma → aluno → vínculo familiar**, do mais
  genérico para o mais específico, replicando a mesma precedência usada em
  `src/auth/permissions.ts` (`can()` + `UserPermission`).
- O **Owner não tem acesso irrestrito automático a dados sensíveis de crianças** — mesmo sendo o
  perfil de maior autoridade, o acesso a um registro sensível específico passa por concessão
  registrada em `user_permissions` e é sempre auditado (`audit_logs`), replicando a regra da seção 5
  do briefing também no backend.

## 4. Schema SQL

O schema completo (~38 tabelas, todos os enums e índices) está em
[`supabase/migrations/0001_init_schema.sql`](../supabase/migrations/0001_init_schema.sql) — não é
mais um esboço, é o arquivo que seria aplicado de verdade. Espelha campo a campo
[`data-model.md`](./data-model.md).

## 5. Políticas RLS

Implementadas em [`supabase/migrations/0002_rls_policies.sql`](../supabase/migrations/0002_rls_policies.sql),
usando um pequeno conjunto de funções auxiliares `security definer` (`is_owner_or_admin`,
`teaches_class`, `guardian_of_student`, `is_own_student`, `has_granted_permission`) para não repetir
a mesma lógica em cada tabela. Padrão geral: **nada é visível por padrão**; cada tabela sensível
(`students`, `grades`, `assessments`, `attendance`, `teacher_observations`, `alerts`, `documents`,
`portfolios`, `school_events`) segue o mesmo padrão de quatro níveis — admin/owner da organização,
professor da turma, responsável do aluno, aluno do próprio registro.

`audit_logs` só tem policy de `select` (para owner/admin) — sem `update`/`delete` para ninguém, e a
inserção deveria passar pela função `record_audit_log` (migração 0003) em vez de um INSERT direto,
reforçando a seção 23 do briefing ("logs de auditoria não podem ser editados por usuários comuns").

Exclusão definitiva (`hard_delete_record`) e aplicação de políticas de retenção
(`apply_retention_policies`) também são funções `security definer` em
[`0003_privileged_functions.sql`](../supabase/migrations/0003_privileged_functions.sql) — nunca um
DELETE direto do cliente, sempre auditado antes de apagar.

> Estas migrações não foram executadas contra nenhum projeto Supabase real nem revisadas por um DBA
> humano. Antes de aplicar em produção, rode-as primeiro em um projeto de teste
> (`supabase db push` para um branch/projeto descartável) e revise as policies com atenção — RLS mal
> configurado é o jeito mais comum de vazar dados de crianças por engano.

## 6. Consentimento e retenção

- `consents` guarda a autorização de uso de imagem e tratamento de dados por responsável/aluno — a
  UI de importação e portfólio deve checar consentimento de imagem antes de permitir publicar fotos.
- `data_retention_rules` é lida pela função `apply_retention_policies()` (migração 0003), pensada
  para ser chamada por um job agendado (Supabase Cron). Hoje ela arquiva registros vencidos e grava
  em `audit_logs`; a exclusão definitiva automática por regra de retenção ainda não está implementada
  — fica para quando houver um caso real de uso antes de arriscar apagar dado por engano.

## 7. O que muda no frontend

| Hoje (Fase 1, local) | Depois (Fase 6, Supabase) |
|---|---|
| `authStore.loginWithPassword()` compara hash local | chama `supabase.auth.signInWithPassword()` |
| `RepositoryProvider` sempre injeta `Local*Repository` | decide por organização: `Local*`, `Supabase*` ou ambos + `sync_queue` |
| Sessão expira por TTL local (`SESSION_TTL_MINUTES`) | sessão gerenciada pelo Supabase Auth (refresh token) |
| Upload de arquivo grava blob no IndexedDB | upload vai para Supabase Storage; `documents.blob_ref` vira `documents.url` |

Nenhuma página, formulário ou componente visual precisa mudar — apenas a fábrica de repositórios e
o módulo de autenticação.
