begin;

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  version integer not null check (version > 0),
  is_current boolean not null default true,
  unit text not null check (unit in ('hours', 'days', 'points')),
  favorable_low numeric(10, 2) not null check (favorable_low > 0),
  favorable_high numeric(10, 2) not null check (favorable_high > favorable_low),
  probable_low numeric(10, 2) not null check (probable_low > 0),
  probable_high numeric(10, 2) not null check (probable_high > probable_low),
  adverse_low numeric(10, 2) not null check (adverse_low > 0),
  adverse_high numeric(10, 2) not null check (adverse_high > adverse_low),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  basis text not null,
  assumptions text[] not null default '{}',
  unknowns text[] not null default '{}',
  risks text[] not null default '{}',
  dependencies_notes text[] not null default '{}',
  historical_references text[] not null default '{}',
  calculation_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(calculation_snapshot) = 'object'),
  engine_kind text not null default 'local_rules',
  engine_version text not null default 'tr-estimate-1',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (ticket_id, version),
  check (
    favorable_low <= probable_low
    and probable_low <= adverse_low
    and favorable_high <= probable_high
    and probable_high <= adverse_high
  )
);

create table if not exists public.estimate_factors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  position smallint not null default 0,
  factor_key text not null,
  label text not null,
  direction text not null
    check (direction in ('increases', 'decreases', 'neutral')),
  weight smallint not null check (weight between 1 and 3),
  evidence text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.estimate_breakdown (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  position smallint not null default 0,
  label text not null,
  effort_share smallint not null check (effort_share between 0 and 100),
  basis text not null,
  created_at timestamptz not null default now()
);

create index if not exists estimates_workspace_current_idx
  on public.estimates (workspace_id, is_current, created_at desc);
create index if not exists estimates_ticket_version_idx
  on public.estimates (ticket_id, version desc);
create unique index if not exists estimates_one_current_ticket_idx
  on public.estimates (ticket_id) where is_current;
create index if not exists estimate_factors_estimate_position_idx
  on public.estimate_factors (estimate_id, position);
create index if not exists estimate_breakdown_estimate_position_idx
  on public.estimate_breakdown (estimate_id, position);

alter table public.estimates enable row level security;
alter table public.estimate_factors enable row level security;
alter table public.estimate_breakdown enable row level security;

drop policy if exists estimates_select_member on public.estimates;
create policy estimates_select_member on public.estimates
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists estimate_factors_select_member on public.estimate_factors;
create policy estimate_factors_select_member on public.estimate_factors
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists estimate_breakdown_select_member
  on public.estimate_breakdown;
