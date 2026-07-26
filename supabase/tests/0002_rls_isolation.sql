-- Prueba de aislamiento multiworkspace.
-- Crea dos identidades y dos workspaces SOLO dentro de una transacción.
-- El ROLLBACK final elimina todos los datos de prueba.

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
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'rls-owner-a@ticketroute.test',
    crypt('not-a-real-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"RLS Owner A"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'rls-owner-b@ticketroute.test',
    crypt('not-a-real-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"RLS Owner B"}'::jsonb,
    now(),
    now()
  );

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_workspace(
  'RLS Workspace A',
  'rls-test-a',
  'America/Mexico_City',
  'days'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_workspace(
  'RLS Workspace B',
  'rls-test-b',
  'America/Mexico_City',
  'days'
);

select
  'owner_b_cannot_read_workspace_a' as test,
  not exists (
    select 1
    from public.workspaces
    where slug = 'rls-test-a'
  ) as passed;

select
  'owner_b_reads_only_own_membership' as test,
  count(*) = 1 as passed
from public.workspace_members;

reset role;
rollback;
