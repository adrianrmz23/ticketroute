begin;

create table if not exists public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null
    check (provider in ('openai', 'anthropic', 'gemini', 'kimi', 'manual')),
  model text not null default '',
  enabled boolean not null default false,
  is_default boolean not null default false,
  secret_configured boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create unique index if not exists ai_provider_one_default_idx
  on public.ai_provider_configs (workspace_id)
  where is_default;

create table if not exists public.council_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 160),
  prompt text not null check (char_length(prompt) between 10 and 12000),
  status text not null default 'completed'
    check (status in ('draft', 'completed', 'failed')),
  providers text[] not null default '{}'
    check (cardinality(providers) between 1 and 4),
  synthesis text not null default ''
    check (char_length(synthesis) <= 12000),
  limitations text[] not null default '{}'
    check (cardinality(limitations) <= 20),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.council_opinions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  council_session_id uuid not null
    references public.council_sessions(id) on delete cascade,
  position integer not null check (position between 1 and 4),
  provider text not null
    check (provider in ('openai', 'anthropic', 'gemini', 'kimi', 'manual')),
  model text not null default '',
  source text not null
    check (source in ('provider', 'local_fallback', 'manual')),
  recommendation text not null check (char_length(recommendation) <= 6000),
  reasoning text not null check (char_length(reasoning) <= 12000),
  risks text[] not null default '{}' check (cardinality(risks) <= 20),
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  unique (council_session_id, position)
);

create index if not exists council_sessions_workspace_idx
  on public.council_sessions (workspace_id, created_at desc);
create index if not exists council_opinions_session_idx
  on public.council_opinions (council_session_id, position);

alter table public.ai_provider_configs enable row level security;
alter table public.council_sessions enable row level security;
alter table public.council_opinions enable row level security;

drop policy if exists ai_provider_configs_select_member
  on public.ai_provider_configs;
create policy ai_provider_configs_select_member
on public.ai_provider_configs
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists council_sessions_select_member
  on public.council_sessions;
create policy council_sessions_select_member
on public.council_sessions
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists council_opinions_select_member
  on public.council_opinions;
create policy council_opinions_select_member
on public.council_opinions
for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.save_ai_provider_config(
  p_workspace_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  next_provider text := p_payload ->> 'provider';
  next_model text := left(btrim(coalesce(p_payload ->> 'model', '')), 120);
  next_enabled boolean := coalesce((p_payload ->> 'enabled')::boolean, false);
  next_default boolean := coalesce((p_payload ->> 'isDefault')::boolean, false);
  next_secret boolean :=
    coalesce((p_payload ->> 'secretConfigured')::boolean, false);
  config_id uuid;
begin
  if current_user_id is null
    or not public.has_workspace_role(
      p_workspace_id,
      array['owner', 'admin']::public.workspace_role[]
    )
  then
    raise exception 'Provider configuration access denied';
  end if;

  if next_provider not in ('openai', 'anthropic', 'gemini', 'kimi', 'manual')
    or (next_provider <> 'manual' and next_model = '')
  then
    raise exception 'Provider configuration is invalid';
  end if;

  if next_default then
    update public.ai_provider_configs
    set is_default = false, updated_at = now()
    where workspace_id = p_workspace_id;
  end if;

  insert into public.ai_provider_configs (
    workspace_id,
    provider,
    model,
    enabled,
    is_default,
    secret_configured,
    created_by
  ) values (
    p_workspace_id,
    next_provider,
    next_model,
    next_enabled,
    next_default,
    case when next_provider = 'manual' then true else next_secret end,
    current_user_id
  )
  on conflict (workspace_id, provider) do update set
    model = excluded.model,
    enabled = excluded.enabled,
    is_default = excluded.is_default,
    secret_configured = excluded.secret_configured,
    updated_at = now()
  returning id into config_id;

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
    'ai_provider.configured',
    'ai_provider_config',
    config_id,
    jsonb_build_object(
      'provider', next_provider,
      'enabled', next_enabled,
      'is_default', next_default,
      'secret_configured', case
        when next_provider = 'manual' then true
        else next_secret
      end
    )
  );

  return config_id;
end;
$$;