create policy estimate_breakdown_select_member on public.estimate_breakdown
for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.save_ticket_estimate(
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
  next_version integer;
  new_estimate_id uuid;
  item jsonb;
  item_index integer;
  breakdown_total integer;
begin
  select * into target from public.tickets where id = p_ticket_id;

  if target.id is null or not public.has_workspace_role(
    target.workspace_id,
    array['owner', 'admin', 'planner', 'member']::public.workspace_role[]
  ) then
    raise exception 'Estimate access denied';
  end if;

  if jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload -> 'scenarios') <> 'object'
    or jsonb_typeof(p_payload -> 'factors') <> 'array'
    or jsonb_typeof(p_payload -> 'decomposition') <> 'array'
    or coalesce(p_payload ->> 'unit', '') not in ('hours', 'days', 'points')
    or coalesce(p_payload ->> 'confidence', '') not in ('low', 'medium', 'high')
    or char_length(btrim(coalesce(p_payload ->> 'basis', ''))) < 12
  then
    raise exception 'Estimate payload is invalid';
  end if;

  if (p_payload #>> '{scenarios,favorable,low}')::numeric <= 0
    or (p_payload #>> '{scenarios,favorable,high}')::numeric
      <= (p_payload #>> '{scenarios,favorable,low}')::numeric
    or (p_payload #>> '{scenarios,probable,low}')::numeric <= 0
    or (p_payload #>> '{scenarios,probable,high}')::numeric
      <= (p_payload #>> '{scenarios,probable,low}')::numeric
    or (p_payload #>> '{scenarios,adverse,low}')::numeric <= 0
    or (p_payload #>> '{scenarios,adverse,high}')::numeric
      <= (p_payload #>> '{scenarios,adverse,low}')::numeric
    or (p_payload #>> '{scenarios,favorable,low}')::numeric
      > (p_payload #>> '{scenarios,probable,low}')::numeric
    or (p_payload #>> '{scenarios,probable,low}')::numeric
      > (p_payload #>> '{scenarios,adverse,low}')::numeric
    or (p_payload #>> '{scenarios,favorable,high}')::numeric
      > (p_payload #>> '{scenarios,probable,high}')::numeric
    or (p_payload #>> '{scenarios,probable,high}')::numeric
      > (p_payload #>> '{scenarios,adverse,high}')::numeric
  then
    raise exception 'Estimate scenarios are invalid';
  end if;

  select coalesce(sum((value ->> 'effortShare')::integer), 0)
  into breakdown_total
  from jsonb_array_elements(p_payload -> 'decomposition');

  if breakdown_total <> 100 then
    raise exception 'Estimate breakdown must total 100';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.estimates where ticket_id = p_ticket_id;

  update public.estimates
  set is_current = false
  where ticket_id = p_ticket_id and is_current;

  insert into public.estimates (
    workspace_id, ticket_id, version, is_current, unit,
    favorable_low, favorable_high, probable_low, probable_high,
    adverse_low, adverse_high, confidence, basis, assumptions, unknowns,
    risks, dependencies_notes, historical_references, calculation_snapshot,
    engine_kind, engine_version, created_by
  ) values (
    target.workspace_id,
    p_ticket_id,
    next_version,
    true,
    p_payload ->> 'unit',
    (p_payload #>> '{scenarios,favorable,low}')::numeric,
    (p_payload #>> '{scenarios,favorable,high}')::numeric,
    (p_payload #>> '{scenarios,probable,low}')::numeric,
    (p_payload #>> '{scenarios,probable,high}')::numeric,
    (p_payload #>> '{scenarios,adverse,low}')::numeric,
    (p_payload #>> '{scenarios,adverse,high}')::numeric,
    p_payload ->> 'confidence',
    btrim(p_payload ->> 'basis'),
    array(
      select jsonb_array_elements_text(
        coalesce(p_payload -> 'assumptions', '[]'::jsonb)
      )
    ),
    array(
      select jsonb_array_elements_text(
        coalesce(p_payload -> 'unknowns', '[]'::jsonb)
      )
    ),
    array(
      select jsonb_array_elements_text(
        coalesce(p_payload -> 'risks', '[]'::jsonb)
      )
    ),
    array(
      select jsonb_array_elements_text(
        coalesce(p_payload -> 'dependencies', '[]'::jsonb)
      )
    ),
    array(
      select jsonb_array_elements_text(
        coalesce(p_payload -> 'historicalReferences', '[]'::jsonb)
      )
    ),
    coalesce(p_payload -> 'calculationSnapshot', '{}'::jsonb),
    coalesce(p_payload ->> 'engineKind', 'local_rules'),
    coalesce(p_payload ->> 'engineVersion', 'tr-estimate-1'),
    current_user_id
  )
  returning id into new_estimate_id;

  for item, item_index in
    select value, ordinality::integer
    from jsonb_array_elements(p_payload -> 'factors') with ordinality
  loop
    if coalesce(item ->> 'direction', '') not in (
      'increases', 'decreases', 'neutral'
    ) or (item ->> 'weight')::integer not between 1 and 3 then
      raise exception 'Estimate factor is invalid';
    end if;

    insert into public.estimate_factors (
      workspace_id, estimate_id, position, factor_key, label,
      direction, weight, evidence
    ) values (
      target.workspace_id,
      new_estimate_id,
      item_index,
      left(item ->> 'key', 80),
      left(item ->> 'label', 120),
      item ->> 'direction',
      (item ->> 'weight')::integer,
      left(item ->> 'evidence', 500)
    );
  end loop;

  for item, item_index in
    select value, ordinality::integer
    from jsonb_array_elements(p_payload -> 'decomposition') with ordinality
  loop
    insert into public.estimate_breakdown (
      workspace_id, estimate_id, position, label, effort_share, basis
    ) values (
      target.workspace_id,
      new_estimate_id,
      item_index,
      left(item ->> 'label', 120),
      (item ->> 'effortShare')::integer,
      left(item ->> 'basis', 500)
    );
  end loop;

  insert into public.audit_events (
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    target.workspace_id,
    current_user_id,
    'estimate.confirmed',
    'estimate',
    new_estimate_id,
    jsonb_build_object(
      'ticket_id', p_ticket_id,
      'version', next_version,
      'unit', p_payload ->> 'unit',
      'confidence', p_payload ->> 'confidence',
      'engine_kind', coalesce(p_payload ->> 'engineKind', 'local_rules')
    )
  );

  return new_estimate_id;
end;
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0005'
  );
$$;

revoke all on table public.estimates from public, anon, authenticated;
revoke all on table public.estimate_factors from public, anon, authenticated;
revoke all on table public.estimate_breakdown from public, anon, authenticated;
grant select on table public.estimates to authenticated;
grant select on table public.estimate_factors to authenticated;
grant select on table public.estimate_breakdown to authenticated;

revoke all on function public.save_ticket_estimate(uuid, jsonb) from public;
grant execute on function public.save_ticket_estimate(uuid, jsonb)
  to authenticated;

commit;
notify pgrst, 'reload schema';

