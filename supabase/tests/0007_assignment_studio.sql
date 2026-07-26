-- Verificación transaccional del Bloque 09. No conserva datos.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
(
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-4000-8000-000000000009',
  'authenticated', 'authenticated', 'assignment-owner@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Assignment Owner"}'::jsonb, now(), now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '92000000-0000-4000-8000-000000000009',
  'authenticated', 'authenticated', 'assignment-planner@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Assignment Planner"}'::jsonb, now(), now()
);

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000009',
  true
);
select set_config(
  'request.jwt.claim.email',
  'assignment-owner@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_workspace_v2(
  'Assignment Studio Test', 'assignment-studio-test',
  'America/Mexico_City', 'days', 40, 'manual', 365, true
);

reset role;

insert into public.profiles (id, display_name)
values (
  '92000000-0000-4000-8000-000000000009',
  'Assignment Planner'
)
on conflict (id) do update set display_name = excluded.display_name;

insert into public.workspace_members (workspace_id, user_id, role)
values (
  (
    select id from public.workspaces
    where slug = 'assignment-studio-test'
  ),
  '92000000-0000-4000-8000-000000000009',
  'planner'
);

set local role authenticated;

select public.save_capture_session(
  '93000000-0000-4000-8000-000000000009',
  (
    select id from public.get_my_workspaces()
    where slug = 'assignment-studio-test'
  ),
  'plan',
  'Preparar integración de pagos con criterios y revisión.',
  'ready', 'manual', '{}'::jsonb
);

select public.create_ticket_from_capture(
  (
    select id from public.get_my_workspaces()
    where slug = 'assignment-studio-test'
  ),
  '93000000-0000-4000-8000-000000000009',
  '{
    "title":"Preparar integración de pagos",
    "objective":"Cobrar de forma segura",
    "problem":"No existe integración",
    "context":"Checkout disponible",
    "expectedOutcome":"Pago verificable",
    "scope":["Checkout"],
    "outOfScope":["Suscripciones"],
    "functionalRequirements":["Crear pago"],
    "technicalRequirements":["Webhook"],
    "constraints":["PCI"],
    "acceptanceCriteria":["Pago aprobado","Error recuperable"],
    "risks":["Duplicados"],
    "assumptions":["Proveedor activo"],
    "unknowns":["Definir reintentos"],
    "dependencies":["Proveedor"],
    "labels":["pagos"],
    "priority":"high",
    "targetDate":"",
    "subtasks":["Integrar","Verificar"],
    "status":"ready"
  }'::jsonb
);

select public.save_ticket_estimate(
  (
    select id from public.tickets
    where source_capture_id = '93000000-0000-4000-8000-000000000009'
  ),
  '{
    "unit":"days",
    "scenarios":{
      "favorable":{"key":"favorable","label":"Favorable","low":2,"high":3,"explanation":"Sin bloqueos"},
      "probable":{"key":"probable","label":"Probable","low":3,"high":5,"explanation":"Ritmo esperado"},
      "adverse":{"key":"adverse","label":"Adverso","low":5,"high":8,"explanation":"Con retrabajo"}
    },
    "confidence":"medium",
    "basis":"Cálculo determinista con revisión manual.",
    "decomposition":[
      {"label":"Implementación","effortShare":70,"basis":"Construcción"},
      {"label":"Verificación","effortShare":30,"basis":"Pruebas"}
    ],
    "assumptions":["Proveedor activo"],
    "unknowns":["Reintentos"],
    "risks":["Duplicados"],
    "dependencies":["Proveedor"],
    "historicalReferences":["Sin comparables"],
    "factors":[
      {"key":"risk","label":"Riesgo","direction":"increases","weight":2,"evidence":"Pagos duplicados"}
    ],
    "calculationSnapshot":{"complexityScore":12,"capacityHoursPerWeek":40,"comparableCount":0},
    "engineKind":"local_rules",
    "engineVersion":"tr-estimate-1"
  }'::jsonb
);

select public.confirm_assignment_plan(
  (
    select id from public.tickets
    where source_capture_id = '93000000-0000-4000-8000-000000000009'
  ),
  jsonb_build_object(
    'strategy', 'balanced_load',
    'label', 'Carga equilibrada',
    'summary', 'Distribución verificable.',
    'estimateId', (
      select id from public.estimates
      where ticket_id = (
        select id from public.tickets
        where source_capture_id = '93000000-0000-4000-8000-000000000009'
      )
      and is_current
    ),
    'range', jsonb_build_object('low', 3, 'high', 5, 'unit', 'days'),
    'confidence', 'medium',
    'participants', jsonb_build_array(
      jsonb_build_object(
        'userId', '92000000-0000-4000-8000-000000000009',
        'displayName', 'Assignment Planner',
        'participationRole', 'responsible',
        'contributionPercent', 60,
        'reason', 'Menor carga visible.'
      ),
      jsonb_build_object(
        'userId', '91000000-0000-4000-8000-000000000009',
        'displayName', 'Assignment Owner',
        'participationRole', 'collaborator',
        'contributionPercent', 40,
        'reason', 'Conserva continuidad.'
      )
    ),
    'resultingLoad', jsonb_build_object(
      'level', 'medium',
      'percentage', 60,
      'label', 'Moderada · 60%',
      'basis', 'Capacidad declarada.'
    ),
    'knowledgeConcentration', 'medium',
    'rationale', 'Distribuye trabajo según carga confirmada visible.',
    'risks', jsonb_build_array('Disponibilidad individual no declarada.'),
    'discardedAlternatives', jsonb_build_array(
      'Entrega rápida concentra contexto.'
    ),
    'changeConsequence', 'Concentrar el trabajo aumenta la carga.',
    'evidence', jsonb_build_array(
      jsonb_build_object(
        'signal', 'Capacidad',
        'status', 'used',
        'detail', '40 horas declaradas.'
      )
    ),
    'evidenceLimitations', jsonb_build_array(
      'Sin habilidades individuales declaradas.'
    ),
    'engineKind', 'local_rules',
    'engineVersion', 'tr-assignment-1'
  )
);

select
  'assignment_plan_created' as test,
  count(*) = 1
    and (
      select count(*) from public.assignment_plan_participants
    ) = 2
    and (
      select sum(contribution_percent)
      from public.assignment_plan_participants
    ) = 100
    as passed
from public.assignment_plans
where is_current;

select
  'ticket_is_planned' as test,
  status = 'planned' as passed
from public.tickets
where source_capture_id = '93000000-0000-4000-8000-000000000009';

reset role;
rollback;

