begin;

create table if not exists public.planning_guides (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  assignment_plan_id uuid not null
    references public.assignment_plans(id) on delete restrict,
  version integer not null check (version > 0),
  is_current boolean not null default true,
  objective text not null check (char_length(objective) between 8 and 2000),
  sequence_rationale text not null
    check (char_length(sequence_rationale) between 12 and 3000),
  verification_strategy text not null
    check (char_length(verification_strategy) between 8 and 3000),
  assumptions text[] not null default '{}'
    check (cardinality(assumptions) <= 20),
  evidence_limitations text[] not null default '{}'
    check (cardinality(evidence_limitations) <= 20),
  evidence_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence_snapshot) = 'object'),
  engine_kind text not null default 'local_rules'
    check (engine_kind = 'local_rules'),
  engine_version text not null default 'tr-guide-1'
    check (engine_version = 'tr-guide-1'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (ticket_id, version)
);

create table if not exists public.planning_guide_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_guide_id uuid not null
    references public.planning_guides(id) on delete cascade,
  position smallint not null check (position between 0 and 29),
  phase text not null check (
    phase in ('prepare', 'build', 'integrate', 'verify', 'handoff')
  ),
  title text not null check (char_length(title) between 3 and 180),
  outcome text not null check (char_length(outcome) between 5 and 1000),
  responsible_user_id uuid not null references auth.users(id) on delete restrict,
  effort_share smallint not null check (effort_share between 1 and 100),
  verification text not null
    check (char_length(verification) between 5 and 1000),
  dependencies text[] not null default '{}'
    check (cardinality(dependencies) <= 20),
  risks text[] not null default '{}'
    check (cardinality(risks) <= 20),
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
  created_at timestamptz not null default now(),
  unique (planning_guide_id, position)
);

create index if not exists planning_guides_workspace_current_idx
  on public.planning_guides (workspace_id, is_current, created_at desc);
create index if not exists planning_guides_ticket_version_idx
  on public.planning_guides (ticket_id, version desc);
create unique index if not exists planning_guides_one_current_ticket_idx
  on public.planning_guides (ticket_id) where is_current;
create index if not exists planning_guide_steps_guide_idx
  on public.planning_guide_steps (planning_guide_id, position);
create index if not exists planning_guide_steps_owner_idx
  on public.planning_guide_steps (workspace_id, responsible_user_id);

alter table public.planning_guides enable row level security;
alter table public.planning_guide_steps enable row level security;

drop policy if exists planning_guides_select_member
  on public.planning_guides;
create policy planning_guides_select_member
on public.planning_guides
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists planning_guide_steps_select_member
  on public.planning_guide_steps;
