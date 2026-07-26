begin;

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  request_type text not null
    check (request_type in ('export', 'delete', 'correct')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'rejected')),
  details text not null default '' check (char_length(details) <= 3000),
  resolution_note text not null default ''
    check (char_length(resolution_note) <= 3000),
  resolved_by uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  job_type text not null check (
    job_type in (
      'privacy_export',
      'privacy_delete',
      'integration_delivery',
      'notification_digest',
      'retention_cleanup'
    )
  ),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text not null default '' check (char_length(last_error) <= 3000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists privacy_requests_workspace_idx
  on public.privacy_requests (workspace_id, status, created_at desc);
create index if not exists background_jobs_queue_idx
  on public.background_jobs (status, run_after, created_at);

alter table public.privacy_requests enable row level security;
alter table public.background_jobs enable row level security;

create or replace function public.enqueue_execution_integration_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_integration public.workspace_integrations%rowtype;
  event_id uuid;
begin
  for target_integration in
    select *
    from public.workspace_integrations
    where workspace_id = new.workspace_id
      and enabled
  loop
    insert into public.integration_events (
      workspace_id,
      integration_id,
      event_type,
      payload
    ) values (
      new.workspace_id,
      target_integration.id,
      'execution.step.' || new.to_status,
      jsonb_build_object(
        'execution_run_id', new.execution_run_id,
        'execution_step_id', new.execution_step_id,
        'to_status', new.to_status,
        'created_at', new.created_at
      )
    )
    returning id into event_id;

    insert into public.background_jobs (
      workspace_id,
      job_type,
      payload,
      created_by
    ) values (
      new.workspace_id,
      'integration_delivery',
      jsonb_build_object('integration_event_id', event_id),
      new.actor_id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists execution_step_enqueue_integrations
  on public.execution_step_events;
create trigger execution_step_enqueue_integrations
after insert on public.execution_step_events
for each row execute function public.enqueue_execution_integration_events();

create or replace function public.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  preference public.notification_preferences%rowtype;
  next_run timestamptz;
begin
  select *
  into preference
  from public.notification_preferences
  where workspace_id = new.workspace_id
    and user_id = new.user_id;

  if preference.user_id is null
    or not preference.email
    or preference.digest_frequency = 'never'
  then
    return new;
  end if;

  next_run := case preference.digest_frequency
    when 'weekly' then date_trunc('week', now()) + interval '1 week'
    else date_trunc('day', now()) + interval '1 day'
  end;

  insert into public.background_jobs (
    workspace_id,
    job_type,
    payload,
    run_after,
    created_by
  ) values (
    new.workspace_id,
    'notification_digest',
    jsonb_build_object(
      'notification_id', new.id,
      'user_id', new.user_id,
      'frequency', preference.digest_frequency
    ),
    next_run,
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists notification_enqueue_email
  on public.notifications;
create trigger notification_enqueue_email
after insert on public.notifications
for each row execute function public.enqueue_notification_email();

drop policy if exists privacy_requests_select_scoped
  on public.privacy_requests;
create policy privacy_requests_select_scoped
on public.privacy_requests
for select to authenticated
using (
  requested_by = auth.uid()
  or public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

drop policy if exists background_jobs_select_manager
  on public.background_jobs;
create policy background_jobs_select_manager
on public.background_jobs
for select to authenticated
using (
  workspace_id is not null
  and public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

create or replace function public.create_privacy_request(
  p_workspace_id uuid,
  p_request_type text,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_id uuid;
begin
  if current_user_id is null
    or not public.is_workspace_member(p_workspace_id)
  then
    raise exception 'Privacy request access denied';
  end if;
  if p_request_type not in ('export', 'delete', 'correct') then
    raise exception 'Privacy request type is invalid';
  end if;

  insert into public.privacy_requests (
    workspace_id,
    requested_by,
    request_type,
    details
  ) values (
    p_workspace_id,
    current_user_id,
    p_request_type,
    left(btrim(coalesce(p_details, '')), 3000)
  )
  returning id into request_id;

  if p_request_type in ('export', 'delete') then
    insert into public.background_jobs (
      workspace_id,
      job_type,
      payload,
      created_by
    ) values (
      p_workspace_id,
      case
        when p_request_type = 'export' then 'privacy_export'
        else 'privacy_delete'
      end,
      jsonb_build_object(
        'privacy_request_id', request_id,
        'requested_by', current_user_id
      ),
      current_user_id
    );
  end if;

  insert into public.audit_events (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_workspace_id,
    current_user_id,
    'privacy.requested',
    'privacy_request',
    request_id,
    jsonb_build_object('request_type', p_request_type)
  );
  return request_id;
end;
$$;

create or replace function public.resolve_privacy_request(
  p_request_id uuid,
  p_status text,
  p_resolution_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_request public.privacy_requests%rowtype;
begin
  select * into target_request
  from public.privacy_requests
  where id = p_request_id;

  if target_request.id is null
    or current_user_id is null
    or not public.has_workspace_role(
      target_request.workspace_id,
      array['owner', 'admin']::public.workspace_role[]
    )
  then
    raise exception 'Privacy resolution access denied';
  end if;
  if p_status not in ('processing', 'completed', 'rejected') then
    raise exception 'Privacy resolution status is invalid';
  end if;

  update public.privacy_requests
  set
    status = p_status,
    resolution_note = left(btrim(coalesce(p_resolution_note, '')), 3000),
    resolved_by = case
      when p_status in ('completed', 'rejected') then current_user_id
      else resolved_by
    end,
    resolved_at = case
      when p_status in ('completed', 'rejected') then now()
      else resolved_at
    end,
    updated_at = now()
  where id = p_request_id;

  insert into public.audit_events (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_request.workspace_id,
    current_user_id,
    'privacy.' || p_status,
    'privacy_request',
    p_request_id,
    jsonb_build_object('request_type', target_request.request_type)
  );
end;
$$;

create or replace function public.claim_background_jobs(
  p_limit integer default 10
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.background_jobs
  set
    status = 'queued',
    locked_at = null,
    run_after = now(),
    last_error = left(
      concat_ws(' · ', nullif(last_error, ''), 'Bloqueo vencido recuperado'),
      3000
    ),
    updated_at = now()
  where status = 'processing'
    and locked_at < now() - interval '15 minutes';

  return query
  update public.background_jobs
  set
    status = 'processing',
    locked_at = now(),
    attempt_count = attempt_count + 1,
    updated_at = now()
  where id in (
    select queued.id
    from public.background_jobs as queued
    where queued.status = 'queued'
      and queued.run_after <= now()
    order by queued.created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 50)
  )
  returning *;
end;
$$;

create or replace function public.finish_background_job(
  p_job_id uuid,
  p_status text,
  p_result jsonb default '{}'::jsonb,
  p_error text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'Job status is invalid';
  end if;

  update public.background_jobs
  set
    status = case
      when p_status = 'failed' and attempt_count < 5 then 'queued'
      else p_status
    end,
    result = coalesce(p_result, '{}'::jsonb),
    last_error = left(coalesce(p_error, ''), 3000),
    run_after = case
      when p_status = 'failed' and attempt_count < 5
      then now() + make_interval(mins => power(2, attempt_count)::integer)
      else run_after
    end,
    locked_at = case
      when p_status = 'failed' and attempt_count < 5 then null
      else locked_at
    end,
    completed_at = case
      when p_status = 'failed' and attempt_count < 5 then null
      else now()
    end,
    updated_at = now()
  where id = p_job_id
    and status = 'processing';
end;
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0013'
  );
$$;

revoke all on table public.privacy_requests
  from public, anon, authenticated;
revoke all on table public.background_jobs
  from public, anon, authenticated;
grant select on table public.privacy_requests to authenticated;
grant select on table public.background_jobs to authenticated;
revoke all on function public.create_privacy_request(uuid, text, text)
  from public;
revoke all on function public.resolve_privacy_request(uuid, text, text)
  from public;
revoke all on function public.claim_background_jobs(integer) from public;
revoke all on function public.finish_background_job(uuid, text, jsonb, text)
  from public;
grant execute on function public.create_privacy_request(uuid, text, text)
  to authenticated;
grant execute on function public.resolve_privacy_request(uuid, text, text)
  to authenticated;
grant execute on function public.claim_background_jobs(integer)
  to service_role;
grant execute on function public.finish_background_job(
  uuid,
  text,
  jsonb,
  text
) to service_role;

comment on table public.privacy_requests is
  'Solicitudes trazables de exportación, corrección o eliminación por workspace.';
comment on table public.background_jobs is
  'Cola asíncrona reclamable con SKIP LOCKED y ejecutable solo con service role.';

commit;
notify pgrst, 'reload schema';
