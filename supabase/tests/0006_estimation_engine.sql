-- Verificación transaccional del Bloque 08. No conserva datos.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '81000000-0000-4000-8000-000000000008',
  'authenticated', 'authenticated', 'estimate-owner@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Estimate Owner"}'::jsonb, now(), now()
);

select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000008',
  true
);
select set_config(
  'request.jwt.claim.email',
  'estimate-owner@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_workspace_v2(
  'Estimate Engine Test', 'estimate-engine-test',
  'America/Mexico_City', 'days', 40, 'manual', 365, true
);

select public.save_capture_session(
  '82000000-0000-4000-8000-000000000008',
  (select id from public.get_my_workspaces() where slug = 'estimate-engine-test'),
  'plan',
  'Necesitamos agregar inicio de sesión con Google antes del viernes.',
  'ready', 'manual', '{}'::jsonb
);

select public.create_ticket_from_capture(
  (select id from public.get_my_workspaces() where slug = 'estimate-engine-test'),
  '82000000-0000-4000-8000-000000000008',
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
    "acceptanceCriteria":["El usuario puede acceder","El error es recuperable"],
    "risks":["Usuarios existentes"],
    "assumptions":["Frontend listo"],
    "unknowns":["Definir usuarios existentes"],
    "dependencies":["Proveedor OAuth"],
    "labels":["autenticación"],
    "priority":"high",
    "targetDate":"",
    "subtasks":["Configurar proveedor","Verificar acceso"],
    "status":"needs_context"
  }'::jsonb
);

select public.save_ticket_estimate(
  (select id from public.tickets
   where source_capture_id = '82000000-0000-4000-8000-000000000008'),
  '{
    "unit":"days",
    "scenarios":{
      "favorable":{"key":"favorable","label":"Favorable","low":2,"high":3,"explanation":"Sin bloqueos"},
      "probable":{"key":"probable","label":"Probable","low":3,"high":5,"explanation":"Ritmo esperado"},
      "adverse":{"key":"adverse","label":"Adverso","low":6,"high":9,"explanation":"Con retrabajo"}
    },
    "confidence":"medium",
    "basis":"Cálculo determinista con revisión manual.",
    "decomposition":[
      {"label":"Implementación","effortShare":70,"basis":"Construcción"},
      {"label":"Verificación","effortShare":30,"basis":"Pruebas"}
    ],
    "assumptions":["Frontend listo"],
    "unknowns":["Usuarios existentes"],
    "risks":["Migración"],
    "dependencies":["Proveedor OAuth"],
    "historicalReferences":["Sin referencias comparables"],
    "factors":[
      {"key":"risk","label":"Riesgo","direction":"increases","weight":2,"evidence":"Migración de usuarios"}
    ],
    "calculationSnapshot":{"complexityScore":12,"capacityHoursPerWeek":40,"comparableCount":0},
    "engineKind":"local_rules",
    "engineVersion":"tr-estimate-1"
  }'::jsonb
);

select
  'estimate_relations_created' as test,
  count(*) = 1
    and (select count(*) from public.estimate_factors) = 1
    and (select sum(effort_share) from public.estimate_breakdown) = 100
    as passed
from public.estimates
where is_current;

select
  'estimate_is_a_range' as test,
  favorable_low < favorable_high
    and probable_low < probable_high
    and adverse_low < adverse_high
    and favorable_high <= probable_high
    and probable_high <= adverse_high
    as passed
from public.estimates
where is_current;

reset role;
rollback;

