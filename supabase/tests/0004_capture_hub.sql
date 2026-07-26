-- Verificación manual del Bloque 06.
-- Ejecuta el archivo completo después de 20260726020000_capture_hub.sql.
-- El ROLLBACK final elimina todos los datos temporales.

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
values (
  '00000000-0000-0000-0000-000000000000',
  '50000000-0000-4000-8000-000000000005',
  'authenticated',
  'authenticated',
  'capture-owner@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Capture Owner"}'::jsonb,
  now(),
  now()
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-4000-8000-000000000005',
  true
);
select set_config(
  'request.jwt.claim.email',
  'capture-owner@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_workspace_v2(
  'Capture Hub Test',
  'capture-hub-test',
  'America/Mexico_City',
  'days',
  40,
  'manual',
  365,
  true
);

select public.save_capture_session(
  '60000000-0000-4000-8000-000000000006',
  (
    select id
    from public.get_my_workspaces()
    where slug = 'capture-hub-test'
  ),
  'plan',
  'Necesitamos agregar inicio de sesión con Google antes del viernes.',
  'ready',
  'manual',
  '{"test":true}'::jsonb
);

select
  'ready_capture_is_visible' as test,
  count(*) = 1 as passed
from public.capture_sessions
where id = '60000000-0000-4000-8000-000000000006'
  and status = 'ready';

select public.record_capture_consent(
  (
    select id
    from public.get_my_workspaces()
    where slug = 'capture-hub-test'
  ),
  '60000000-0000-4000-8000-000000000006',
  'microphone',
  'granted',
  '{"audio_persisted":false}'::jsonb
);

select
  'microphone_consent_is_append_only' as test,
  count(*) = 1 as passed
from public.consent_records
where capture_session_id = '60000000-0000-4000-8000-000000000006'
  and decision = 'granted';

select public.archive_capture_session(
  '60000000-0000-4000-8000-000000000006'
);

select
  'capture_can_be_archived' as test,
  status = 'archived' as passed
from public.capture_sessions
where id = '60000000-0000-4000-8000-000000000006';

reset role;
rollback;
