-- Verificación manual del Bloque 05.
-- Ejecuta este archivo completo en SQL Editor después de la migración.
-- Todos los datos se eliminan con el ROLLBACK final.

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'workspace-owner@ticketroute.test',
    crypt('not-a-real-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Workspace Owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '40000000-0000-4000-8000-000000000004',
    'authenticated',
    'workspace-planner@ticketroute.test',
    crypt('not-a-real-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Workspace Planner"}'::jsonb,
    now(),
    now()
  );

select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000003',
  true
);
select set_config(
  'request.jwt.claim.email',
  'workspace-owner@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_workspace_v2(
  'Workspace Access Test',
  'workspace-access-test',
  'America/Mexico_City',
  'days',
  40,
  'manual',
  365,
  true
);

select public.create_workspace_invite(
  (
    select id
    from public.get_my_workspaces()
    where slug = 'workspace-access-test'
  ),
  'workspace-planner@ticketroute.test',
  'planner',
  repeat('a', 64),
  now() + interval '7 days'
);

select
  'owner_sees_workspace' as test,
  count(*) = 1 as passed
from public.get_my_workspaces()
where slug = 'workspace-access-test';

reset role;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-4000-8000-000000000004',
  true
);
select set_config(
  'request.jwt.claim.email',
  'workspace-planner@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select
  'invite_visible_only_to_matching_email' as test,
  count(*) = 1 as passed
from public.preview_workspace_invite(repeat('a', 64));

select public.accept_workspace_invite(repeat('a', 64));

select
  'planner_joined_with_expected_role' as test,
  role = 'planner' as passed
from public.get_my_workspaces()
where slug = 'workspace-access-test';

do $$
declare
  selected_workspace_id uuid;
begin
  select id
  into selected_workspace_id
  from public.get_my_workspaces()
  where slug = 'workspace-access-test';

  begin
    perform public.create_workspace_invite(
      selected_workspace_id,
      'forbidden@ticketroute.test',
      'member',
      repeat('b', 64),
      now() + interval '7 days'
    );
    raise exception 'Planner unexpectedly created an invite';
  exception
    when others then
      if sqlerrm = 'Planner unexpectedly created an invite' then
        raise;
      end if;
  end;
end;
$$;

reset role;
rollback;
