# Plano de migração para Supabase/PostgreSQL (Fase 6)

Este documento descreve como a versão local (IndexedDB/Dexie) evolui para usar Supabase, sem
reescrever as telas React — apenas trocando a implementação injetada pelo `RepositoryProvider`.

## 1. Por que a migração é de baixo risco aqui

- Toda tela consome `useRepositories()` (`src/repositories/RepositoryProvider.tsx`), nunca o Dexie
  diretamente.
- Cada repositório implementa a mesma interface `Repository<T>`
  (`src/repositories/interfaces/Repository.ts`): `list`, `getById`, `create`, `update`,
  `softDelete`, `restore`, `hardDelete`.
- Os tipos de domínio (`src/domain/*.ts`) já espelham o formato relacional (ids, timestamps,
  organização, autoria, versão, status) — ver [`data-model.md`](./data-model.md).
- Um esqueleto de referência já existe em
  `src/repositories/supabase/SupabaseStudentRepository.example.ts`.

## 2. Passo a passo

1. **Provisionar o projeto Supabase** e aplicar o schema SQL (seção 4).
2. **Implementar `Supabase*Repository`** para cada entidade, uma por uma, começando pelas usadas na
   Fase 1 (`organizations`, `schools`, `classes`, `students`, `guardians`, `users`).
3. **Estender o `RepositoryProvider`** para decidir, por configuração da organização (o toggle
   "Salvar no banco de dados — nuvem" descrito na Fase 3), se instancia `Local*`, `Supabase*`, ou uma
   composição (grava local imediatamente + enfileira em `sync_queue` para sincronizar).
4. **Trocar a autenticação demo por Supabase Auth**: `src/auth/authStore.ts` já isola
   `loginWithPassword()` como único ponto de entrada — a troca é encapsulada ali, mantendo a mesma
   forma de `Session` usada pelo resto do app.
5. **Mover toda lógica privilegiada para o backend**: nunca incluir a `service_role key` no
   frontend. Operações sensíveis (exclusão definitiva, alteração de permissões de outros usuários,
   relatórios agregados entre escolas) devem virar Edge Functions/RPCs autenticadas, chamadas pelo
   `Supabase*Repository` com a `anon key` pública + RLS.
6. **Migrar dados existentes**: usar o módulo de Backup (`src/features/backup`) para exportar o
   IndexedDB local em JSON e escrever um importador único que faz `upsert` em lote no Postgres,
   respeitando a mesma detecção de duplicidade por hash usada na importação de arquivos.

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

## 4. Esboço do schema SQL

Trecho ilustrativo (não exaustivo — replica 1:1 as entidades de `data-model.md`). Tipos `jsonb` são
usados para campos compostos (endereço, anexos, etc.).

```sql
create extension if not exists "pgcrypto";

create type record_status as enum ('active', 'archived', 'deleted');
create type system_role as enum ('owner', 'admin', 'teacher', 'guardian', 'student');
create type education_stage as enum ('early_childhood', 'elementary');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  document text,
  cloud_storage_enabled boolean not null default true,
  retention_policy_days integer,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  delete_reason text
);

create table schools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  document text,
  address jsonb,
  phone text,
  email text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  school_id uuid not null references schools(id),
  academic_year_id uuid not null references academic_years(id),
  name text not null,
  stage education_stage not null,
  grade text not null,
  shift text not null,
  homeroom_teacher_id uuid references auth.users(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  school_id uuid not null references schools(id),
  class_id uuid references classes(id),
  full_name text not null,
  social_name text,
  birth_date date not null,
  matriculation_status text not null default 'active',
  internal_code text,
  authorized_notes text,
  accessibility jsonb,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  full_name text not null,
  document text,
  email text,
  phone text,
  relationship text not null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table student_guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid not null references students(id),
  guardian_id uuid not null references guardians(id),
  relationship text not null,
  is_primary boolean not null default false,
  can_pick_up boolean not null default false,
  financial_responsible boolean not null default false,
  status record_status not null default 'active',
  unique (student_id, guardian_id)
);

create table user_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  role system_role,
  school_id uuid references schools(id),
  class_id uuid references classes(id),
  student_id uuid references students(id),
  module text not null,
  actions text[] not null,
  granted_by uuid not null references auth.users(id),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  status record_status not null default 'active'
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null,
  action text not null,
  module text not null,
  entity_id uuid,
  reason text,
  previous_value jsonb,
  new_value jsonb,
  device_or_session text,
  result text not null,
  created_at timestamptz not null default now()
);
-- audit_logs nunca recebe UPDATE/DELETE de usuários comuns: sem policy de update/delete além de uma
-- função privilegiada de retenção executada pelo backend.
```

