begin;

alter table public.workspaces
  add column if not exists weekly_capacity_hours smallint not null default 40,
  add column if not exists default_ai_provider text not null default 'manual',
  add column if not exists data_retention_days integer not null default 365,
  add column if not exists delete_audio_after_transcription boolean
    not null default true,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.workspaces
  drop constraint if exists workspaces_weekly_capacity_hours_check,
  add constraint workspaces_weekly_capacity_hours_check
    check (weekly_capacity_hours between 1 and 168),
  drop constraint if exists workspaces_default_ai_provider_check,
  add constraint workspaces_default_ai_provider_check
    check (
      default_ai_provider in ('manual', 'openai', 'anthropic', 'gemini')
    ),
  drop constraint if exists workspaces_data_retention_days_check,
  add constraint workspaces_data_retention_days_check
    check (data_retention_days in (30, 90, 180, 365, 730));

create or replace function public.create_workspace_v2(
  p_name text,
  p_slug text,
  p_timezone text default 'America/Mexico_City',
  p_estimation_unit text default 'days',
  p_weekly_capacity_hours smallint default 40,
  p_default_ai_provider text default 'manual',
  p_data_retention_days integer default 365,
  p_delete_audio_after_transcription boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_workspace_id uuid;
  normalized_name text := btrim(p_name);
  normalized_slug text := lower(btrim(p_slug));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(normalized_name) not between 2 and 80 then
    raise exception 'Workspace name must contain between 2 and 80 characters';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(normalized_slug) not between 2 and 48
  then
    raise exception 'Workspace slug is invalid';
  end if;

  if p_estimation_unit not in ('hours', 'days', 'points') then
    raise exception 'Estimation unit is invalid';
  end if;

  if p_weekly_capacity_hours not between 1 and 168 then
    raise exception 'Weekly capacity is invalid';
  end if;

  if p_default_ai_provider not in (
    'manual',
    'openai',
    'anthropic',
    'gemini'
  ) then
    raise exception 'AI provider is invalid';
  end if;

  if p_data_retention_days not in (30, 90, 180, 365, 730) then
    raise exception 'Data retention is invalid';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    raise exception 'Timezone is invalid';
  end if;

  insert into public.profiles (id)
  values (current_user_id)
  on conflict (id) do nothing;

  insert into public.workspaces (
    name,
    slug,
    timezone,
    estimation_unit,
    weekly_capacity_hours,
    default_ai_provider,
    data_retention_days,
    delete_audio_after_transcription,
    onboarding_completed_at,
    created_by
  )
  values (
    normalized_name,
    normalized_slug,
    p_timezone,
    p_estimation_unit,
    p_weekly_capacity_hours,
    p_default_ai_provider,
    p_data_retention_days,
    p_delete_audio_after_transcription,
    now(),
    current_user_id
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner');

  insert into public.audit_events (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    new_workspace_id,
    current_user_id,
    'workspace.onboarding_completed',
    'workspace',
    new_workspace_id,
    jsonb_build_object(
      'slug',
      normalized_slug,
      'timezone',
      p_timezone,
      'estimation_unit',
      p_estimation_unit,
      'weekly_capacity_hours',
      p_weekly_capacity_hours,
      'default_ai_provider',
      p_default_ai_provider,
      'data_retention_days',
      p_data_retention_days,
      'delete_audio_after_transcription',
      p_delete_audio_after_transcription
    )
  );

  return new_workspace_id;
end;
$$;

create or replace function public.get_my_workspaces()
returns table (
  id uuid,
  name text,
  slug text,
  role public.workspace_role,
  timezone text,
  estimation_unit text,
  weekly_capacity_hours smallint,
  default_ai_provider text,
  data_retention_days integer,
  delete_audio_after_transcription boolean,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    workspaces.id,
    workspaces.name,
    workspaces.slug,
    members.role,
    workspaces.timezone,
    workspaces.estimation_unit,
    workspaces.weekly_capacity_hours,
    workspaces.default_ai_provider,
    workspaces.data_retention_days,
    workspaces.delete_audio_after_transcription,
    members.joined_at
  from public.workspace_members as members
  join public.workspaces as workspaces
    on workspaces.id = members.workspace_id
  where members.user_id = (select auth.uid())
  order by members.joined_at asc, workspaces.name asc;
$$;

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
      split_part(coalesce(users.email, ''), '@', 1)
    ),
    coalesce(users.email, ''),
    members.role,
    members.joined_at
  from public.workspace_members as members
  join public.profiles as profiles
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
    coalesce(profiles.display_name, users.email);
end;
$$;

create or replace function public.create_workspace_invite(
  p_workspace_id uuid,
  p_email text,
  p_role public.workspace_role,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := lower(btrim(p_email));
  invite_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  ) then
    raise exception 'Workspace administration required';
  end if;

  if p_role = 'owner' then
    raise exception 'Owner invitations are not allowed';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_email) > 320
  then
    raise exception 'Invite email is invalid';
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invite token hash is invalid';
  end if;

  if p_expires_at <= now()
    or p_expires_at > now() + interval '30 days'
  then
    raise exception 'Invite expiration is invalid';
  end if;

  if exists (
    select 1
    from public.workspace_members as members
    join auth.users as users on users.id = members.user_id
    where members.workspace_id = p_workspace_id
      and lower(users.email) = normalized_email
  ) then
    raise exception 'User is already a workspace member';
  end if;

  select invites.id
  into invite_id
  from public.workspace_invites as invites
  where invites.workspace_id = p_workspace_id
    and invites.email = normalized_email
    and invites.status = 'pending'
  for update;

  if invite_id is null then
    insert into public.workspace_invites (
      workspace_id,
      email,
      role,
      token_hash,
      invited_by,
      expires_at
    )
    values (
      p_workspace_id,
      normalized_email,
      p_role,
      p_token_hash,
      current_user_id,
      p_expires_at
    )
    returning id into invite_id;
  else
    update public.workspace_invites
    set
      role = p_role,
      token_hash = p_token_hash,
      invited_by = current_user_id,
      expires_at = p_expires_at,
      updated_at = now()
    where id = invite_id;
  end if;

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
    'workspace.invite_created',
    'workspace_invite',
    invite_id,
    jsonb_build_object('email', normalized_email, 'role', p_role)
  );

  return invite_id;
