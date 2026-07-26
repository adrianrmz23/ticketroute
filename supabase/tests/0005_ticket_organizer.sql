-- Verificación transaccional del Bloque 07. No conserva datos.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '70000000-0000-4000-8000-000000000007',
  'authenticated', 'authenticated', 'ticket-owner@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Ticket Owner"}'::jsonb, now(), now()
);

select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000007',
  true
);
select set_config(
  'request.jwt.claim.email',
  'ticket-owner@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_workspace_v2(
  'Ticket Organizer Test', 'ticket-organizer-test',
  'America/Mexico_City', 'days', 40, 'manual', 365, true
);

select public.save_capture_session(
  '80000000-0000-4000-8000-000000000008',
  (select id from public.get_my_workspaces() where slug = 'ticket-organizer-test'),
  'plan',
  'Necesitamos agregar inicio de sesión con Google antes del viernes.',
  'ready', 'manual', '{}'::jsonb
);

select public.create_ticket_from_capture(
  (select id from public.get_my_workspaces() where slug = 'ticket-organizer-test'),
  '80000000-0000-4000-8000-000000000008',
  '{
    "title":"Agregar inicio de sesión con Google",
    "objective":"Permitir acceso con Google",
    "problem":"Falta el proveedor",
    "context":"Frontend listo",
    "expectedOutcome":"Acceso verificable",
    "scope":["OAuth"],
    "outOfScope":["Otros proveedores"],
    "functionalRequirements":["Iniciar sesión"],
    "technicalRequirements":["OAuth"],
    "constraints":["Antes del viernes"],
    "acceptanceCriteria":["El usuario puede acceder"],
    "risks":["Usuarios existentes"],
    "assumptions":["Frontend listo"],
    "unknowns":["Definir usuarios existentes"],
    "dependencies":[],
    "labels":["autenticación"],
    "priority":"high",
    "targetDate":"",
    "subtasks":["Configurar proveedor"],
    "status":"needs_context"
  }'::jsonb
);

select
  'ticket_and_revision_created' as test,
  count(*) = 1
    and (select count(*) from public.ticket_revisions) = 1 as passed
from public.tickets
where source_capture_id = '80000000-0000-4000-8000-000000000008';

select
  'source_capture_archived' as test,
  status = 'archived' as passed
from public.capture_sessions
where id = '80000000-0000-4000-8000-000000000008';

reset role;
rollback;