As demais tabelas (`school_units`, `academic_years`, `enrollments`, `teacher_assignments`,
`assessment_scales`, `assessment_categories`, `activities`, `assessments`, `grades`, `attendance`,
`teacher_observations`, `parent_observations`, `alerts`, `alert_rules`, `alert_acknowledgements`,
`school_events`, `event_participants`, `event_confirmations`, `portfolios`, `documents`, `imports`,
`import_rows`, `storage_logs`, `sync_queue`, `consents`, `recommendations`, `notifications`,
`data_retention_rules`) seguem o mesmo padrão, replicando 1:1 os campos documentados em
[`data-model.md`](./data-model.md).

## 5. Políticas RLS sugeridas

Padrão geral: **nada é visível por padrão**; cada policy soma uma condição de acesso.

```sql
alter table students enable row level security;

-- Owner e admin da própria organização veem todos os alunos da organização.
create policy students_org_admin_select on students
  for select using (
    exists (
      select 1 from user_permissions up
      where up.user_id = auth.uid()
        and up.organization_id = students.organization_id
        and up.role in ('owner', 'admin')
        and up.status = 'active'
        and (up.valid_until is null or up.valid_until > now())
    )
  );

-- Professor vê alunos das turmas em que está atribuído.
create policy students_teacher_select on students
  for select using (
    exists (
      select 1 from teacher_assignments ta
      where ta.teacher_user_id = auth.uid()
        and ta.class_id = students.class_id
        and ta.status = 'active'
    )
  );

-- Responsável vê apenas os filhos vinculados.
create policy students_guardian_select on students
  for select using (
    exists (
      select 1 from student_guardians sg
      join guardians g on g.id = sg.guardian_id
      join users u on u.guardian_id = g.id
      where u.id = auth.uid() and sg.student_id = students.id and sg.status = 'active'
    )
  );

-- Aluno vê apenas o próprio registro.
create policy students_self_select on students
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.student_id = students.id)
  );

-- Escrita: só quem tem 'edit'/'create' concedido explicitamente (via user_permissions) ou é
-- professor/admin/owner da turma/escola/organização correspondente.
create policy students_write on students
  for insert with check ( /* mesma lógica de user_permissions.actions @> array['create'] */ true );
```

Cada tabela sensível (`grades`, `assessments`, `attendance`, `teacher_observations`, `alerts`,
`documents`, `portfolios`) recebe o mesmo padrão de quatro policies (admin/owner da organização,
professor da turma, responsável do aluno, aluno do próprio registro), sempre checando `status =
'active'` nas tabelas de vínculo e `valid_until` nas concessões pontuais de `user_permissions`.

`audit_logs` só tem policy de `select` (para owner/admin com permissão de auditoria) e `insert` (via
função `security definer` chamada pelo backend) — nunca `update`/`delete` para usuários comuns,
reforçando a seção 23 do briefing ("logs de auditoria não podem ser editados por usuários comuns").

## 6. Consentimento e retenção

- `consents` guarda a autorização de uso de imagem e tratamento de dados por responsável/aluno — a
  UI de importação e portfólio deve checar consentimento de imagem antes de permitir publicar fotos.
- `data_retention_rules` é lida por um job agendado (Supabase Cron/Edge Function) que move registros
  vencidos para `status = 'archived'` e, quando a regra manda apagar, executa exclusão definitiva
  auditada — nunca automática sem rastro.

## 7. O que muda no frontend

| Hoje (Fase 1, local) | Depois (Fase 6, Supabase) |
|---|---|
| `authStore.loginWithPassword()` compara hash local | chama `supabase.auth.signInWithPassword()` |
| `RepositoryProvider` sempre injeta `Local*Repository` | decide por organização: `Local*`, `Supabase*` ou ambos + `sync_queue` |
| Sessão expira por TTL local (`SESSION_TTL_MINUTES`) | sessão gerenciada pelo Supabase Auth (refresh token) |
| Upload de arquivo grava blob no IndexedDB | upload vai para Supabase Storage; `documents.blob_ref` vira `documents.url` |

Nenhuma página, formulário ou componente visual precisa mudar — apenas a fábrica de repositórios e
o módulo de autenticação.
