begin;

create table if not exists public.assignment_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  version integer not null check (version > 0),
  is_current boolean not null default true,
  strategy text not null check (
    strategy in (
      'fast_delivery',
      'balanced_load',
      'knowledge_transfer',
      'custom'
    )
  ),
  range_low numeric(10, 2) not null check (range_low > 0),
  range_high numeric(10, 2) not null check (range_high > range_low),
  unit text not null check (unit in ('hours', 'days', 'points')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  resulting_load_percent numeric(7, 2)
    check (
      resulting_load_percent is null
      or resulting_load_percent between 0 and 1000
    ),
  resulting_load_level text not null check (
    resulting_load_level in ('low', 'medium', 'high', 'overloaded')
  ),
  knowledge_concentration text not null check (
    knowledge_concentration in ('low', 'medium', 'high')
  ),
  rationale text not null,
  change_consequence text not null,
  risks text[] not null default '{}',
  discarded_alternatives text[] not null default '{}',
  evidence_limitations text[] not null default '{}',
  evidence_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence_snapshot) = 'object'),
  engine_kind text not null default 'local_rules',
  engine_version text not null default 'tr-assignment-1',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (ticket_id, version)
);

create table if not exists public.assignment_plan_participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assignment_plan_id uuid not null
    references public.assignment_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  participation_role text not null check (
    participation_role in ('responsible', 'collaborator')
  ),
  contribution_percent smallint not null
    check (contribution_percent between 1 and 100),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (assignment_plan_id, user_id)
);

create index if not exists assignment_plans_workspace_current_idx
  on public.assignment_plans (workspace_id, is_current, created_at desc);
create index if not exists assignment_plans_ticket_version_idx
  on public.assignment_plans (ticket_id, version desc);
create unique index if not exists assignment_plans_one_current_ticket_idx
  on public.assignment_plans (ticket_id) where is_current;
create index if not exists assignment_participants_plan_idx
  on public.assignment_plan_participants (
    assignment_plan_id,
    participation_role
  );
create index if not exists assignment_participants_user_idx
  on public.assignment_plan_participants (workspace_id, user_id);

alter table public.assignment_plans enable row level security;
alter table public.assignment_plan_participants enable row level security;

drop policy if exists assignment_plans_select_member
  on public.assignment_plans;
create policy assignment_plans_select_member
on public.assignment_plans
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists assignment_participants_select_member
  on public.assignment_plan_participants;
