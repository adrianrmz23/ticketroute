begin;

create table if not exists public.execution_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  planning_guide_id uuid not null
    references public.planning_guides(id) on delete restrict,
  status text not null default 'active' check (
    status in ('active', 'blocked', 'completed', 'cancelled')
  ),
  started_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (planning_guide_id)
);

create table if not exists public.execution_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  execution_run_id uuid not null
    references public.execution_runs(id) on delete cascade,
  planning_guide_step_id uuid not null
    references public.planning_guide_steps(id) on delete restrict,
  position smallint not null check (position between 0 and 29),
  phase text not null check (
    phase in ('prepare', 'build', 'integrate', 'verify', 'handoff')
  ),
  title_snapshot text not null
    check (char_length(title_snapshot) between 3 and 180),
  outcome_snapshot text not null
    check (char_length(outcome_snapshot) between 5 and 1000),
  responsible_user_id uuid not null references auth.users(id) on delete restrict,
  effort_share smallint not null check (effort_share between 1 and 100),
  verification_snapshot text not null
    check (char_length(verification_snapshot) between 5 and 1000),
  source_kind text not null check (
    source_kind in (
      'ticket',
      'unknown',
      'dependency',
      'subtask',
      'requirement',
      'criterion',
      'outcome',
      'manual'
    )
  ),
  source_label text not null
    check (char_length(source_label) between 1 and 500),
  status text not null default 'pending' check (
    status in ('pending', 'in_progress', 'blocked', 'done', 'skipped')
  ),
  evidence_note text not null default ''
    check (char_length(evidence_note) <= 2000),
  blocker_note text not null default ''
    check (char_length(blocker_note) <= 2000),
  updated_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (execution_run_id, position),
  unique (execution_run_id, planning_guide_step_id)
);

