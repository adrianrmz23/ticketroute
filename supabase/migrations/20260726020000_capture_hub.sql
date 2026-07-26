begin;

-- Corrige la salida de auth.users.email (varchar) para que coincida
-- exactamente con el contrato text expuesto por la función.
create or replace function public.get_workspace_members(
  p_workspace_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role public.workspace_role,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Workspace access denied';
  end if;

  return query
  select
    members.user_id,
    coalesce(
      profiles.display_name,
      split_part(coalesce(users.email::text, ''), '@', 1)
    )::text,
    coalesce(users.email::text, '')::text,
    members.role,
    members.joined_at
  from public.workspace_members as members
  left join public.profiles as profiles
    on profiles.id = members.user_id
  join auth.users as users
    on users.id = members.user_id
  where members.workspace_id = p_workspace_id
  order by
    case members.role
      when 'owner' then 1
      when 'admin' then 2
      when 'planner' then 3
      when 'member' then 4
      else 5
    end,
    coalesce(profiles.display_name, users.email::text);
end;
$$;

create table if not exists public.capture_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  created_by uuid not null
    references auth.users(id) on delete cascade,
  mode text not null default 'plan'
    check (mode in ('plan', 'command', 'standup', 'meeting', 'note')),
  source text not null default 'manual'
    check (source in ('manual', 'dictation', 'meeting_transcript', 'import')),
  input_text text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'archived')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  capture_session_id uuid
    references public.capture_sessions(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  consent_type text not null
    check (
      consent_type in (
        'microphone',
        'transcription',
        'meeting_recording',
        'audio_retention'
      )
    ),
  decision text not null
    check (decision in ('granted', 'denied', 'revoked')),
  policy_version text not null default '2026-07-26',
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists capture_sessions_workspace_status_updated_idx
  on public.capture_sessions (workspace_id, status, updated_at desc);

create index if not exists capture_sessions_creator_updated_idx
  on public.capture_sessions (created_by, updated_at desc);

create index if not exists consent_records_workspace_user_created_idx
  on public.consent_records (workspace_id, user_id, created_at desc);

drop trigger if exists capture_sessions_set_updated_at
  on public.capture_sessions;
create trigger capture_sessions_set_updated_at
before update on public.capture_sessions
for each row execute function public.set_updated_at();

alter table public.capture_sessions enable row level security;
alter table public.consent_records enable row level security;

drop policy if exists capture_sessions_select_member
  on public.capture_sessions;
create policy capture_sessions_select_member
on public.capture_sessions
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists consent_records_select_authorized
  on public.consent_records;
create policy consent_records_select_authorized
on public.consent_records
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

create or replace function public.save_capture_session(
  p_capture_id uuid,
  p_workspace_id uuid,
  p_mode text,
  p_input_text text,
  p_status text default 'draft',
  p_source text default 'manual',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_text text := regexp_replace(p_input_text, E'\\s+$', '');
  capture_id uuid := coalesce(p_capture_id, gen_random_uuid());
  previous_status text;
  affected_rows integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin', 'planner', 'member']::public.workspace_role[]
  ) then
    raise exception 'Capture access denied';
  end if;

  if p_mode not in ('plan', 'command', 'standup', 'meeting', 'note') then
    raise exception 'Capture mode is invalid';
  end if;

  if p_status not in ('draft', 'ready') then
    raise exception 'Capture status is invalid';
  end if;

  if p_source not in (
    'manual',
    'dictation',
    'meeting_transcript',
    'import'
  ) then
    raise exception 'Capture source is invalid';
  end if;

  if char_length(normalized_text) > 20000 then
    raise exception 'Capture input is too long';
  end if;

  if p_status = 'ready' and char_length(btrim(normalized_text)) < 12 then
    raise exception 'Ready capture requires more context';
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Capture metadata is invalid';
  end if;

  select sessions.status
  into previous_status
  from public.capture_sessions as sessions
  where sessions.id = capture_id
    and sessions.workspace_id = p_workspace_id
    and sessions.created_by = current_user_id;

  insert into public.capture_sessions (
    id,
    workspace_id,
    created_by,
    mode,
    source,
    input_text,
    status,
    metadata
  )
  values (
    capture_id,
    p_workspace_id,
    current_user_id,
    p_mode,
    p_source,
    normalized_text,
    p_status,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (id) do update
  set
    mode = excluded.mode,
    source = excluded.source,
    input_text = excluded.input_text,
    status = excluded.status,
    metadata = excluded.metadata
  where capture_sessions.workspace_id = excluded.workspace_id
    and capture_sessions.created_by = excluded.created_by;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Capture access denied';
  end if;

  if previous_status is null then
    insert into public.audit_events (
      workspace_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      p_workspace_id,
      current_user_id,
      'capture.created',
      'capture_session',
      capture_id,
      jsonb_build_object('mode', p_mode, 'source', p_source)
    );
  end if;

  if p_status = 'ready' and previous_status is distinct from 'ready' then
    insert into public.audit_events (
      workspace_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      p_workspace_id,
      current_user_id,
      'capture.ready',
      'capture_session',
      capture_id,
      jsonb_build_object(
        'mode',
        p_mode,
        'source',
        p_source,
        'character_count',
        char_length(normalized_text)
      )
    );
  end if;

  return capture_id;
end;
$$;

create or replace function public.archive_capture_session(
  p_capture_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_workspace_id uuid;
begin
  update public.capture_sessions
  set status = 'archived'
  where id = p_capture_id
    and created_by = current_user_id
    and public.has_workspace_role(
      workspace_id,
      array['owner', 'admin', 'planner', 'member']::public.workspace_role[]
    )
  returning workspace_id into target_workspace_id;

  if target_workspace_id is null then
    raise exception 'Capture access denied';
  end if;

  insert into public.audit_events (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id
  )
  values (
    target_workspace_id,
    current_user_id,
    'capture.archived',
    'capture_session',
    p_capture_id
  );
end;
$$;

create or replace function public.record_capture_consent(
  p_workspace_id uuid,
  p_capture_session_id uuid,
  p_consent_type text,
  p_decision text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  consent_id uuid;
begin
  if current_user_id is null
    or not public.is_workspace_member(p_workspace_id)
  then
    raise exception 'Consent access denied';
  end if;

  if p_consent_type not in (
    'microphone',
    'transcription',
    'meeting_recording',
    'audio_retention'
  ) then
    raise exception 'Consent type is invalid';
  end if;

  if p_decision not in ('granted', 'denied', 'revoked') then
    raise exception 'Consent decision is invalid';
  end if;

  if p_capture_session_id is not null and not exists (
    select 1
    from public.capture_sessions
    where id = p_capture_session_id
      and workspace_id = p_workspace_id
      and created_by = current_user_id
  ) then
    raise exception 'Capture access denied';
  end if;

  insert into public.consent_records (
    workspace_id,
    capture_session_id,
    user_id,
    consent_type,
    decision,
    metadata
  )
  values (
    p_workspace_id,
    p_capture_session_id,
    current_user_id,
    p_consent_type,
    p_decision,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into consent_id;

  return consent_id;
end;
$$;

create or replace function public.healthcheck()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok',
    'checked_at', now(),
    'schema_version', '0003'
  );
$$;

revoke all on table public.capture_sessions
  from public, anon, authenticated;
revoke all on table public.consent_records
  from public, anon, authenticated;

grant select on table public.capture_sessions to authenticated;
grant select on table public.consent_records to authenticated;

revoke all on function public.save_capture_session(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) from public;
revoke all on function public.archive_capture_session(uuid) from public;
revoke all on function public.record_capture_consent(
  uuid,
  uuid,
  text,
  text,
  jsonb
) from public;

grant execute on function public.save_capture_session(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;
grant execute on function public.archive_capture_session(uuid)
  to authenticated;
grant execute on function public.record_capture_consent(
  uuid,
  uuid,
  text,
  text,
  jsonb
) to authenticated;

comment on table public.capture_sessions
is 'Entradas originales y borradores persistentes del Capture Hub.';

comment on table public.consent_records
is 'Evidencia append-oriented de decisiones explícitas de privacidad.';

comment on function public.save_capture_session(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
)
is 'Crea o actualiza un borrador propio y audita transiciones relevantes.';

commit;

notify pgrst, 'reload schema';