create policy assignment_participants_select_member
on public.assignment_plan_participants
for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.confirm_assignment_plan(
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
  next_version integer;
  new_plan_id uuid;
  participant jsonb;
  participant_count integer;
  responsible_count integer;
  distinct_participant_count integer;
  contribution_total integer;
  participant_role public.workspace_role;
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
    raise exception 'Assignment access denied';
  end if;

  if target.status in ('done', 'archived') then
    raise exception 'Closed tickets cannot be assigned';
  end if;

  if jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload -> 'range') <> 'object'
    or jsonb_typeof(p_payload -> 'participants') <> 'array'
    or jsonb_typeof(p_payload -> 'evidence') <> 'array'
    or coalesce(p_payload ->> 'strategy', '') not in (
      'fast_delivery',
      'balanced_load',
      'knowledge_transfer',
      'custom'
    )
    or coalesce(p_payload #>> '{range,unit}', '') not in (
      'hours',
      'days',
      'points'
    )
    or coalesce(p_payload ->> 'confidence', '') not in (
      'low',
      'medium',
      'high'
    )
    or coalesce(p_payload #>> '{resultingLoad,level}', '') not in (
      'low',
      'medium',
      'high',
      'overloaded'
    )
    or coalesce(p_payload ->> 'knowledgeConcentration', '') not in (
      'low',
      'medium',
      'high'
    )
    or char_length(btrim(coalesce(p_payload ->> 'rationale', ''))) < 12
    or char_length(
      btrim(coalesce(p_payload ->> 'changeConsequence', ''))
    ) < 8
  then
    raise exception 'Assignment payload is invalid';
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

  if (p_payload #>> '{range,low}')::numeric <= 0
    or (p_payload #>> '{range,high}')::numeric
      <= (p_payload #>> '{range,low}')::numeric
    or p_payload #>> '{range,unit}' <> current_estimate.unit
    or (p_payload #>> '{range,low}')::numeric
      < current_estimate.favorable_low
    or (p_payload #>> '{range,high}')::numeric
      > current_estimate.adverse_high
  then
    raise exception 'Assignment range is outside the current estimate';
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where value ->> 'participationRole' = 'responsible'
    )::integer,
    count(distinct value ->> 'userId')::integer,
    coalesce(sum((value ->> 'contributionPercent')::integer), 0)::integer
  into
    participant_count,
    responsible_count,
    distinct_participant_count,
    contribution_total
  from jsonb_array_elements(p_payload -> 'participants');

  if participant_count not between 1 and 20
    or responsible_count <> 1
    or distinct_participant_count <> participant_count
    or contribution_total <> 100
  then
    raise exception 'Assignment participants are invalid';
  end if;

  for participant in
    select value from jsonb_array_elements(p_payload -> 'participants')
  loop
    if coalesce(participant ->> 'participationRole', '') not in (
      'responsible',
      'collaborator'
    )
      or (participant ->> 'contributionPercent')::integer not between 1 and 100
      or char_length(btrim(coalesce(participant ->> 'reason', ''))) < 3
    then
      raise exception 'Assignment participant is invalid';
    end if;

    select members.role
    into participant_role
    from public.workspace_members as members
    where members.workspace_id = target.workspace_id
      and members.user_id = (participant ->> 'userId')::uuid;

    if participant_role is null or participant_role = 'viewer' then
      raise exception 'Assignment participant is not eligible';
    end if;
  end loop;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.assignment_plans
  where ticket_id = p_ticket_id;

  update public.assignment_plans
  set is_current = false
  where ticket_id = p_ticket_id and is_current;

  insert into public.assignment_plans (
    workspace_id,
    ticket_id,
    estimate_id,
    version,
    is_current,
    strategy,
    range_low,
    range_high,
    unit,
    confidence,
    resulting_load_percent,
    resulting_load_level,
    knowledge_concentration,
    rationale,
    change_consequence,
    risks,
    discarded_alternatives,
    evidence_limitations,
    evidence_snapshot,
    engine_kind,
    engine_version,
    created_by
  ) values (
    target.workspace_id,
    p_ticket_id,
    current_estimate.id,
    next_version,
    true,
    p_payload ->> 'strategy',
    (p_payload #>> '{range,low}')::numeric,
    (p_payload #>> '{range,high}')::numeric,
    p_payload #>> '{range,unit}',
    p_payload ->> 'confidence',
    case
      when p_payload #> '{resultingLoad,percentage}' = 'null'::jsonb
        then null
      else (p_payload #>> '{resultingLoad,percentage}')::numeric
    end,
    p_payload #>> '{resultingLoad,level}',
    p_payload ->> 'knowledgeConcentration',
    btrim(p_payload ->> 'rationale'),
    btrim(p_payload ->> 'changeConsequence'),
    array(
      select jsonb_array_elements_text(
        coalesce(p_payload -> 'risks', '[]'::jsonb)
      )
    ),
    array(
      select jsonb_array_elements_text(
        coalesce(p_payload -> 'discardedAlternatives', '[]'::jsonb)
      )
    ),
    array(
      select jsonb_array_elements_text(
        coalesce(p_payload -> 'evidenceLimitations', '[]'::jsonb)
      )
    ),
    jsonb_build_object(
      'signals',
      coalesce(p_payload -> 'evidence', '[]'::jsonb),
      'resulting_load',
      coalesce(p_payload -> 'resultingLoad', '{}'::jsonb),
      'summary',
      coalesce(p_payload ->> 'summary', '')
    ),
    coalesce(p_payload ->> 'engineKind', 'local_rules'),
    coalesce(p_payload ->> 'engineVersion', 'tr-assignment-1'),
    current_user_id
  )
  returning id into new_plan_id;

  for participant in
    select value from jsonb_array_elements(p_payload -> 'participants')
  loop
    insert into public.assignment_plan_participants (
      workspace_id,
      assignment_plan_id,
      user_id,
      participation_role,
      contribution_percent,
      reason
    ) values (
      target.workspace_id,
      new_plan_id,
      (participant ->> 'userId')::uuid,
      participant ->> 'participationRole',
      (participant ->> 'contributionPercent')::integer,
      left(btrim(participant ->> 'reason'), 500)
    );
  end loop;

  update public.tickets
  set
    status = case
      when status in ('draft', 'needs_context', 'ready') then 'planned'
      else status
    end,
    updated_at = now()
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
    'assignment.confirmed',
    'assignment_plan',
    new_plan_id,
    jsonb_build_object(
      'ticket_id', p_ticket_id,
      'estimate_id', current_estimate.id,
      'version', next_version,
      'strategy', p_payload ->> 'strategy',
      'participant_count', participant_count,
      'engine_kind', coalesce(p_payload ->> 'engineKind', 'local_rules')
    )
  );

  return new_plan_id;
end;
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0006'
  );
$$;

revoke all on table public.assignment_plans
  from public, anon, authenticated;
revoke all on table public.assignment_plan_participants
  from public, anon, authenticated;
grant select on table public.assignment_plans to authenticated;
grant select on table public.assignment_plan_participants to authenticated;

revoke all on function public.confirm_assignment_plan(uuid, jsonb)
  from public;
grant execute on function public.confirm_assignment_plan(uuid, jsonb)
  to authenticated;

commit;
notify pgrst, 'reload schema';

