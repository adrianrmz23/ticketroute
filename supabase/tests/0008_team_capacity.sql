-- Verificación transaccional del Bloque 10. No conserva datos.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
(
  '00000000-0000-0000-0000-000000000000',
  'a1000000-0000-4000-8000-000000000010',
  'authenticated', 'authenticated', 'capacity-owner@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Capacity Owner"}'::jsonb, now(), now()
),
(
  '00000000-0000-0000-0000-000000000000',
  'a2000000-0000-4000-8000-000000000010',
  'authenticated', 'authenticated', 'capacity-member@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Capacity Member"}'::jsonb, now(), now()
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000010',
  true
);
select set_config(
  'request.jwt.claim.email',
  'capacity-owner@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_workspace_v2(
  'Capacity Test', 'capacity-test',
  'America/Mexico_City', 'days', 40, 'manual', 365, true
);

reset role;

insert into public.profiles (id, display_name)
values (
  'a2000000-0000-4000-8000-000000000010',
  'Capacity Member'
)
on conflict (id) do update set display_name = excluded.display_name;

insert into public.workspace_members (workspace_id, user_id, role)
values (
  (select id from public.workspaces where slug = 'capacity-test'),
  'a2000000-0000-4000-8000-000000000010',
  'member'
);

set local role authenticated;

select public.save_member_planning_profile(
  (select id from public.get_my_workspaces() where slug = 'capacity-test'),
  'a2000000-0000-4000-8000-000000000010',
  '{
    "availabilityHours":32,
    "plannedHours":20,
    "skills":["React","TypeScript"],
    "componentExperience":["Checkout"],
    "technicalOwnership":["Frontend"],
    "learningGoals":["PostgreSQL"]
  }'::jsonb
);

select
  'owner_can_declare_member_capacity' as test,
  availability_hours = 32
    and planned_hours = 20
    and skills @> array['React']
    and technical_ownership @> array['Frontend']
    as passed
from public.member_planning_profiles
where user_id = 'a2000000-0000-4000-8000-000000000010';

reset role;
select set_config(
  'request.jwt.claim.sub',
  'a2000000-0000-4000-8000-000000000010',
  true
);
select set_config(
  'request.jwt.claim.email',
  'capacity-member@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.save_member_planning_profile(
  (
    select workspace_id
    from public.workspace_members
    where user_id = 'a2000000-0000-4000-8000-000000000010'
  ),
  'a2000000-0000-4000-8000-000000000010',
  '{
    "availabilityHours":36,
    "plannedHours":24,
    "skills":["React","TypeScript"],
    "componentExperience":["Checkout"],
    "technicalOwnership":["Frontend"],
    "learningGoals":["PostgreSQL","RLS"]
  }'::jsonb
);

select
  'member_can_update_own_declaration' as test,
  availability_hours = 36
    and learning_goals @> array['RLS']
    as passed
from public.member_planning_profiles
where user_id = 'a2000000-0000-4000-8000-000000000010';

select
  'capacity_change_is_audited_without_signal_content' as test,
  count(*) = 2
    and bool_and(not (metadata ? 'skills'))
    as passed
from public.audit_events
where action = 'capacity.profile_saved'
  and workspace_id = (
    select workspace_id
    from public.workspace_members
    where user_id = 'a2000000-0000-4000-8000-000000000010'
  );

rollback;
