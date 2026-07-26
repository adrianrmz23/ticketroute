begin;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_capture_id uuid unique references public.capture_sessions(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  objective text not null default '',
  problem text not null default '',
  context text not null default '',
  expected_outcome text not null default '',
  scope text[] not null default '{}',
  out_of_scope text[] not null default '{}',
  functional_requirements text[] not null default '{}',
  technical_requirements text[] not null default '{}',
  constraints text[] not null default '{}',
  risks text[] not null default '{}',
  assumptions text[] not null default '{}',
  unknowns text[] not null default '{}',
  dependencies_notes text[] not null default '{}',
  labels text[] not null default '{}',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  target_date date,
  status text not null default 'draft'
    check (
      status in (
        'draft', 'needs_context', 'ready', 'planned', 'in_progress',
        'review', 'blocked', 'done', 'archived'
      )
    ),
  organizer_kind text not null default 'local_rules',
  organizer_version text not null default 'tr-local-1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_criteria (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  position smallint not null default 0,
  content text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_subtasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  position smallint not null default 0,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'in_progress', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_revisions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  change_summary text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (ticket_id, revision_number)
);

create index if not exists tickets_workspace_status_updated_idx
  on public.tickets (workspace_id, status, updated_at desc);
create index if not exists ticket_criteria_ticket_position_idx
  on public.ticket_criteria (ticket_id, position);
create index if not exists ticket_subtasks_ticket_position_idx
  on public.ticket_subtasks (ticket_id, position);
create index if not exists ticket_revisions_ticket_number_idx
  on public.ticket_revisions (ticket_id, revision_number desc);

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

drop trigger if exists ticket_subtasks_set_updated_at on public.ticket_subtasks;
create trigger ticket_subtasks_set_updated_at
before update on public.ticket_subtasks
for each row execute function public.set_updated_at();

alter table public.tickets enable row level security;
alter table public.ticket_criteria enable row level security;
alter table public.ticket_subtasks enable row level security;
alter table public.ticket_revisions enable row level security;

drop policy if exists tickets_select_member on public.tickets;
create policy tickets_select_member on public.tickets
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists ticket_criteria_select_member on public.ticket_criteria;
create policy ticket_criteria_select_member on public.ticket_criteria
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists ticket_subtasks_select_member on public.ticket_subtasks;
create policy ticket_subtasks_select_member on public.ticket_subtasks
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists ticket_revisions_select_member on public.ticket_revisions;
create policy ticket_revisions_select_member on public.ticket_revisions
for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.create_ticket_from_capture(
  p_workspace_id uuid,
  p_capture_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_ticket_id uuid;
  item text;
  item_index integer;
begin
  if current_user_id is null or not public.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin', 'planner', 'member']::public.workspace_role[]
  ) then
    raise exception 'Ticket access denied';
  end if;

  if not exists (
    select 1 from public.capture_sessions
    where id = p_capture_id
      and workspace_id = p_workspace_id
      and created_by = current_user_id
      and status = 'ready'
  ) then
    raise exception 'Ready capture not found';
  end if;

  if jsonb_typeof(p_payload) <> 'object'
    or char_length(btrim(p_payload ->> 'title')) not between 3 and 160
  then
    raise exception 'Ticket payload is invalid';
  end if;

  insert into public.tickets (
    workspace_id, source_capture_id, created_by, title, objective, problem,
    context, expected_outcome, scope, out_of_scope, functional_requirements,
    technical_requirements, constraints, risks, assumptions, unknowns,
    dependencies_notes, labels, priority, target_date, status
  )
  values (
    p_workspace_id,
    p_capture_id,
    current_user_id,
    btrim(p_payload ->> 'title'),
    coalesce(p_payload ->> 'objective', ''),
    coalesce(p_payload ->> 'problem', ''),
    coalesce(p_payload ->> 'context', ''),
    coalesce(p_payload ->> 'expectedOutcome', ''),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'scope', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'outOfScope', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'functionalRequirements', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'technicalRequirements', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'constraints', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'risks', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'assumptions', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'unknowns', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'dependencies', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'labels', '[]'))),
    coalesce(p_payload ->> 'priority', 'medium'),
    nullif(p_payload ->> 'targetDate', '')::date,
    case
      when jsonb_array_length(coalesce(p_payload -> 'unknowns', '[]')) > 0
        then 'needs_context'
      else 'draft'
    end
  )
  returning id into new_ticket_id;

  for item, item_index in
    select value, ordinality::integer
    from jsonb_array_elements_text(
      coalesce(p_payload -> 'acceptanceCriteria', '[]')
    ) with ordinality
  loop
    insert into public.ticket_criteria (
      workspace_id, ticket_id, position, content
    ) values (p_workspace_id, new_ticket_id, item_index, item);
  end loop;

  for item, item_index in
    select value, ordinality::integer
    from jsonb_array_elements_text(coalesce(p_payload -> 'subtasks', '[]'))
      with ordinality
  loop
    insert into public.ticket_subtasks (
      workspace_id, ticket_id, position, title
    ) values (p_workspace_id, new_ticket_id, item_index, item);
  end loop;

  insert into public.ticket_revisions (
    workspace_id, ticket_id, revision_number, snapshot, change_summary, created_by
  ) values (
    p_workspace_id, new_ticket_id, 1, p_payload,
    'Borrador organizado desde la entrada original', current_user_id
  );

  update public.capture_sessions
  set status = 'archived'
  where id = p_capture_id;

  insert into public.audit_events (
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id, current_user_id, 'ticket.created_from_capture',
    'ticket', new_ticket_id,
    jsonb_build_object(
      'capture_id', p_capture_id,
      'organizer_kind', 'local_rules',
      'requires_context',
      jsonb_array_length(coalesce(p_payload -> 'unknowns', '[]')) > 0
    )
  );

  return new_ticket_id;
