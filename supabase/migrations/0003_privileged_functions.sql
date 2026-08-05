-- Acompanha+ — funções privilegiadas (security definer) para operações que
-- nunca devem ser feitas por um DELETE/INSERT direto do cliente (Fase 6).
-- Chamadas pelo frontend via `supabase.rpc(...)`, nunca com a service role key
-- (que fica restrita a Edge Functions/servidor, se algum dia for necessária).

-- Exclusão definitiva: só quem tem a ação 'delete' concedida (owner, ou admin com
-- concessão explícita — ver seção 5 do briefing) pode chamar; sempre grava em
-- audit_logs antes de apagar, e a política de retenção não impede a exclusão
-- solicitada explicitamente por um usuário autorizado (ex.: pedido legal).
create or replace function hard_delete_record(p_table text, p_id uuid, p_reason text, p_actor uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text;
  v_org uuid;
  v_allowed_tables text[] := array[
    'students', 'guardians', 'attendance', 'assessments', 'grades', 'documents',
    'portfolios', 'teacher_observations', 'alerts', 'school_events'
  ];
begin
  if p_table <> any(v_allowed_tables) then
    raise exception 'Exclusão definitiva não permitida para a tabela %', p_table;
  end if;

  select role, organization_id into v_role, v_org from users where id = p_actor;

  if v_role <> 'owner' and not has_granted_permission(p_table, 'delete', null, null, p_id) then
    raise exception 'Usuário % não tem permissão de exclusão definitiva para %', p_actor, p_table;
  end if;

  insert into audit_logs (organization_id, user_id, role, action, module, entity_id, reason, result)
  values (v_org, p_actor, v_role, 'soft_delete', p_table, p_id, p_reason, 'success');

  execute format('delete from %I where id = $1', p_table) using p_id;
end;
$$;

-- Toda gravação em audit_logs feita pelo frontend passa por aqui em vez de um INSERT
-- direto — mantém o log append-only mesmo que uma policy de insert mal configurada
-- um dia permita mais do que deveria.
create or replace function record_audit_log(
  p_action text, p_module text, p_entity_id uuid, p_reason text,
  p_previous_value jsonb, p_new_value jsonb, p_result text default 'success'
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_role text;
  v_org uuid;
begin
  select role, organization_id into v_role, v_org from users where id = auth.uid();
  insert into audit_logs (organization_id, user_id, role, action, module, entity_id, reason, previous_value, new_value, result)
  values (v_org, auth.uid(), v_role, p_action, p_module, p_entity_id, p_reason, p_previous_value, p_new_value, p_result)
  returning id into v_id;
  return v_id;
end;
$$;

-- Job de retenção: pode ser agendado via Supabase Cron/Edge Function. Hoje só implementa
-- a ação 'archive' (a mais segura); regras com action='delete' são puladas e registradas
-- como pendentes — exclusão em massa automática é grave demais para entrar sem um caso de
-- uso real testado, então fica explicitamente para uma etapa futura em vez de fingir suporte.
create or replace function apply_retention_policies()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_rule record;
  v_affected integer := 0;
  v_count integer;
begin
  for v_rule in select * from data_retention_rules where status = 'active' loop
    if v_rule.action = 'archive' then
      execute format(
        'update %I set status = ''archived'', updated_at = now() where status = ''active'' and created_at < now() - make_interval(days => $1)',
        v_rule.entity_type
      ) using v_rule.retention_days;
      get diagnostics v_count = row_count;
      v_affected := v_affected + v_count;

      insert into audit_logs (organization_id, user_id, role, action, module, reason, result)
      values (v_rule.organization_id, v_rule.updated_by, 'owner', 'edit', 'data_retention_rules', format('Política aplicada a %s (%s registros arquivados)', v_rule.entity_type, v_count), 'success');
    else
      insert into audit_logs (organization_id, user_id, role, action, module, reason, result)
      values (v_rule.organization_id, v_rule.updated_by, 'owner', 'edit', 'data_retention_rules', format('Regra de exclusão para %s não aplicada automaticamente — requer execução manual revisada', v_rule.entity_type), 'failure');
    end if;
  end loop;
  return v_affected;
end;
$$;