create table if not exists public.execution_step_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  execution_run_id uuid not null
    references public.execution_runs(id) on delete cascade,
  execution_step_id uuid not null
    references public.execution_steps(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  from_status text check (
    from_status is null
    or from_status in ('pending', 'in_progress', 'blocked', 'done', 'skipped')
  ),
  to_status text not null check (
    to_status in ('pending', 'in_progress', 'blocked', 'done', 'skipped')
  ),
  evidence_note text not null default ''
    check (char_length(evidence_note) <= 2000),
  blocker_note text not null default ''
    check (char_length(blocker_note) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists execution_runs_workspace_status_idx
  on public.execution_runs (workspace_id, status, updated_at desc);
create index if not exists execution_runs_ticket_idx
  on public.execution_runs (ticket_id, started_at desc);
create unique index if not exists execution_runs_one_open_ticket_idx
  on public.execution_runs (ticket_id)
  where status in ('active', 'blocked');
create index if not exists execution_steps_run_position_idx
  on public.execution_steps (execution_run_id, position);
create index if not exists execution_steps_owner_status_idx
  on public.execution_steps (workspace_id, responsible_user_id, status);
create index if not exists execution_step_events_step_idx
  on public.execution_step_events (execution_step_id, created_at desc);

alter table public.execution_runs enable row level security;
alter table public.execution_steps enable row level security;
alter table public.execution_step_events enable row level security;

drop policy if exists execution_runs_select_member
  on public.execution_runs;
create policy execution_runs_select_member
on public.execution_runs
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists execution_steps_select_member
  on public.execution_steps;
create policy execution_steps_select_member
on public.execution_steps
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists execution_step_events_select_member
  on public.execution_step_events;
create policy execution_step_events_select_member
on public.execution_step_events
for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.start_execution_run(
  p_ticket_id uuid,
  p_planning_guide_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.tickets%rowtype;
  current_guide public.planning_guides%rowtype;
  existing_run public.execution_runs%rowtype;
  new_run_id uuid;
  copied_step_count integer;
  copied_effort integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target
  from public.tickets
  where id = p_ticket_id;

  if target.id is null
    or not public.has_workspace_role(
      target.workspace_id,
      array['owner', 'admin', 'planner', 'member']::public.workspace_role[]
    )
  then
    raise exception 'Execution access denied';
  end if;

  if target.status in ('done', 'archived') then
    raise exception 'Closed tickets cannot start execution';
  end if;

  select *
  into current_guide
  from public.planning_guides
  where id = p_planning_guide_id
    and ticket_id = p_ticket_id
    and workspace_id = target.workspace_id
    and is_current;

  if current_guide.id is null then
    raise exception 'A current planning guide is required';
  end if;

  select *
  into existing_run
  from public.execution_runs
  where planning_guide_id = current_guide.id;

  if existing_run.id is not null then
    return existing_run.id;
  end if;

  if exists (
    select 1
    from public.execution_runs
    where ticket_id = p_ticket_id
      and status in ('active', 'blocked')
  ) then
    raise exception 'Another execution run is already open';
  end if;

  select count(*)::integer, coalesce(sum(effort_share), 0)::integer
  into copied_step_count, copied_effort
  from public.planning_guide_steps
  where planning_guide_id = current_guide.id;

  if copied_step_count not between 3 and 30 or copied_effort <> 100 then
    raise exception 'Planning guide is incomplete';
  end if;

  insert into public.execution_runs (
    workspace_id,
    ticket_id,
    planning_guide_id,
    status,
    started_by
  ) values (
    target.workspace_id,
    p_ticket_id,
    current_guide.id,
    'active',
    current_user_id
  )
  returning id into new_run_id;

  insert into public.execution_steps (
    workspace_id,
    execution_run_id,
    planning_guide_step_id,
    position,
    phase,
    title_snapshot,
    outcome_snapshot,
    responsible_user_id,
    effort_share,
    verification_snapshot,
    source_kind,
    source_label,
    status,
    evidence_note,
    blocker_note,
    updated_by
  )
  select
    guide_steps.workspace_id,
    new_run_id,
    guide_steps.id,
    guide_steps.position,
    guide_steps.phase,
    guide_steps.title,
    guide_steps.outcome,
    guide_steps.responsible_user_id,
    guide_steps.effort_share,
    guide_steps.verification,
    guide_steps.source_kind,
    guide_steps.source_label,
    'pending',
    '',
    '',
    current_user_id
  from public.planning_guide_steps as guide_steps
  where guide_steps.planning_guide_id = current_guide.id
  order by guide_steps.position;

  update public.tickets
  set status = 'in_progress', updated_at = now()
  where id = p_ticket_id;

  insert into public.audit_events (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    target.workspace_id,
    current_user_id,
    'execution.started',
    'execution_run',
    new_run_id,
    jsonb_build_object(
      'ticket_id', p_ticket_id,
      'planning_guide_id', current_guide.id,
      'guide_version', current_guide.version,
      'step_count', copied_step_count
    )
  );

  return new_run_id;
end;
$$;

create or replace function public.update_execution_step(
  p_execution_step_id uuid,
  p_status text,
  p_evidence_note text,
  p_blocker_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_step public.execution_steps%rowtype;
  target_run public.execution_runs%rowtype;
  actor_role public.workspace_role;
  next_run_status text;
  unresolved_count integer;
  blocked_count integer;
  resolved_count integer;
  step_count integer;
  progress_percent integer;
  normalized_evidence text := left(btrim(coalesce(p_evidence_note, '')), 2000);
  normalized_blocker text := left(btrim(coalesce(p_blocker_note, '')), 2000);
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_step
  from public.execution_steps
  where id = p_execution_step_id;

  if target_step.id is null then
    raise exception 'Execution step not found';
  end if;

  select *
  into target_run
  from public.execution_runs
  where id = target_step.execution_run_id;

  select role
  into actor_role
  from public.workspace_members
  where workspace_id = target_step.workspace_id
    and user_id = current_user_id;

  if actor_role is null
    or actor_role = 'viewer'
    or (
      current_user_id <> target_step.responsible_user_id
      and actor_role not in ('owner', 'admin', 'planner')
    )
  then
    raise exception 'Execution step update denied';
  end if;

  if target_run.status not in ('active', 'blocked') then
    raise exception 'Execution run is closed';
  end if;

  if p_status not in (
    'pending', 'in_progress', 'blocked', 'done', 'skipped'
  ) then
    raise exception 'Execution status is invalid';
  end if;

  if not (
    (target_step.status = 'pending'
      and p_status in ('pending', 'in_progress', 'blocked', 'skipped'))
    or
    (target_step.status = 'in_progress'
      and p_status in ('in_progress', 'blocked', 'done', 'skipped'))
    or
    (target_step.status = 'blocked'
      and p_status in ('blocked', 'in_progress', 'done', 'skipped'))
  ) then
    raise exception 'Execution transition is not allowed';
  end if;

  if p_status = 'blocked' and char_length(normalized_blocker) < 5 then
    raise exception 'A blocker description is required';
  end if;

  if p_status in ('done', 'skipped')
    and char_length(normalized_evidence) < 5
  then
    raise exception 'Evidence or a skip reason is required';
  end if;

  update public.execution_steps
  set
    status = p_status,
    evidence_note = normalized_evidence,
    blocker_note = case
      when p_status = 'blocked' then normalized_blocker
      else ''
    end,
    updated_by = current_user_id,
    started_at = case
      when p_status <> 'pending' then coalesce(started_at, now())
      else started_at
    end,
    completed_at = case
      when p_status in ('done', 'skipped') then now()
      else null
    end,
    updated_at = now()
  where id = target_step.id;

  insert into public.execution_step_events (
    workspace_id,
    execution_run_id,
    execution_step_id,
    actor_id,
    from_status,
    to_status,
    evidence_note,
    blocker_note
  ) values (
    target_step.workspace_id,
    target_step.execution_run_id,
    target_step.id,
    current_user_id,
    target_step.status,
    p_status,
    normalized_evidence,
    case when p_status = 'blocked' then normalized_blocker else '' end
  );

  select
    count(*) filter (
      where status not in ('done', 'skipped')
    )::integer,
    count(*) filter (where status = 'blocked')::integer,
    count(*) filter (where status in ('done', 'skipped'))::integer,
    count(*)::integer,
    coalesce(sum(effort_share) filter (
      where status in ('done', 'skipped')
    ), 0)::integer
  into
    unresolved_count,
    blocked_count,
    resolved_count,
    step_count,
    progress_percent
  from public.execution_steps
  where execution_run_id = target_run.id;

  next_run_status := case
    when unresolved_count = 0 then 'completed'
    when blocked_count > 0 then 'blocked'
    else 'active'
  end;

  update public.execution_runs
  set
    status = next_run_status,
    completed_at = case
      when next_run_status = 'completed' then now()
      else null
    end,
    updated_at = now()
  where id = target_run.id;

  update public.tickets
  set
    status = case
      when next_run_status = 'completed' then 'done'
      when next_run_status = 'blocked' then 'blocked'
      else 'in_progress'
    end,
    updated_at = now()
  where id = target_run.ticket_id;

  insert into public.audit_events (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_step.workspace_id,
    current_user_id,
    'execution.step_updated',
    'execution_step',
    target_step.id,
    jsonb_build_object(
      'execution_run_id', target_run.id,
      'ticket_id', target_run.ticket_id,
      'from_status', target_step.status,
      'to_status', p_status,
      'has_evidence', char_length(normalized_evidence) > 0,
      'has_blocker', p_status = 'blocked',
      'progress_percent', progress_percent
    )
  );

  return jsonb_build_object(
    'execution_run_id', target_run.id,
    'run_status', next_run_status,
    'progress_percent', progress_percent,
    'resolved_count', resolved_count,
    'step_count', step_count
  );
end;
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0009'
  );
$$;

revoke all on table public.execution_runs
  from public, anon, authenticated;
revoke all on table public.execution_steps
  from public, anon, authenticated;
revoke all on table public.execution_step_events
  from public, anon, authenticated;
grant select on table public.execution_runs to authenticated;
grant select on table public.execution_steps to authenticated;
grant select on table public.execution_step_events to authenticated;

revoke all on function public.start_execution_run(uuid, uuid) from public;
grant execute on function public.start_execution_run(uuid, uuid)
  to authenticated;
revoke all on function public.update_execution_step(
  uuid, text, text, text
) from public;
grant execute on function public.update_execution_step(
  uuid, text, text, text
) to authenticated;

comment on table public.execution_runs is
  'Ejecuciones explícitamente iniciadas desde una guía confirmada e inmutable.';
comment on table public.execution_steps is
  'Snapshot operativo de pasos; los estados son declaraciones, no telemetría.';
comment on table public.execution_step_events is
  'Historial append-only de cambios declarados con evidencia o bloqueo visible.';

commit;
notify pgrst, 'reload schema';