create policy planning_guide_steps_select_member
on public.planning_guide_steps
for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.confirm_planning_guide(
  p_ticket_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.tickets%rowtype;
  current_estimate public.estimates%rowtype;
  current_assignment public.assignment_plans%rowtype;
  next_version integer;
  new_guide_id uuid;
  guide_step jsonb;
  guide_step_ordinal bigint;
  step_count integer;
  distinct_step_count integer;
  effort_total integer;
  responsible_role public.workspace_role;
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
    raise exception 'Planning guide access denied';
  end if;

  if target.status in ('done', 'archived') then
    raise exception 'Closed tickets cannot receive a planning guide';
  end if;

  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or coalesce(p_payload ->> 'ticketId', '') <> p_ticket_id::text
    or coalesce(p_payload ->> 'engineKind', '') <> 'local_rules'
    or coalesce(p_payload ->> 'engineVersion', '') <> 'tr-guide-1'
    or coalesce(jsonb_typeof(p_payload -> 'estimateRange'), '') <> 'object'
    or coalesce(jsonb_typeof(p_payload -> 'steps'), '') <> 'array'
    or coalesce(jsonb_typeof(p_payload -> 'assumptions'), '') <> 'array'
    or coalesce(jsonb_typeof(p_payload -> 'evidenceLimitations'), '') <> 'array'
    or char_length(btrim(coalesce(p_payload ->> 'objective', '')))
      not between 8 and 2000
    or char_length(btrim(coalesce(p_payload ->> 'sequenceRationale', '')))
      not between 12 and 3000
    or char_length(btrim(coalesce(p_payload ->> 'verificationStrategy', '')))
      not between 8 and 3000
  then
    raise exception 'Planning guide payload is invalid';
  end if;

  if jsonb_array_length(p_payload -> 'assumptions') > 20
    or jsonb_array_length(p_payload -> 'evidenceLimitations') > 20
    or exists (
      select 1
      from jsonb_array_elements(p_payload -> 'assumptions') as item
      where jsonb_typeof(item) <> 'string'
        or char_length(btrim(item #>> '{}')) not between 1 and 500
    )
    or exists (
      select 1
      from jsonb_array_elements(p_payload -> 'evidenceLimitations') as item
      where jsonb_typeof(item) <> 'string'
        or char_length(btrim(item #>> '{}')) not between 1 and 500
    )
  then
    raise exception 'Planning guide evidence is invalid';
  end if;

  select *
  into current_estimate
  from public.estimates
  where id = (p_payload ->> 'estimateId')::uuid
    and ticket_id = p_ticket_id
    and workspace_id = target.workspace_id
    and is_current;

  if current_estimate.id is null then
    raise exception 'Current estimate is required';
  end if;

  select *
  into current_assignment
  from public.assignment_plans
  where id = (p_payload ->> 'assignmentPlanId')::uuid
    and ticket_id = p_ticket_id
    and estimate_id = current_estimate.id
    and workspace_id = target.workspace_id
    and is_current;

  if current_assignment.id is null then
    raise exception 'Current assignment is required';
  end if;

  if coalesce(p_payload #>> '{estimateRange,unit}', '') <> current_assignment.unit
    or (p_payload #>> '{estimateRange,low}')::numeric
      <> current_assignment.range_low
    or (p_payload #>> '{estimateRange,high}')::numeric
      <> current_assignment.range_high
  then
    raise exception 'Planning guide range does not match the assignment';
  end if;

  select
    count(*)::integer,
    count(distinct value ->> 'localId')::integer,
    coalesce(sum((value ->> 'effortShare')::integer), 0)::integer
  into step_count, distinct_step_count, effort_total
  from jsonb_array_elements(p_payload -> 'steps');

  if step_count not between 3 and 30
    or distinct_step_count <> step_count
    or effort_total <> 100
  then
    raise exception 'Planning guide steps are invalid';
  end if;

  for guide_step, guide_step_ordinal in
    select value, ordinality
    from jsonb_array_elements(p_payload -> 'steps') with ordinality
  loop
    if coalesce(jsonb_typeof(guide_step), '') <> 'object'
      or coalesce(guide_step ->> 'phase', '') not in (
        'prepare', 'build', 'integrate', 'verify', 'handoff'
      )
      or coalesce(guide_step ->> 'sourceKind', '') not in (
        'ticket',
        'unknown',
        'dependency',
        'subtask',
        'requirement',
        'criterion',
        'outcome',
        'manual'
      )
      or (guide_step ->> 'position')::integer <> guide_step_ordinal - 1
      or (guide_step ->> 'effortShare')::integer not between 1 and 100
      or char_length(btrim(coalesce(guide_step ->> 'localId', '')))
        not between 3 and 80
      or char_length(btrim(coalesce(guide_step ->> 'title', '')))
        not between 3 and 180
      or char_length(btrim(coalesce(guide_step ->> 'outcome', '')))
        not between 5 and 1000
      or char_length(btrim(coalesce(guide_step ->> 'verification', '')))
        not between 5 and 1000
      or char_length(btrim(coalesce(guide_step ->> 'sourceLabel', '')))
        not between 1 and 500
      or coalesce(jsonb_typeof(guide_step -> 'dependencies'), '') <> 'array'
      or coalesce(jsonb_typeof(guide_step -> 'risks'), '') <> 'array'
      or jsonb_array_length(guide_step -> 'dependencies') > 20
      or jsonb_array_length(guide_step -> 'risks') > 20
      or exists (
        select 1
        from jsonb_array_elements(guide_step -> 'dependencies') as item
        where jsonb_typeof(item) <> 'string'
          or char_length(btrim(item #>> '{}')) not between 1 and 500
      )
      or exists (
        select 1
        from jsonb_array_elements(guide_step -> 'risks') as item
        where jsonb_typeof(item) <> 'string'
          or char_length(btrim(item #>> '{}')) not between 1 and 500
      )
    then
      raise exception 'Planning guide step is invalid';
    end if;

    responsible_role := null;

    select members.role
    into responsible_role
    from public.workspace_members as members
    where members.workspace_id = target.workspace_id
      and members.user_id = (guide_step ->> 'responsibleUserId')::uuid;

    if responsible_role is null
      or responsible_role = 'viewer'
      or not exists (
        select 1
        from public.assignment_plan_participants as participants
        where participants.assignment_plan_id = current_assignment.id
          and participants.user_id =
            (guide_step ->> 'responsibleUserId')::uuid
      )
    then
      raise exception 'Planning guide owner is not part of the assignment';
    end if;
  end loop;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.planning_guides
  where ticket_id = p_ticket_id;

  update public.planning_guides
  set is_current = false
  where ticket_id = p_ticket_id and is_current;

  insert into public.planning_guides (
    workspace_id,
    ticket_id,
    estimate_id,
    assignment_plan_id,
    version,
    is_current,
    objective,
    sequence_rationale,
    verification_strategy,
    assumptions,
    evidence_limitations,
    evidence_snapshot,
    engine_kind,
    engine_version,
    created_by
  ) values (
    target.workspace_id,
    p_ticket_id,
    current_estimate.id,
    current_assignment.id,
    next_version,
    true,
    btrim(p_payload ->> 'objective'),
    btrim(p_payload ->> 'sequenceRationale'),
    btrim(p_payload ->> 'verificationStrategy'),
    array(
      select left(btrim(value), 500)
      from jsonb_array_elements_text(p_payload -> 'assumptions')
    ),
    array(
      select left(btrim(value), 500)
      from jsonb_array_elements_text(p_payload -> 'evidenceLimitations')
    ),
    jsonb_build_object(
      'estimate_id', current_estimate.id,
      'assignment_plan_id', current_assignment.id,
      'estimate_range', p_payload -> 'estimateRange',
      'step_count', step_count,
      'phase_count', (
        select count(distinct value ->> 'phase')
        from jsonb_array_elements(p_payload -> 'steps')
      )
    ),
    'local_rules',
    'tr-guide-1',
    current_user_id
  )
  returning id into new_guide_id;

  for guide_step, guide_step_ordinal in
    select value, ordinality
    from jsonb_array_elements(p_payload -> 'steps') with ordinality
  loop
    insert into public.planning_guide_steps (
      workspace_id,
      planning_guide_id,
      position,
      phase,
      title,
      outcome,
      responsible_user_id,
      effort_share,
      verification,
      dependencies,
      risks,
      source_kind,
      source_label
    ) values (
      target.workspace_id,
      new_guide_id,
      guide_step_ordinal - 1,
      guide_step ->> 'phase',
      btrim(guide_step ->> 'title'),
      btrim(guide_step ->> 'outcome'),
      (guide_step ->> 'responsibleUserId')::uuid,
      (guide_step ->> 'effortShare')::integer,
      btrim(guide_step ->> 'verification'),
      array(
        select left(btrim(value), 500)
        from jsonb_array_elements_text(guide_step -> 'dependencies')
      ),
      array(
        select left(btrim(value), 500)
        from jsonb_array_elements_text(guide_step -> 'risks')
      ),
      guide_step ->> 'sourceKind',
      btrim(guide_step ->> 'sourceLabel')
    );
  end loop;

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
    'planning_guide.confirmed',
    'planning_guide',
    new_guide_id,
    jsonb_build_object(
      'ticket_id', p_ticket_id,
      'estimate_id', current_estimate.id,
      'assignment_plan_id', current_assignment.id,
      'version', next_version,
      'step_count', step_count,
      'engine_kind', 'local_rules'
    )
  );

  return new_guide_id;
end;
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0008'
  );
$$;

revoke all on table public.planning_guides
  from public, anon, authenticated;
revoke all on table public.planning_guide_steps
  from public, anon, authenticated;
grant select on table public.planning_guides to authenticated;
grant select on table public.planning_guide_steps to authenticated;

revoke all on function public.confirm_planning_guide(uuid, jsonb)
  from public;
grant execute on function public.confirm_planning_guide(uuid, jsonb)
  to authenticated;

comment on table public.planning_guides is
  'Versiones inmutables de recorridos editados y confirmados por el usuario.';
comment on table public.planning_guide_steps is
  'Pasos verificables derivados de ticket, estimación y asignación confirmados.';

commit;
notify pgrst, 'reload schema';