end;
$$;

create or replace function public.preview_workspace_invite(
  p_token_hash text
)
returns table (
  invite_id uuid,
  workspace_id uuid,
  workspace_name text,
  role public.workspace_role,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    invites.id,
    invites.workspace_id,
    workspaces.name,
    invites.role,
    invites.expires_at
  from public.workspace_invites as invites
  join public.workspaces as workspaces
    on workspaces.id = invites.workspace_id
  where invites.token_hash = p_token_hash
    and invites.status = 'pending'
    and invites.expires_at > now()
    and invites.email = lower(coalesce((
      select users.email
      from auth.users as users
      where users.id = (select auth.uid())
    ), ''));
$$;

create or replace function public.accept_workspace_invite(
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  selected_invite public.workspace_invites%rowtype;
begin
  select lower(coalesce(users.email, ''))
  into current_email
  from auth.users as users
  where users.id = current_user_id;

  if current_user_id is null or current_email = '' then
    raise exception 'Authentication required';
  end if;

  select *
  into selected_invite
  from public.workspace_invites
  where token_hash = p_token_hash
  for update;

  if selected_invite.id is null
    or selected_invite.status <> 'pending'
    or selected_invite.expires_at <= now()
    or selected_invite.email <> current_email
  then
    raise exception 'Invite is invalid or expired';
  end if;

  insert into public.profiles (id)
  values (current_user_id)
  on conflict (id) do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (
    selected_invite.workspace_id,
    current_user_id,
    selected_invite.role
  )
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites
  set
    status = 'accepted',
    accepted_by = current_user_id,
    accepted_at = now(),
    updated_at = now()
  where id = selected_invite.id;

  insert into public.audit_events (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    selected_invite.workspace_id,
    current_user_id,
    'workspace.invite_accepted',
    'workspace_invite',
    selected_invite.id,
    jsonb_build_object('role', selected_invite.role)
  );

  return selected_invite.workspace_id;
end;
$$;

create or replace function public.revoke_workspace_invite(
  p_invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_invite public.workspace_invites%rowtype;
begin
  select *
  into selected_invite
  from public.workspace_invites
  where id = p_invite_id
  for update;

  if selected_invite.id is null then
    raise exception 'Invite not found';
  end if;

  if not public.has_workspace_role(
    selected_invite.workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  ) then
    raise exception 'Workspace administration required';
  end if;

  if selected_invite.status <> 'pending' then
    raise exception 'Only pending invites can be revoked';
  end if;

  update public.workspace_invites
  set status = 'revoked', updated_at = now()
  where id = selected_invite.id;

  insert into public.audit_events (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    selected_invite.workspace_id,
    current_user_id,
    'workspace.invite_revoked',
    'workspace_invite',
    selected_invite.id,
    jsonb_build_object('email', selected_invite.email)
  );
end;
$$;

create or replace function public.change_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role public.workspace_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  actor_role public.workspace_role;
  previous_role public.workspace_role;
begin
  select role
  into actor_role
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = current_user_id;

  select role
  into previous_role
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id
  for update;

  if actor_role is null
    or actor_role not in ('owner', 'admin')
    or previous_role is null
  then
    raise exception 'Workspace administration required';
  end if;

  if actor_role = 'admin'
    and (
      previous_role in ('owner', 'admin')
      or p_role in ('owner', 'admin')
    )
  then
    raise exception 'Only an owner can manage privileged roles';
  end if;

  update public.workspace_members
  set role = p_role, updated_at = now()
  where workspace_id = p_workspace_id
    and user_id = p_user_id;

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
    'workspace.member_role_changed',
    'profile',
    p_user_id,
    jsonb_build_object('from', previous_role, 'to', p_role)
  );
end;
$$;

create or replace function public.remove_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
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
begin
  select role
  into actor_role
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = current_user_id;

  select role
  into target_role
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id
  for update;

  if actor_role is null
    or actor_role not in ('owner', 'admin')
    or target_role is null
  then
    raise exception 'Workspace administration required';
  end if;

  if actor_role = 'admin' and target_role in ('owner', 'admin') then
    raise exception 'Only an owner can remove privileged members';
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id;

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
    'workspace.member_removed',
    'profile',
    p_user_id,
    jsonb_build_object('role', target_role)
  );
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
    'schema_version', '0002'
  );
