-- Acompanha+ — Row Level Security (Fase 6)
-- Padrão: nada é visível por padrão; cada policy soma uma condição de acesso.
-- Aplique depois de 0001_init_schema.sql.

-- ── Funções auxiliares (security definer, usadas dentro das policies) ───────

create or replace function current_app_user()
returns users
language sql stable security definer
set search_path = public
as $$
  select * from users where id = auth.uid();
$$;

create or replace function is_owner_or_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from users where id = auth.uid() and role in ('owner', 'admin') and status = 'active');
$$;

create or replace function teaches_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from teacher_assignments
    where teacher_user_id = auth.uid() and class_id = p_class_id and status = 'active'
  );
$$;

create or replace function guardian_of_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from student_guardians sg
    join users u on u.guardian_id = sg.guardian_id
    where u.id = auth.uid() and sg.student_id = p_student_id and sg.status = 'active'
  );
$$;

create or replace function is_own_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from users where id = auth.uid() and student_id = p_student_id);
$$;

-- Sobreposição concedida pelo Owner (user_permissions), mais específica vence.
create or replace function has_granted_permission(p_module text, p_action text, p_school_id uuid, p_class_id uuid, p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from user_permissions up
    where up.user_id = auth.uid()
      and up.module = p_module
      and p_action = any(up.actions)
      and up.status = 'active'
      and (up.valid_until is null or up.valid_until > now())
      and (up.student_id is null or up.student_id = p_student_id)
      and (up.class_id is null or up.class_id = p_class_id)
      and (up.school_id is null or up.school_id = p_school_id)
  );
$$;

-- ── Organização, escolas, turmas: administração restrita a owner/admin ──────

alter table organizations enable row level security;
create policy organizations_select on organizations for select using (
  id = (select organization_id from users where id = auth.uid())
);
create policy organizations_write on organizations for all using (is_owner_or_admin()) with check (is_owner_or_admin());

alter table schools enable row level security;
create policy schools_select on schools for select using (
  organization_id = (select organization_id from users where id = auth.uid())
);
create policy schools_write on schools for all using (is_owner_or_admin()) with check (is_owner_or_admin());

alter table classes enable row level security;
create policy classes_select on classes for select using (
  organization_id = (select organization_id from users where id = auth.uid())
);
create policy classes_write on classes for all using (is_owner_or_admin()) with check (is_owner_or_admin());

alter table academic_years enable row level security;
create policy academic_years_select on academic_years for select using (
  organization_id = (select organization_id from users where id = auth.uid())
);
create policy academic_years_write on academic_years for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- ── Alunos: owner/admin da organização, professor da turma, responsável do aluno, o próprio aluno ──

alter table students enable row level security;

create policy students_select on students for select using (
  is_owner_or_admin()
  or teaches_class(class_id)
  or guardian_of_student(id)
  or is_own_student(id)
);

create policy students_insert on students for insert with check (
  is_owner_or_admin() or has_granted_permission('students', 'create', school_id, class_id, null)
);

create policy students_update on students for update using (
  is_owner_or_admin()
  or teaches_class(class_id)
  or guardian_of_student(id)
  or has_granted_permission('students', 'edit', school_id, class_id, id)
) with check (true);

-- Exclusão definitiva nunca é um DELETE direto do cliente (sem policy de delete);
-- use a RPC `hard_delete_record` (security definer), que audita e respeita permissão.

-- ── Responsáveis e vínculos ──────────────────────────────────────────────────

alter table guardians enable row level security;
create policy guardians_select on guardians for select using (
  is_owner_or_admin()
  or exists (select 1 from users u where u.id = auth.uid() and u.guardian_id = guardians.id)
  or exists (
    select 1 from student_guardians sg
    where sg.guardian_id = guardians.id and (teaches_class((select class_id from students where id = sg.student_id)) )
  )
);
create policy guardians_write on guardians for all using (is_owner_or_admin()) with check (is_owner_or_admin());

alter table student_guardians enable row level security;
create policy student_guardians_select on student_guardians for select using (
  is_owner_or_admin() or guardian_of_student(student_id) or is_own_student(student_id) or teaches_class((select class_id from students where id = student_id))
);
create policy student_guardians_write on student_guardians for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- ── Avaliações, notas, frequência, observações: mesmo padrão de 4 níveis ────

alter table assessments enable row level security;
create policy assessments_select on assessments for select using (
  is_owner_or_admin() or teaches_class((select class_id from activities where id = activity_id)) or guardian_of_student(student_id) or is_own_student(student_id)
);
create policy assessments_write on assessments for all using (
  is_owner_or_admin() or teaches_class((select class_id from activities where id = activity_id))
) with check (true);

alter table grades enable row level security;
create policy grades_select on grades for select using (
  is_owner_or_admin() or teaches_class(class_id) or guardian_of_student(student_id) or is_own_student(student_id)
);
create policy grades_write on grades for all using (
  is_owner_or_admin() or teaches_class(class_id)
) with check (true);

alter table attendance enable row level security;
create policy attendance_select on attendance for select using (
  is_owner_or_admin() or teaches_class(class_id) or guardian_of_student(student_id) or is_own_student(student_id)
);
create policy attendance_write on attendance for all using (
  is_owner_or_admin() or teaches_class(class_id)
) with check (true);

alter table teacher_observations enable row level security;
create policy teacher_observations_select on teacher_observations for select using (
  is_owner_or_admin()
  or teacher_id = auth.uid()
  or (visible_to_guardians and (guardian_of_student(student_id) or is_own_student(student_id)) and publication_status = 'published')
);
create policy teacher_observations_write on teacher_observations for all using (
  is_owner_or_admin() or teacher_id = auth.uid() or teaches_class(class_id)
) with check (true);

