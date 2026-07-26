begin;

alter table public.execution_steps
  add column if not exists dependencies_snapshot text[] not null default '{}',
  add column if not exists risks_snapshot text[] not null default '{}';

update public.execution_steps as execution_step
set
  dependencies_snapshot = guide_step.dependencies,
  risks_snapshot = guide_step.risks
from public.planning_guide_steps as guide_step
where guide_step.id = execution_step.planning_guide_step_id
  and execution_step.dependencies_snapshot = '{}'
  and execution_step.risks_snapshot = '{}';

create or replace function public.copy_execution_step_boundaries()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_step public.planning_guide_steps%rowtype;
begin
  select *
  into source_step
  from public.planning_guide_steps
  where id = new.planning_guide_step_id;

  if source_step.id is not null then
    new.dependencies_snapshot := source_step.dependencies;
    new.risks_snapshot := source_step.risks;
  end if;
  return new;
end;
$$;

drop trigger if exists execution_steps_copy_boundaries
  on public.execution_steps;
create trigger execution_steps_copy_boundaries
before insert on public.execution_steps
for each row execute function public.copy_execution_step_boundaries();

create table if not exists public.notification_preferences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  in_app boolean not null default true,
  email boolean not null default false,
  blocked_steps boolean not null default true,
  assignments boolean not null default true,
  invitations boolean not null default true,
  council_results boolean not null default true,
  digest_frequency text not null default 'daily'
    check (digest_frequency in ('never', 'daily', 'weekly')),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in (
      'execution_blocked',
      'assignment',
      'invitation',
      'council_completed',
      'job_completed',
      'system'
    )
  ),
  title text not null check (char_length(title) between 1 and 180),
  body text not null default '' check (char_length(body) <= 1000),
  href text not null default '' check (char_length(href) <= 500),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_inbox_idx
  on public.notifications (workspace_id, user_id, read_at, created_at desc);

create table if not exists public.workspace_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null
    check (provider in ('webhook', 'slack', 'github', 'linear', 'jira')),
  display_name text not null check (char_length(display_name) between 2 and 120),
  endpoint text not null default '' check (char_length(endpoint) <= 1000),
  enabled boolean not null default false,
  secret_configured boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  integration_id uuid not null
    references public.workspace_integrations(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 2 and 120),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'delivered', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  last_error text not null default '' check (char_length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists integration_events_queue_idx
  on public.integration_events (status, created_at);

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.workspace_integrations enable row level security;
alter table public.integration_events enable row level security;

drop policy if exists notification_preferences_select_own
  on public.notification_preferences;
create policy notification_preferences_select_own
on public.notification_preferences
for select to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
);

drop policy if exists workspace_integrations_select_member
  on public.workspace_integrations;
create policy workspace_integrations_select_member
on public.workspace_integrations
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists integration_events_select_manager
  on public.integration_events;
create policy integration_events_select_manager
on public.integration_events
for select to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

