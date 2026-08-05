-- Acompanha Escola — schema inicial para Supabase/Postgres (Fase 6)
-- Espelha 1:1 as entidades de src/domain/*.ts e docs/data-model.md.
-- Aplique com `supabase db push` (Supabase CLI) ou via mcp__Supabase__apply_migration.

create extension if not exists "pgcrypto";

create type record_status as enum ('active', 'archived', 'deleted');
create type system_role as enum ('owner', 'admin', 'teacher', 'guardian', 'student');
create type education_stage as enum ('early_childhood', 'elementary');
create type shift_type as enum ('morning', 'afternoon', 'full_time', 'evening');

-- ── Estrutura organizacional ────────────────────────────────────────────────

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  document text,
  cloud_storage_enabled boolean not null default true,
  retention_policy_days integer,
  logo_url text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  delete_reason text,
  is_demo boolean not null default false
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
  version integer not null default 1,
  deleted_at timestamptz, deleted_by uuid references auth.users(id), delete_reason text,
  is_demo boolean not null default false
);
create index on schools (organization_id);

create table school_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  school_id uuid not null references schools(id),
  name text not null,
  address jsonb,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on school_units (school_id);

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  school_id uuid not null references schools(id),
  year integer not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on academic_years (school_id);

create table classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  school_id uuid not null references schools(id),
  school_unit_id uuid references school_units(id),
  academic_year_id uuid not null references academic_years(id),
  name text not null,
  stage education_stage not null,
  grade text not null,
  shift shift_type not null,
  homeroom_teacher_id uuid references auth.users(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on classes (school_id);
create index on classes (academic_year_id);

create table students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  full_name text not null,
  social_name text,
  birth_date date not null,
  photo_url text,
  school_id uuid not null references schools(id),
  class_id uuid references classes(id),
  grade text,
  shift shift_type,
  academic_year_id uuid references academic_years(id),
  enrollment_date date,
  matriculation_status text not null default 'active',
  internal_code text,
  accessibility jsonb,
  authorized_notes text,
  contacts jsonb,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  deleted_at timestamptz, deleted_by uuid references auth.users(id), delete_reason text,
  is_demo boolean not null default false
);
create index on students (school_id);
create index on students (class_id);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  full_name text not null,
  document text,
  email text,
  phone text,
  relationship text not null,
  address text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  unique (student_id, guardian_id)
);
create index on student_guardians (student_id);
create index on student_guardians (guardian_id);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid not null references students(id),
  school_id uuid not null references schools(id),
  school_unit_id uuid references school_units(id),
  class_id uuid not null references classes(id),
  academic_year_id uuid not null references academic_years(id),
  enrollment_date date not null,
  enrollment_status text not null default 'active',
  internal_code text,
  end_date date,
  reason text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
create index on enrollments (student_id);

-- ── Usuários e permissões ────────────────────────────────────────────────────
-- `users` estende auth.users (Supabase Auth) em vez de guardar senha própria.

create table users (
  id uuid primary key references auth.users(id),
  organization_id uuid not null references organizations(id),
  full_name text not null,
  email text not null,
  role system_role not null,
  is_demo boolean not null default false,
  is_blocked boolean not null default false,
  guardian_id uuid references guardians(id),
  student_id uuid references students(id),
  teacher_title text,
  last_login_at timestamptz,
  failed_login_attempts integer not null default 0,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create index on users (organization_id);
create index on users (email);

create table teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  teacher_user_id uuid not null references auth.users(id),
  class_id uuid not null references classes(id),
  school_id uuid not null references schools(id),
  subject text,
  is_homeroom boolean not null default false,
  academic_year_id uuid not null references academic_years(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
create index on teacher_assignments (teacher_user_id);
create index on teacher_assignments (class_id);

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
  reason text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create index on user_permissions (user_id);

-- ── Avaliação (Educação Infantil e Ensino Fundamental) ──────────────────────

create table assessment_scales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  school_id uuid not null references schools(id),
  stage education_stage not null,
  name text not null,
  type text not null,
  levels jsonb not null default '[]',
  min_value numeric,
  max_value numeric,
  is_default boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
create index on assessment_scales (school_id);

create table assessment_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  school_id uuid not null references schools(id),
  stage education_stage not null,
  kind text not null,
  bncc_field text,
  name text not null,
  description text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
create index on assessment_categories (school_id);

create table activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  school_id uuid not null references schools(id),
  class_id uuid not null references classes(id),
  academic_year_id uuid not null references academic_years(id),
  stage education_stage not null,
  title text not null,
  description text,
  category_id uuid references assessment_categories(id),
  subject text,
  type text not null,
  date date not null,
  period text not null,
  created_by_teacher_id uuid not null references auth.users(id),
  weight numeric,
  max_score numeric,
  min_score numeric,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on activities (class_id);
create index on activities (period);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  activity_id uuid not null references activities(id),
  student_id uuid not null references students(id),
  stage education_stage not null,
  rbo_level text,
  scale_id uuid references assessment_scales(id),
  scale_level_code text,
  numeric_score numeric,
  comments text,
  publication_status text not null default 'draft',
  published_at timestamptz,
  approved_by uuid references auth.users(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on assessments (student_id);
create index on assessments (activity_id);

create table grades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid not null references students(id),
  class_id uuid not null references classes(id),
  subject text not null,
  period text not null,
  scale_id uuid not null references assessment_scales(id),
  scale_level_code text,
  numeric_score numeric,
  is_recovery boolean not null default false,
  teacher_comments text,
  publication_status text not null default 'draft',
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on grades (student_id);
create index on grades (class_id, subject, period);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid not null references students(id),
  class_id uuid not null references classes(id),
  date date not null,
  attendance_status text not null,
  justification text,
  registered_by uuid not null references auth.users(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on attendance (student_id, date);
create index on attendance (class_id, date);

-- ── Observações ──────────────────────────────────────────────────────────────

create table teacher_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid not null references students(id),
  teacher_id uuid not null references auth.users(id),
  class_id uuid not null references classes(id),
  date date not null,
  category_id uuid references assessment_categories(id),
  text text not null,
  visible_to_guardians boolean not null default false,
  publication_status text not null default 'draft',
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on teacher_observations (student_id);

create table parent_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid not null references students(id),
  guardian_id uuid not null references guardians(id),
  date date not null,
  text text not null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
create index on parent_observations (student_id);

-- ── Alertas ──────────────────────────────────────────────────────────────────

create table alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  school_id uuid references schools(id),
  name text not null,
  stage text not null,
  min_activities_required integer not null default 4,
  min_periods_for_pattern integer not null default 2,
  r_level_percent_threshold numeric not null default 50,
  active boolean not null default true,
  description text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid not null references students(id),
  rule_id uuid references alert_rules(id),
  level text not null,
  reason text not null,
  period_start date not null,
  period_end date not null,
  records_used integer not null default 0,
  confidence text not null default 'baixa',
  recommendations text[] not null default '{}',
  analyzed_by uuid references auth.users(id),
  alert_status text not null default 'active',
  contest_note text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on alerts (student_id);

create table alert_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  alert_id uuid not null references alerts(id),
  acknowledged_by uuid not null references auth.users(id),
  acknowledged_at timestamptz not null default now(),
  note text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table teacher_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid not null references students(id),
  teacher_id uuid not null references auth.users(id),
  date date not null,
  category text not null,
  title text not null,
  description text not null,
  priority text not null default 'media',
  suggested_action text,
  due_date date,
  attachment_ids uuid[] default '{}',
  visible_to_guardian_ids uuid[] not null default '{}',
  teacher_alert_status text not null default 'draft',
  read_at timestamptz,
  read_by uuid references auth.users(id),
  guardian_response text,
  guardian_responded_at timestamptz,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
create index on teacher_alerts (student_id);

-- ── Eventos escolares ────────────────────────────────────────────────────────

create table school_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  description text,
  school_id uuid not null references schools(id),
  class_id uuid references classes(id),
  student_ids uuid[],
  audience text not null default 'school',
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  address text,
  responsible_user_id uuid not null references auth.users(id),
  type text not null,
  requires_authorization boolean not null default false,
  transport_provided boolean not null default false,
  cost numeric,
  required_items text[],
  guardian_attendance text not null default 'optional',
  requires_confirmation boolean not null default false,
  participant_limit integer,
  attachment_ids uuid[],
  notes text,
  event_status text not null default 'draft',
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on school_events (school_id);
create index on school_events (class_id);

create table event_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  event_id uuid not null references school_events(id),
  student_id uuid not null references students(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table event_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  event_id uuid not null references school_events(id),
  guardian_id uuid not null references guardians(id),
  student_id uuid not null references students(id),
  response text not null default 'pending',
  responded_at timestamptz,
  note text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
create index on event_confirmations (event_id);

-- ── Portfólio e documentos ───────────────────────────────────────────────────

create table portfolios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid not null references students(id),
  date date not null,
  category text not null,
  description text,
  bncc_field text,
  subject text,
  teacher_id uuid references auth.users(id),
  file_ids uuid[] not null default '{}',
  teacher_comment text,
  guardian_comment text,
  visibility text not null default 'family_only',
  image_authorization boolean not null default false,
  tags text[] not null default '{}',
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on portfolios (student_id);

create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid references students(id),
  school_id uuid not null references schools(id),
  class_id uuid references classes(id),
  category text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  hash text not null,
  tags text[] not null default '{}',
  version_of uuid references documents(id),
  storage_location text not null default 'cloud',
  blob_ref text,
  url text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);
create index on documents (student_id);
create index on documents (school_id);
create index on documents (hash);

-- ── Importação e sincronização ───────────────────────────────────────────────

create table imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  document_type text not null,
  file_format text not null,
  file_name text not null,
  file_size_bytes bigint not null,
  file_hash text not null,
  school_id uuid references schools(id),
  class_id uuid references classes(id),
  student_id uuid references students(id),
  periodicity text not null,
  period_label text not null,
  storage_destination text not null default 'local',
  import_status text not null default 'draft',
  total_rows_found integer not null default 0,
  total_imported integer not null default 0,
  total_rejected integer not null default 0,
  total_duplicates integer not null default 0,
  column_mapping jsonb,
  errors text[],
  sync_status text,
  operation_ref text not null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
create index on imports (organization_id, created_at desc);

create table import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  import_id uuid not null references imports(id),
  row_index integer not null,
  raw_value jsonb not null,
  interpreted_value jsonb not null,
  confidence numeric,
  target_field text,
  validation text not null,
  validation_notes text,
  resolution text,
  linked_student_id uuid references students(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create index on import_rows (import_id);

create table storage_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_type text not null,
  entity_id uuid not null,
  destination text not null,
  synced_at timestamptz,
  sync_status text not null default 'not_applicable',
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table sync_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_type text not null,
  entity_id uuid not null,
  operation text not null,
  payload jsonb not null default '{}',
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  sync_status text not null default 'pending',
  conflict_local_version jsonb,
  conflict_remote_version jsonb,
  error_message text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
create index on sync_queue (organization_id, sync_status);

-- ── Auditoria (append-only) ──────────────────────────────────────────────────

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
  result text not null default 'success',
  created_at timestamptz not null default now()
);
create index on audit_logs (organization_id, created_at desc);
create index on audit_logs (user_id);

-- ── Consentimento, recomendações, notificações, retenção ────────────────────

create table consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  guardian_id uuid not null references guardians(id),
  student_id uuid not null references students(id),
  type text not null,
  description text not null,
  granted boolean not null default false,
  granted_at timestamptz,
  revoked_at timestamptz,
  document_id uuid references documents(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create index on consents (student_id);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  content text not null,
  age_range text not null,
  bncc_field text,
  subject text,
  category text,
  environment text not null default 'both',
  source text not null,
  source_validated boolean not null default false,
  reviewed_at timestamptz,
  approved_by uuid references auth.users(id),
  published boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1,
  is_demo boolean not null default false
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  type text not null,
  title text not null,
  body text not null,
  link_to text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read);

create table data_retention_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_type text not null,
  retention_days integer not null,
  action text not null,
  description text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version integer not null default 1
);