alter table parent_observations enable row level security;
create policy parent_observations_select on parent_observations for select using (
  is_owner_or_admin() or guardian_of_student(student_id) or teaches_class((select class_id from students where id = student_id))
);
create policy parent_observations_write on parent_observations for insert with check (
  guardian_of_student(student_id)
);

-- ── Alertas ──────────────────────────────────────────────────────────────────

alter table alerts enable row level security;
create policy alerts_select on alerts for select using (
  is_owner_or_admin() or teaches_class((select class_id from students where id = student_id)) or guardian_of_student(student_id)
);
create policy alerts_write on alerts for all using (
  is_owner_or_admin() or teaches_class((select class_id from students where id = student_id))
) with check (true);

alter table teacher_alerts enable row level security;
create policy teacher_alerts_select on teacher_alerts for select using (
  is_owner_or_admin()
  or teacher_id = auth.uid()
  or (guardian_of_student(student_id) and teacher_alert_status <> 'draft')
);
create policy teacher_alerts_write on teacher_alerts for all using (
  is_owner_or_admin() or teacher_id = auth.uid()
) with check (true);

-- ── Portfólio e documentos ───────────────────────────────────────────────────

alter table portfolios enable row level security;
create policy portfolios_select on portfolios for select using (
  is_owner_or_admin() or teaches_class((select class_id from students where id = student_id)) or guardian_of_student(student_id) or is_own_student(student_id)
);
create policy portfolios_write on portfolios for all using (
  is_owner_or_admin() or teaches_class((select class_id from students where id = student_id)) or guardian_of_student(student_id)
) with check (true);

alter table documents enable row level security;
create policy documents_select on documents for select using (
  is_owner_or_admin()
  or (student_id is not null and (teaches_class((select class_id from students where id = student_id)) or guardian_of_student(student_id) or is_own_student(student_id)))
);
create policy documents_write on documents for all using (
  is_owner_or_admin() or (student_id is not null and (teaches_class((select class_id from students where id = student_id)) or guardian_of_student(student_id)))
) with check (true);

-- ── Eventos escolares ────────────────────────────────────────────────────────

alter table school_events enable row level security;
create policy school_events_select on school_events for select using (
  organization_id = (select organization_id from users where id = auth.uid())
);
create policy school_events_write on school_events for all using (
  is_owner_or_admin() or (class_id is not null and teaches_class(class_id))
) with check (true);

alter table event_confirmations enable row level security;
create policy event_confirmations_select on event_confirmations for select using (
  is_owner_or_admin() or guardian_of_student(student_id) or exists (
    select 1 from school_events se where se.id = event_id and teaches_class(se.class_id)
  )
);
create policy event_confirmations_write on event_confirmations for insert with check (guardian_of_student(student_id));
create policy event_confirmations_update on event_confirmations for update using (guardian_of_student(student_id)) with check (true);

-- ── Permissões, auditoria, importação, sincronização, retenção: só owner/admin ──

alter table user_permissions enable row level security;
create policy user_permissions_select on user_permissions for select using (
  is_owner_or_admin() or user_id = auth.uid()
);
create policy user_permissions_write on user_permissions for all using (is_owner_or_admin()) with check (is_owner_or_admin());

alter table audit_logs enable row level security;
create policy audit_logs_select on audit_logs for select using (
  is_owner_or_admin() and organization_id = (select organization_id from users where id = auth.uid())
);
-- Sem policy de update/delete: audit_logs nunca é editável por usuários comuns (seção 23).
-- Inserção só via função security definer chamada pelo backend (ver seção "Auditoria" da migração 0003).

alter table imports enable row level security;
create policy imports_select on imports for select using (
  organization_id = (select organization_id from users where id = auth.uid())
);
create policy imports_write on imports for all using (
  is_owner_or_admin() or has_granted_permission('imports', 'import', school_id, class_id, student_id)
) with check (true);

alter table import_rows enable row level security;
create policy import_rows_select on import_rows for select using (
  organization_id = (select organization_id from users where id = auth.uid())
);
create policy import_rows_write on import_rows for all using (
  is_owner_or_admin() or has_granted_permission('imports', 'import', null, null, null)
) with check (true);

alter table sync_queue enable row level security;
create policy sync_queue_all on sync_queue for all using (is_owner_or_admin()) with check (is_owner_or_admin());

alter table data_retention_rules enable row level security;
create policy data_retention_rules_all on data_retention_rules for all using (is_owner_or_admin()) with check (is_owner_or_admin());

alter table alert_rules enable row level security;
create policy alert_rules_select on alert_rules for select using (
  organization_id = (select organization_id from users where id = auth.uid())
);
create policy alert_rules_write on alert_rules for all using (is_owner_or_admin()) with check (is_owner_or_admin());

alter table recommendations enable row level security;
create policy recommendations_select on recommendations for select using (
  published or is_owner_or_admin()
);
create policy recommendations_write on recommendations for all using (is_owner_or_admin()) with check (true);

alter table notifications enable row level security;
create policy notifications_own on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table consents enable row level security;
create policy consents_select on consents for select using (
  is_owner_or_admin() or guardian_of_student(student_id) or teaches_class((select class_id from students where id = student_id))
);
create policy consents_write on consents for all using (
  is_owner_or_admin() or guardian_of_student(student_id)
) with check (true);
