begin;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.workspace_role as enum (
    'owner',
    'admin',
    'planner',
    'member',
    'viewer'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.invite_status as enum (
    'pending',
    'accepted',
    'revoked',
    'expired'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (
    display_name is null or char_length(display_name) between 1 and 80
  ),
  avatar_url text,
  locale text not null default 'es-MX',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) between 2 and 48
  ),
  timezone text not null default 'UTC',
  estimation_unit text not null default 'days'
    check (estimation_unit in ('hours', 'days', 'points')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  email text not null check (
    email = lower(email)
    and char_length(email) between 3 and 320
  ),
  role public.workspace_role not null default 'member'
    check (role <> 'owner'),
  status public.invite_status not null default 'pending',
  token_hash text not null unique check (char_length(token_hash) >= 32),
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or
    (status <> 'accepted')
  )
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 3 and 120),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);

create index if not exists workspace_invites_workspace_status_idx
  on public.workspace_invites (workspace_id, status);

create unique index if not exists workspace_invites_pending_email_idx
  on public.workspace_invites (workspace_id, email)
  where status = 'pending';

create index if not exists audit_events_workspace_created_at_idx
  on public.audit_events (workspace_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists workspace_members_set_updated_at
  on public.workspace_members;
create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

drop trigger if exists workspace_invites_set_updated_at
  on public.workspace_invites;
create trigger workspace_invites_set_updated_at
before update on public.workspace_invites
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name, avatar_url)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(users.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(users.email, ''), '@', 1)
  ),
  nullif(users.raw_user_meta_data ->> 'avatar_url', '')
from auth.users as users
on conflict (id) do nothing;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.has_workspace_role(
  p_workspace_id uuid,
  p_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = (select auth.uid())
      and role = any(p_roles)
  );
$$;

create or replace function public.guard_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_count integer;
begin
  if tg_op = 'DELETE' and not exists (
    select 1
    from public.workspaces
    where id = old.workspace_id
  ) then
    return old;
  end if;

  if tg_op = 'UPDATE'
    and (
      new.workspace_id <> old.workspace_id
      or new.user_id <> old.user_id
    )
  then
    raise exception 'Membership identity cannot be changed';
  end if;

  if old.role = 'owner' then
    if not public.has_workspace_role(
      old.workspace_id,
      array['owner']::public.workspace_role[]
    ) then
      raise exception 'Only an owner can change an owner membership';
    end if;

    if tg_op = 'DELETE' or new.role <> 'owner' then
      select count(*)
      into owner_count
      from public.workspace_members
      where workspace_id = old.workspace_id
        and role = 'owner'
        and user_id <> old.user_id;

      if owner_count = 0 then
        raise exception 'A workspace must keep at least one owner';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE'
    and new.role = 'owner'
    and old.role <> 'owner'
    and not public.has_workspace_role(
      old.workspace_id,
      array['owner']::public.workspace_role[]
    )
  then
    raise exception 'Only an owner can promote another owner';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_members_guard_owner
  on public.workspace_members;
create trigger workspace_members_guard_owner
before update or delete on public.workspace_members
for each row execute function public.guard_workspace_owner();

create or replace function public.create_workspace(
  p_name text,
  p_slug text,
  p_timezone text default 'UTC',
  p_estimation_unit text default 'days'
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

  if not exists (
    select 1 from pg_catalog.pg_timezone_names
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
    created_by
  )
  values (
    normalized_name,
    normalized_slug,
    p_timezone,
    p_estimation_unit,
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
    'workspace.created',
    'workspace',
    new_workspace_id,
    jsonb_build_object('slug', normalized_slug)
  );

  return new_workspace_id;
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
    'schema_version', '0001'
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin
on public.workspaces
for update
to authenticated
using (
  public.has_workspace_role(
    id,
    array['owner', 'admin']::public.workspace_role[]
  )
)
with check (
  public.has_workspace_role(
    id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner
on public.workspaces
for delete
to authenticated
using (
  public.has_workspace_role(
    id,
    array['owner']::public.workspace_role[]
  )
);

drop policy if exists workspace_members_select_member
  on public.workspace_members;
create policy workspace_members_select_member
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert_admin
  on public.workspace_members;
create policy workspace_members_insert_admin
on public.workspace_members
for insert
to authenticated
with check (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
  and (
    role <> 'owner'
    or public.has_workspace_role(
      workspace_id,
      array['owner']::public.workspace_role[]
    )
  )
);

drop policy if exists workspace_members_update_admin
  on public.workspace_members;
create policy workspace_members_update_admin
on public.workspace_members
for update
to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
)
with check (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

drop policy if exists workspace_members_delete_admin
  on public.workspace_members;
create policy workspace_members_delete_admin
on public.workspace_members
for delete
to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

drop policy if exists workspace_invites_select_admin
  on public.workspace_invites;
create policy workspace_invites_select_admin
on public.workspace_invites
for select
to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

drop policy if exists workspace_invites_insert_admin
  on public.workspace_invites;
create policy workspace_invites_insert_admin
on public.workspace_invites
for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and status = 'pending'
  and accepted_by is null
  and accepted_at is null
  and public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

drop policy if exists workspace_invites_update_admin
  on public.workspace_invites;
create policy workspace_invites_update_admin
on public.workspace_invites
for update
to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
)
with check (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

drop policy if exists workspace_invites_delete_admin
  on public.workspace_invites;
create policy workspace_invites_delete_admin
on public.workspace_invites
for delete
to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
);

drop policy if exists audit_events_select_member
  on public.audit_events;
create policy audit_events_select_member
on public.audit_events
for select
to authenticated
using (public.is_workspace_member(workspace_id));

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.workspaces from public, anon, authenticated;
revoke all on table public.workspace_members from public, anon, authenticated;
revoke all on table public.workspace_invites from public, anon, authenticated;
revoke all on table public.audit_events from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url, locale)
  on table public.profiles to authenticated;

grant select on table public.workspaces to authenticated;
grant update (name, slug, timezone, estimation_unit)
  on table public.workspaces to authenticated;
grant delete on table public.workspaces to authenticated;

grant select, insert, delete
  on table public.workspace_members to authenticated;
grant update (role)
  on table public.workspace_members to authenticated;
grant select, insert, delete
  on table public.workspace_invites to authenticated;
grant update (role, status, expires_at)
  on table public.workspace_invites to authenticated;
grant select on table public.audit_events to authenticated;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(
  uuid,
  public.workspace_role[]
) from public;
revoke all on function public.create_workspace(
  text,
  text,
  text,
  text
) from public;
revoke all on function public.healthcheck() from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.guard_workspace_owner() from public;

grant execute on function public.is_workspace_member(uuid)
  to authenticated;
grant execute on function public.has_workspace_role(
  uuid,
  public.workspace_role[]
) to authenticated;
grant execute on function public.create_workspace(
  text,
  text,
  text,
  text
) to authenticated;
grant execute on function public.healthcheck() to anon, authenticated;

comment on function public.create_workspace(text, text, text, text)
is 'Crea un workspace y su owner dentro de una sola transacción.';

comment on table public.audit_events
is 'Registro append-oriented; los clientes solo pueden consultar eventos de sus workspaces.';

commit;