$$;

revoke insert, delete on table public.workspace_members from authenticated;
revoke update (role) on table public.workspace_members from authenticated;
revoke insert, delete on table public.workspace_invites from authenticated;
revoke update (role, status, expires_at)
  on table public.workspace_invites from authenticated;
revoke execute on function public.create_workspace(
  text,
  text,
  text,
  text
) from authenticated;

revoke all on function public.create_workspace_v2(
  text,
  text,
  text,
  text,
  smallint,
  text,
  integer,
  boolean
) from public;
revoke all on function public.get_my_workspaces() from public;
revoke all on function public.get_workspace_members(uuid) from public;
revoke all on function public.create_workspace_invite(
  uuid,
  text,
  public.workspace_role,
  text,
  timestamptz
) from public;
revoke all on function public.preview_workspace_invite(text) from public;
revoke all on function public.accept_workspace_invite(text) from public;
revoke all on function public.revoke_workspace_invite(uuid) from public;
revoke all on function public.change_workspace_member_role(
  uuid,
  uuid,
  public.workspace_role
) from public;
revoke all on function public.remove_workspace_member(uuid, uuid) from public;

grant execute on function public.create_workspace_v2(
  text,
  text,
  text,
  text,
  smallint,
  text,
  integer,
  boolean
) to authenticated;
grant execute on function public.get_my_workspaces() to authenticated;
grant execute on function public.get_workspace_members(uuid)
  to authenticated;
grant execute on function public.create_workspace_invite(
  uuid,
  text,
  public.workspace_role,
  text,
  timestamptz
) to authenticated;
grant execute on function public.preview_workspace_invite(text)
  to authenticated;
grant execute on function public.accept_workspace_invite(text)
  to authenticated;
grant execute on function public.revoke_workspace_invite(uuid)
  to authenticated;
grant execute on function public.change_workspace_member_role(
  uuid,
  uuid,
  public.workspace_role
) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid)
  to authenticated;

comment on function public.create_workspace_v2(
  text,
  text,
  text,
  text,
  smallint,
  text,
  integer,
  boolean
)
is 'Completa el onboarding y crea atómicamente el workspace con su owner.';

comment on function public.accept_workspace_invite(text)
is 'Acepta una invitación solo cuando el token y el correo autenticado coinciden.';

commit;