create or replace function public.save_council_session(
  p_workspace_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  session_id uuid;
  opinion jsonb;
  provider_names text[];
  limitations text[];
  opinion_count integer :=
    jsonb_array_length(coalesce(p_payload -> 'opinions', '[]'::jsonb));
begin
  if current_user_id is null
    or not public.has_workspace_role(
      p_workspace_id,
      array['owner', 'admin', 'planner', 'member']::public.workspace_role[]
    )
  then
    raise exception 'Council access denied';
  end if;

  if char_length(btrim(coalesce(p_payload ->> 'title', ''))) not between 3 and 160
    or char_length(btrim(coalesce(p_payload ->> 'prompt', ''))) not between 10 and 12000
    or opinion_count not between 1 and 4
  then
    raise exception 'Council payload is invalid';
  end if;

  select coalesce(array_agg(value), '{}')
  into provider_names
  from jsonb_array_elements_text(
    coalesce(p_payload -> 'providers', '[]'::jsonb)
  );

  select coalesce(array_agg(left(btrim(value), 500)), '{}')
  into limitations
  from jsonb_array_elements_text(
    coalesce(p_payload -> 'limitations', '[]'::jsonb)
  )
  where char_length(btrim(value)) > 0;

  insert into public.council_sessions (
    workspace_id,
    requested_by,
    title,
    prompt,
    status,
    providers,
    synthesis,
    limitations,
    completed_at
  ) values (
    p_workspace_id,
    current_user_id,
    left(btrim(p_payload ->> 'title'), 160),
    left(btrim(p_payload ->> 'prompt'), 12000),
    'completed',
    provider_names,
    left(btrim(coalesce(p_payload ->> 'synthesis', '')), 12000),
    limitations,
    now()
  )
  returning id into session_id;

  for opinion in
    select value
    from jsonb_array_elements(p_payload -> 'opinions')
  loop
    insert into public.council_opinions (
      workspace_id,
      council_session_id,
      position,
      provider,
      model,
      source,
      recommendation,
      reasoning,
      risks,
      confidence
    ) values (
      p_workspace_id,
      session_id,
      least(greatest((opinion ->> 'position')::integer, 1), 4),
      opinion ->> 'provider',
      left(btrim(coalesce(opinion ->> 'model', '')), 120),
      opinion ->> 'source',
      left(btrim(coalesce(opinion ->> 'recommendation', '')), 6000),
      left(btrim(coalesce(opinion ->> 'reasoning', '')), 12000),
      coalesce(
        array(
          select left(btrim(value), 500)
          from jsonb_array_elements_text(
            coalesce(opinion -> 'risks', '[]'::jsonb)
          )
          where char_length(btrim(value)) > 0
          limit 20
        ),
        '{}'
      ),
      coalesce(opinion ->> 'confidence', 'medium')
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
    p_workspace_id,
    current_user_id,
    'council.completed',
    'council_session',
    session_id,
    jsonb_build_object(
      'providers', provider_names,
      'opinion_count', opinion_count
    )
  );

  return session_id;
end;
$$;

create or replace function public.healthcheck()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok', 'checked_at', now(), 'schema_version', '0011'
  );
$$;

revoke all on table public.ai_provider_configs
  from public, anon, authenticated;
revoke all on table public.council_sessions
  from public, anon, authenticated;
revoke all on table public.council_opinions
  from public, anon, authenticated;
grant select on table public.ai_provider_configs to authenticated;
grant select on table public.council_sessions to authenticated;
grant select on table public.council_opinions to authenticated;
revoke all on function public.save_ai_provider_config(uuid, jsonb) from public;
revoke all on function public.save_council_session(uuid, jsonb) from public;
grant execute on function public.save_ai_provider_config(uuid, jsonb)
  to authenticated;
grant execute on function public.save_council_session(uuid, jsonb)
  to authenticated;

comment on table public.ai_provider_configs is
  'Metadatos de proveedores. Las claves reales viven exclusivamente en variables del servidor.';
comment on table public.council_opinions is
  'Opiniones independientes con su proveedor y origen explícitos; el fallback nunca se presenta como IA externa.';

commit;
notify pgrst, 'reload schema';
