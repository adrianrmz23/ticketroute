begin;

create table if not exists public.calibration_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  execution_run_id uuid not null
    references public.execution_runs(id) on delete restrict,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  assignment_plan_id uuid not null
    references public.assignment_plans(id) on delete restrict,
  planning_guide_id uuid not null
    references public.planning_guides(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed')),
  estimated_low numeric(10, 2) not null check (estimated_low > 0),
  estimated_high numeric(10, 2) not null
    check (estimated_high > estimated_low),
  unit text not null check (unit in ('hours', 'days', 'points')),
  actual_value numeric(10, 2) not null check (actual_value > 0),
  interruption_count integer not null default 0
    check (interruption_count between 0 and 1000),
  scope_changed boolean not null default false,
  unexpected_blockers text[] not null default '{}'
    check (cardinality(unexpected_blockers) <= 30),
  unexpected_dependencies text[] not null default '{}'
    check (cardinality(unexpected_dependencies) <= 30),
  deviation_cause text not null default ''
    check (char_length(deviation_cause) <= 3000),
  selected_scenario text not null check (
    selected_scenario in ('favorable', 'probable', 'adverse', 'outside')
  ),
  learning_summary text not null default ''
    check (char_length(learning_summary) <= 3000),
  created_by uuid not null references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id),
  unique (execution_run_id)
);

create index if not exists calibration_workspace_status_idx
  on public.calibration_records (workspace_id, status, updated_at desc);
create index if not exists calibration_workspace_scenario_idx
  on public.calibration_records (workspace_id, selected_scenario);

alter table public.calibration_records enable row level security;

drop policy if exists calibration_records_select_member
  on public.calibration_records;
create policy calibration_records_select_member
on public.calibration_records
for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.save_calibration_record(
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
  target_ticket public.tickets%rowtype;
  target_run public.execution_runs%rowtype;
  target_guide public.planning_guides%rowtype;
  target_assignment public.assignment_plans%rowtype;
  target_estimate public.estimates%rowtype;
  record_id uuid;
  next_status text := coalesce(p_payload ->> 'status', 'draft');
  next_actual numeric;
  next_scenario text := p_payload ->> 'selectedScenario';
  next_blockers text[];
  next_dependencies text[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_ticket
  from public.tickets
  where id = p_ticket_id;

  if target_ticket.id is null
    or not public.has_workspace_role(
      target_ticket.workspace_id,
      array['owner', 'admin', 'planner', 'member']::public.workspace_role[]
    )
  then
    raise exception 'Calibration access denied';
  end if;

  select *
  into target_run
  from public.execution_runs
  where ticket_id = p_ticket_id
    and workspace_id = target_ticket.workspace_id
    and status = 'completed'
  order by completed_at desc
  limit 1;

  if target_run.id is null then
    raise exception 'A completed execution run is required';
  end if;

  select *
  into target_guide
  from public.planning_guides
  where id = target_run.planning_guide_id;

  select *
  into target_assignment
  from public.assignment_plans
  where id = target_guide.assignment_plan_id;

  select *
  into target_estimate
  from public.estimates
  where id = target_guide.estimate_id;

  begin
    next_actual := (p_payload ->> 'actualValue')::numeric;
  exception when others then
    raise exception 'Actual value is invalid';
  end;

  if next_actual <= 0
    or next_scenario not in ('favorable', 'probable', 'adverse', 'outside')
    or next_status not in ('draft', 'confirmed')
  then
    raise exception 'Calibration payload is invalid';
  end if;

  select coalesce(array_agg(left(btrim(value), 500)), '{}')
  into next_blockers
  from jsonb_array_elements_text(
    coalesce(p_payload -> 'unexpectedBlockers', '[]'::jsonb)
  )
  where char_length(btrim(value)) > 0;

  select coalesce(array_agg(left(btrim(value), 500)), '{}')
  into next_dependencies
  from jsonb_array_elements_text(
    coalesce(p_payload -> 'unexpectedDependencies', '[]'::jsonb)
  )
  where char_length(btrim(value)) > 0;

  if cardinality(next_blockers) > 30
    or cardinality(next_dependencies) > 30
  then
    raise exception 'Calibration signals exceed the limit';
  end if;

  insert into public.calibration_records (
    workspace_id,
    ticket_id,
    execution_run_id,
    estimate_id,
    assignment_plan_id,
    planning_guide_id,
    status,
    estimated_low,
    estimated_high,
    unit,
    actual_value,
    interruption_count,
    scope_changed,
    unexpected_blockers,
    unexpected_dependencies,
    deviation_cause,
    selected_scenario,
    learning_summary,
    created_by,
    confirmed_by,
    confirmed_at
  ) values (
    target_ticket.workspace_id,
    target_ticket.id,
    target_run.id,
    target_estimate.id,
    target_assignment.id,
    target_guide.id,
    next_status,
    target_assignment.range_low,
    target_assignment.range_high,
    target_assignment.unit,
    next_actual,
    least(greatest(
      coalesce((p_payload ->> 'interruptionCount')::integer, 0),
      0
    ), 1000),
    coalesce((p_payload ->> 'scopeChanged')::boolean, false),
    next_blockers,
    next_dependencies,
    left(btrim(coalesce(p_payload ->> 'deviationCause', '')), 3000),
    next_scenario,
    left(btrim(coalesce(p_payload ->> 'learningSummary', '')), 3000),
    current_user_id,
    case when next_status = 'confirmed' then current_user_id end,
    case when next_status = 'confirmed' then now() end
  )
  on conflict (ticket_id) do update set
    status = excluded.status,
    actual_value = excluded.actual_value,
    interruption_count = excluded.interruption_count,
    scope_changed = excluded.scope_changed,
    unexpected_blockers = excluded.unexpected_blockers,
    unexpected_dependencies = excluded.unexpected_dependencies,
    deviation_cause = excluded.deviation_cause,
    selected_scenario = excluded.selected_scenario,
    learning_summary = excluded.learning_summary,
    confirmed_by = case
      when excluded.status = 'confirmed'
      then current_user_id
      else public.calibration_records.confirmed_by
    end,
    confirmed_at = case
      when excluded.status = 'confirmed'
      then coalesce(public.calibration_records.confirmed_at, now())
      else public.calibration_records.confirmed_at
    end,
    updated_at = now()
  where public.calibration_records.status = 'draft'
  returning id into record_id;

  if record_id is null then
    raise exception 'Confirmed calibration records are immutable';
  end if;

  insert into public.audit_events (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_ticket.workspace_id,
    current_user_id,
    case
      when next_status = 'confirmed'
      then 'calibration.confirmed'
      else 'calibration.saved'
    end,
    'calibration_record',
    record_id,
    jsonb_build_object(
      'ticket_id', target_ticket.id,
      'execution_run_id', target_run.id,
      'selected_scenario', next_scenario,
      'scope_changed', coalesce(
        (p_payload ->> 'scopeChanged')::boolean,
        false
      ),
      'unexpected_blocker_count', cardinality(next_blockers),
      'unexpected_dependency_count', cardinality(next_dependencies)
    )
  );

  return record_id;
end;
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0010'
  );
$$;

revoke all on table public.calibration_records
  from public, anon, authenticated;
grant select on table public.calibration_records to authenticated;
revoke all on function public.save_calibration_record(uuid, jsonb) from public;
grant execute on function public.save_calibration_record(uuid, jsonb)
  to authenticated;

comment on table public.calibration_records is
  'Comparación declarada entre rango confirmado y resultado real; no infiere productividad.';

commit;
notify pgrst, 'reload schema';