create or replace function public.save_notification_preferences(
  p_workspace_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  next_digest text := coalesce(p_payload ->> 'digestFrequency', 'daily');
begin
  if current_user_id is null
    or not public.is_workspace_member(p_workspace_id)
  then
    raise exception 'Notification access denied';
  end if;
  if next_digest not in ('never', 'daily', 'weekly') then
    raise exception 'Digest frequency is invalid';
  end if;

  insert into public.notification_preferences (
    workspace_id,
    user_id,
    in_app,
    email,
    blocked_steps,
    assignments,
    invitations,
    council_results,
    digest_frequency
  ) values (
    p_workspace_id,
    current_user_id,
    coalesce((p_payload ->> 'inApp')::boolean, true),
    coalesce((p_payload ->> 'email')::boolean, false),
    coalesce((p_payload ->> 'blockedSteps')::boolean, true),
    coalesce((p_payload ->> 'assignments')::boolean, true),
    coalesce((p_payload ->> 'invitations')::boolean, true),
    coalesce((p_payload ->> 'councilResults')::boolean, true),
    next_digest
  )
  on conflict (workspace_id, user_id) do update set
    in_app = excluded.in_app,
    email = excluded.email,
    blocked_steps = excluded.blocked_steps,
    assignments = excluded.assignments,
    invitations = excluded.invitations,
    council_results = excluded.council_results,
    digest_frequency = excluded.digest_frequency,
    updated_at = now();
end;
$$;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.save_workspace_integration(
  p_workspace_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  next_provider text := p_payload ->> 'provider';
  integration_id uuid;
begin
  if current_user_id is null
    or not public.has_workspace_role(
      p_workspace_id,
      array['owner', 'admin']::public.workspace_role[]
    )
  then
    raise exception 'Integration access denied';
  end if;
  if next_provider not in ('webhook', 'slack', 'github', 'linear', 'jira') then
    raise exception 'Integration provider is invalid';
  end if;

  insert into public.workspace_integrations (
    workspace_id,
    provider,
    display_name,
    endpoint,
    enabled,
    secret_configured,
    settings,
    created_by
  ) values (
    p_workspace_id,
    next_provider,
    left(
      btrim(coalesce(p_payload ->> 'displayName', initcap(next_provider))),
      120
    ),
    case
      when next_provider in ('webhook', 'slack') then ''
      else left(btrim(coalesce(p_payload ->> 'endpoint', '')), 1000)
    end,
    coalesce((p_payload ->> 'enabled')::boolean, false),
    coalesce((p_payload ->> 'secretConfigured')::boolean, false),
    coalesce(p_payload -> 'settings', '{}'::jsonb),
    current_user_id
  )
  on conflict (workspace_id, provider) do update set
    display_name = excluded.display_name,
    endpoint = excluded.endpoint,
    enabled = excluded.enabled,
    secret_configured = excluded.secret_configured,
    settings = excluded.settings,
    updated_at = now()
  returning id into integration_id;

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
    'integration.configured',
    'workspace_integration',
    integration_id,
    jsonb_build_object(
      'provider', next_provider,
      'enabled', coalesce((p_payload ->> 'enabled')::boolean, false),
      'secret_configured',
        coalesce((p_payload ->> 'secretConfigured')::boolean, false)
    )
  );

  return integration_id;
end;
$$;

create or replace function public.notify_blocked_execution_step()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  step_record public.execution_steps%rowtype;
  recipient uuid;
begin
  if new.to_status <> 'blocked' then
    return new;
  end if;

  select *
  into step_record
  from public.execution_steps
  where id = new.execution_step_id;

  for recipient in
    select membership.user_id
    from public.workspace_members as membership
    left join public.notification_preferences as preference
      on preference.workspace_id = membership.workspace_id
      and preference.user_id = membership.user_id
    where membership.workspace_id = new.workspace_id
      and (
        membership.user_id = step_record.responsible_user_id
        or membership.role in ('owner', 'admin', 'planner')
      )
      and coalesce(preference.in_app, true)
      and coalesce(preference.blocked_steps, true)
  loop
    insert into public.notifications (
      workspace_id,
      user_id,
      kind,
      title,
      body,
      href,
      metadata
    ) values (
      new.workspace_id,
      recipient,
      'execution_blocked',
      'Paso bloqueado: ' || step_record.title_snapshot,
      left(new.blocker_note, 1000),
      '/app/board/' || (
        select run.ticket_id::text
        from public.execution_runs as run
        where run.id = new.execution_run_id
      ),
      jsonb_build_object(
        'execution_step_id', new.execution_step_id,
        'execution_run_id', new.execution_run_id
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists execution_step_blocked_notification
  on public.execution_step_events;
create trigger execution_step_blocked_notification
after insert on public.execution_step_events
for each row execute function public.notify_blocked_execution_step();

create or replace function public.notify_product_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  target_ticket_id uuid;
  target_title text;
begin
  if new.action = 'assignment.confirmed' then
    select plan.ticket_id, ticket.title
    into target_ticket_id, target_title
    from public.assignment_plans as plan
    join public.tickets as ticket on ticket.id = plan.ticket_id
    where plan.id = new.entity_id;

    for recipient in
      select participant.user_id
      from public.assignment_plan_participants as participant
      left join public.notification_preferences as preference
        on preference.workspace_id = participant.workspace_id
        and preference.user_id = participant.user_id
      where participant.assignment_plan_id = new.entity_id
        and coalesce(preference.in_app, true)
        and coalesce(preference.assignments, true)
    loop
      insert into public.notifications (
        workspace_id,
        user_id,
        kind,
        title,
        body,
        href,
        metadata
      ) values (
        new.workspace_id,
        recipient,
        'assignment',
        'Asignación confirmada',
        left(coalesce(target_title, 'Un ticket tiene una asignación nueva.'), 1000),
        '/app/planning/' || target_ticket_id::text || '/assignment',
        jsonb_build_object('assignment_plan_id', new.entity_id)
      );
    end loop;
  elsif new.action = 'council.completed' then
    select session.requested_by, session.title
    into recipient, target_title
    from public.council_sessions as session
    where session.id = new.entity_id;

    if recipient is not null
      and coalesce((
        select preference.in_app and preference.council_results
        from public.notification_preferences as preference
        where preference.workspace_id = new.workspace_id
          and preference.user_id = recipient
      ), true)
    then
      insert into public.notifications (
        workspace_id,
        user_id,
        kind,
        title,
        body,
        href,
        metadata
      ) values (
        new.workspace_id,
        recipient,
        'council_completed',
        'Consejo completado',
        left(coalesce(target_title, 'Las opiniones ya están disponibles.'), 1000),
        '/app/council?session=' || new.entity_id::text,
        jsonb_build_object('council_session_id', new.entity_id)
      );
    end if;
  elsif new.action = 'workspace.invite_created'
    and new.actor_id is not null
    and coalesce((
      select preference.in_app and preference.invitations
      from public.notification_preferences as preference
      where preference.workspace_id = new.workspace_id
        and preference.user_id = new.actor_id
    ), true)
  then
    insert into public.notifications (
      workspace_id,
      user_id,
      kind,
      title,
      body,
      href,
      metadata
    ) values (
      new.workspace_id,
      new.actor_id,
      'invitation',
      'Invitación preparada',
      left(coalesce(new.metadata ->> 'email', ''), 1000),
      '/app/team',
      jsonb_build_object('workspace_invite_id', new.entity_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_event_product_notification
  on public.audit_events;
create trigger audit_event_product_notification
after insert on public.audit_events
for each row execute function public.notify_product_event();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'execution_runs'
  ) then
    alter publication supabase_realtime add table public.execution_runs;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'execution_steps'
  ) then
    alter publication supabase_realtime add table public.execution_steps;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0012'
  );
$$;

revoke all on table public.notification_preferences
  from public, anon, authenticated;
revoke all on table public.notifications
  from public, anon, authenticated;
revoke all on table public.workspace_integrations
  from public, anon, authenticated;
revoke all on table public.integration_events
  from public, anon, authenticated;
grant select on table public.notification_preferences to authenticated;
grant select on table public.notifications to authenticated;
grant select on table public.workspace_integrations to authenticated;
grant select on table public.integration_events to authenticated;
revoke all on function public.save_notification_preferences(uuid, jsonb)
  from public;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.save_workspace_integration(uuid, jsonb)
  from public;
grant execute on function public.save_notification_preferences(uuid, jsonb)
  to authenticated;
grant execute on function public.mark_notification_read(uuid)
  to authenticated;
grant execute on function public.save_workspace_integration(uuid, jsonb)
  to authenticated;

comment on table public.notifications is
  'Alertas por eventos declarados; nunca se generan desde actividad individual oculta.';
comment on table public.workspace_integrations is
  'Configuración no secreta. Los tokens y secretos permanecen en el servidor.';

commit;
notify pgrst, 'reload schema';
