begin;

create table if not exists public.member_planning_profiles (
  workspace_id uuid not null,
  user_id uuid not null,
  availability_hours numeric(6, 2)
    check (
      availability_hours is null
      or availability_hours between 1 and 168
    ),
  planned_hours numeric(6, 2) not null default 0
    check (planned_hours between 0 and 168),
  skills text[] not null default '{}'
    check (cardinality(skills) <= 20),
  component_experience text[] not null default '{}'
    check (cardinality(component_experience) <= 20),
  technical_ownership text[] not null default '{}'
    check (cardinality(technical_ownership) <= 20),
  learning_goals text[] not null default '{}'
    check (cardinality(learning_goals) <= 20),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id)
    on delete cascade,
  check (
    availability_hours is null
    or planned_hours <= availability_hours * 2
  )
);

create index if not exists member_planning_profiles_workspace_idx
  on public.member_planning_profiles (workspace_id, updated_at desc);

drop trigger if exists member_planning_profiles_set_updated_at
  on public.member_planning_profiles;
create trigger member_planning_profiles_set_updated_at
before update on public.member_planning_profiles
for each row execute function public.set_updated_at();

alter table public.member_planning_profiles enable row level security;

drop policy if exists member_planning_profiles_select_member
  on public.member_planning_profiles;
create policy member_planning_profiles_select_member
on public.member_planning_profiles
for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.save_member_planning_profile(
  p_workspace_id uuid,
  p_user_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  actor_role public.workspace_role;
  target_role public.workspace_role;
  availability numeric;
  planned numeric;
  normalized_skills text[];
  normalized_components text[];
  normalized_ownership text[];
  normalized_goals text[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select role
  into actor_role
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = current_user_id;

  select role
  into target_role
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id;

  if actor_role is null
    or target_role is null
    or (
      current_user_id <> p_user_id
      and actor_role not in ('owner', 'admin', 'planner')
    )
  then
    raise exception 'Planning profile access denied';
  end if;

  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or (
      p_payload ? 'availabilityHours'
      and p_payload -> 'availabilityHours' <> 'null'::jsonb
      and jsonb_typeof(p_payload -> 'availabilityHours') <> 'number'
    )
    or jsonb_typeof(coalesce(p_payload -> 'plannedHours', 'null'::jsonb))
      <> 'number'
    or jsonb_typeof(coalesce(p_payload -> 'skills', 'null'::jsonb))
      <> 'array'
    or jsonb_typeof(
      coalesce(p_payload -> 'componentExperience', 'null'::jsonb)
    ) <> 'array'
    or jsonb_typeof(
      coalesce(p_payload -> 'technicalOwnership', 'null'::jsonb)
    ) <> 'array'
    or jsonb_typeof(coalesce(p_payload -> 'learningGoals', 'null'::jsonb))
      <> 'array'
  then
    raise exception 'Planning profile payload is invalid';
  end if;

  if jsonb_array_length(p_payload -> 'skills') > 20
    or jsonb_array_length(p_payload -> 'componentExperience') > 20
    or jsonb_array_length(p_payload -> 'technicalOwnership') > 20
    or jsonb_array_length(p_payload -> 'learningGoals') > 20
    or exists (
      select 1
      from jsonb_array_elements(p_payload -> 'skills') as item
      where jsonb_typeof(item) <> 'string'
        or char_length(btrim(item #>> '{}')) not between 1 and 80
    )
    or exists (
      select 1
      from jsonb_array_elements(p_payload -> 'componentExperience') as item
      where jsonb_typeof(item) <> 'string'
        or char_length(btrim(item #>> '{}')) not between 1 and 80
    )
    or exists (
      select 1
      from jsonb_array_elements(p_payload -> 'technicalOwnership') as item
      where jsonb_typeof(item) <> 'string'
        or char_length(btrim(item #>> '{}')) not between 1 and 80
    )
    or exists (
      select 1
      from jsonb_array_elements(p_payload -> 'learningGoals') as item
      where jsonb_typeof(item) <> 'string'
        or char_length(btrim(item #>> '{}')) not between 1 and 80
    )
  then
    raise exception 'Planning profile declarations are invalid';
  end if;

  availability := nullif(p_payload ->> 'availabilityHours', '')::numeric;
  planned := (p_payload ->> 'plannedHours')::numeric;

  select coalesce(
    array_agg(distinct left(btrim(value), 80) order by left(btrim(value), 80)),
    '{}'::text[]
  )
  into normalized_skills
  from jsonb_array_elements_text(p_payload -> 'skills')
  where char_length(btrim(value)) between 1 and 80;

  select coalesce(
    array_agg(distinct left(btrim(value), 80) order by left(btrim(value), 80)),
    '{}'::text[]
  )
  into normalized_components
  from jsonb_array_elements_text(p_payload -> 'componentExperience')
  where char_length(btrim(value)) between 1 and 80;

  select coalesce(
    array_agg(distinct left(btrim(value), 80) order by left(btrim(value), 80)),
    '{}'::text[]
  )
  into normalized_ownership
  from jsonb_array_elements_text(p_payload -> 'technicalOwnership')
  where char_length(btrim(value)) between 1 and 80;

  select coalesce(
    array_agg(distinct left(btrim(value), 80) order by left(btrim(value), 80)),
    '{}'::text[]
  )
  into normalized_goals
  from jsonb_array_elements_text(p_payload -> 'learningGoals')
  where char_length(btrim(value)) between 1 and 80;

  if (availability is not null and availability not between 1 and 168)
    or planned not between 0 and 168
    or (availability is not null and planned > availability * 2)
    or cardinality(normalized_skills) > 20
    or cardinality(normalized_components) > 20
    or cardinality(normalized_ownership) > 20
    or cardinality(normalized_goals) > 20
  then
    raise exception 'Planning profile values are outside allowed limits';
  end if;

  insert into public.member_planning_profiles (
    workspace_id,
    user_id,
    availability_hours,
    planned_hours,
    skills,
    component_experience,
    technical_ownership,
    learning_goals,
    updated_by
  ) values (
    p_workspace_id,
    p_user_id,
    availability,
    planned,
    normalized_skills,
    normalized_components,
    normalized_ownership,
    normalized_goals,
    current_user_id
  )
  on conflict (workspace_id, user_id) do update
  set
    availability_hours = excluded.availability_hours,
    planned_hours = excluded.planned_hours,
    skills = excluded.skills,
    component_experience = excluded.component_experience,
    technical_ownership = excluded.technical_ownership,
    learning_goals = excluded.learning_goals,
    updated_by = current_user_id,
    updated_at = now();

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
    'capacity.profile_saved',
    'member_planning_profile',
    p_user_id,
    jsonb_build_object(
      'self_declared', current_user_id = p_user_id,
      'availability_declared', availability is not null,
      'skill_count', cardinality(normalized_skills),
      'component_count', cardinality(normalized_components),
      'ownership_count', cardinality(normalized_ownership),
      'learning_goal_count', cardinality(normalized_goals)
    )
  );
end;
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0007'
  );
$$;

revoke all on table public.member_planning_profiles
  from public, anon, authenticated;
grant select on table public.member_planning_profiles to authenticated;

revoke all on function public.save_member_planning_profile(
  uuid, uuid, jsonb
) from public;
grant execute on function public.save_member_planning_profile(
  uuid, uuid, jsonb
) to authenticated;

comment on table public.member_planning_profiles is
  'Señales de planeación declaradas; excluye telemetría, presencia y métricas ocultas.';

commit;
notify pgrst, 'reload schema';