exception
  when unique_violation then
    select id into new_ticket_id
    from public.tickets
    where source_capture_id = p_capture_id;
    return new_ticket_id;
end;
$$;

create or replace function public.update_ticket_draft(
  p_ticket_id uuid,
  p_payload jsonb,
  p_change_summary text default 'Edición manual'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.tickets%rowtype;
  next_revision integer;
begin
  select * into target from public.tickets where id = p_ticket_id;

  if target.id is null or not public.has_workspace_role(
    target.workspace_id,
    array['owner', 'admin', 'planner', 'member']::public.workspace_role[]
  ) then
    raise exception 'Ticket access denied';
  end if;

  if jsonb_typeof(p_payload) <> 'object'
    or char_length(btrim(p_payload ->> 'title')) not between 3 and 160
    or coalesce(p_payload ->> 'priority', '') not in (
      'low', 'medium', 'high', 'urgent'
    )
    or coalesce(p_payload ->> 'status', '') not in (
      'draft', 'needs_context', 'ready', 'planned', 'in_progress',
      'review', 'blocked', 'done', 'archived'
    )
  then
    raise exception 'Ticket payload is invalid';
  end if;

  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.ticket_revisions where ticket_id = p_ticket_id;

  update public.tickets set
    title = btrim(p_payload ->> 'title'),
    objective = coalesce(p_payload ->> 'objective', ''),
    problem = coalesce(p_payload ->> 'problem', ''),
    context = coalesce(p_payload ->> 'context', ''),
    expected_outcome = coalesce(p_payload ->> 'expectedOutcome', ''),
    scope = array(select jsonb_array_elements_text(coalesce(p_payload -> 'scope', '[]'))),
    out_of_scope = array(select jsonb_array_elements_text(coalesce(p_payload -> 'outOfScope', '[]'))),
    functional_requirements = array(select jsonb_array_elements_text(coalesce(p_payload -> 'functionalRequirements', '[]'))),
    technical_requirements = array(select jsonb_array_elements_text(coalesce(p_payload -> 'technicalRequirements', '[]'))),
    constraints = array(select jsonb_array_elements_text(coalesce(p_payload -> 'constraints', '[]'))),
    risks = array(select jsonb_array_elements_text(coalesce(p_payload -> 'risks', '[]'))),
    assumptions = array(select jsonb_array_elements_text(coalesce(p_payload -> 'assumptions', '[]'))),
    unknowns = array(select jsonb_array_elements_text(coalesce(p_payload -> 'unknowns', '[]'))),
    dependencies_notes = array(select jsonb_array_elements_text(coalesce(p_payload -> 'dependencies', '[]'))),
    labels = array(select jsonb_array_elements_text(coalesce(p_payload -> 'labels', '[]'))),
    priority = p_payload ->> 'priority',
    target_date = nullif(p_payload ->> 'targetDate', '')::date,
    status = p_payload ->> 'status'
  where id = p_ticket_id;

  delete from public.ticket_criteria where ticket_id = p_ticket_id;
  insert into public.ticket_criteria (workspace_id, ticket_id, position, content)
  select target.workspace_id, p_ticket_id, ordinality::integer, value
  from jsonb_array_elements_text(
    coalesce(p_payload -> 'acceptanceCriteria', '[]')
  ) with ordinality;

  delete from public.ticket_subtasks where ticket_id = p_ticket_id;
  insert into public.ticket_subtasks (workspace_id, ticket_id, position, title)
  select target.workspace_id, p_ticket_id, ordinality::integer, value
  from jsonb_array_elements_text(coalesce(p_payload -> 'subtasks', '[]'))
    with ordinality;

  insert into public.ticket_revisions (
    workspace_id, ticket_id, revision_number, snapshot, change_summary, created_by
  ) values (
    target.workspace_id, p_ticket_id, next_revision, p_payload,
    left(coalesce(nullif(btrim(p_change_summary), ''), 'Edición manual'), 160),
    current_user_id
  );
end;
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0004'
  );
$$;

revoke all on table public.tickets from public, anon, authenticated;
revoke all on table public.ticket_criteria from public, anon, authenticated;
revoke all on table public.ticket_subtasks from public, anon, authenticated;
revoke all on table public.ticket_revisions from public, anon, authenticated;
grant select on table public.tickets to authenticated;
grant select on table public.ticket_criteria to authenticated;
grant select on table public.ticket_subtasks to authenticated;
grant select on table public.ticket_revisions to authenticated;

revoke all on function public.create_ticket_from_capture(uuid, uuid, jsonb)
  from public;
revoke all on function public.update_ticket_draft(uuid, jsonb, text)
  from public;
grant execute on function public.create_ticket_from_capture(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.update_ticket_draft(uuid, jsonb, text)
  to authenticated;

commit;
notify pgrst, 'reload schema';
