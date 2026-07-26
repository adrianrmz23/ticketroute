-- Verificación transaccional del Bloque 11. No conserva datos.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
(
  '00000000-0000-0000-0000-000000000000',
  'b1000000-0000-4000-8000-000000000011',
  'authenticated', 'authenticated', 'guide-owner@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Guide Owner"}'::jsonb, now(), now()
),
(
  '00000000-0000-0000-0000-000000000000',
  'b2000000-0000-4000-8000-000000000011',
  'authenticated', 'authenticated', 'guide-planner@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Guide Planner"}'::jsonb, now(), now()
);

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000011',
  true
);
select set_config(
  'request.jwt.claim.email',
  'guide-owner@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.create_workspace_v2(
  'Planning Guide Test', 'planning-guide-test',
  'America/Mexico_City', 'days', 40, 'manual', 365, true
);

reset role;

insert into public.profiles (id, display_name)
values (
  'b2000000-0000-4000-8000-000000000011',
  'Guide Planner'
)
on conflict (id) do update set display_name = excluded.display_name;

insert into public.workspace_members (workspace_id, user_id, role)
values (
  (select id from public.workspaces where slug = 'planning-guide-test'),
  'b2000000-0000-4000-8000-000000000011',
  'planner'
);

set local role authenticated;

select public.save_capture_session(
  'b3000000-0000-4000-8000-000000000011',
  (
    select id from public.get_my_workspaces()
    where slug = 'planning-guide-test'
  ),
  'plan',
  'Preparar integración verificable de pagos.',
  'ready', 'manual', '{}'::jsonb
);

select public.create_ticket_from_capture(
  (
    select id from public.get_my_workspaces()
    where slug = 'planning-guide-test'
  ),
  'b3000000-0000-4000-8000-000000000011',
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
    where source_capture_id = 'b3000000-0000-4000-8000-000000000011'
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
    where source_capture_id = 'b3000000-0000-4000-8000-000000000011'
  ),
  jsonb_build_object(
    'strategy', 'balanced_load',
    'label', 'Carga equilibrada',
    'summary', 'Distribución verificable.',
    'estimateId', (
      select id from public.estimates
      where ticket_id = (
        select id from public.tickets
        where source_capture_id = 'b3000000-0000-4000-8000-000000000011'
      )
      and is_current
    ),
    'range', jsonb_build_object('low', 3, 'high', 5, 'unit', 'days'),
    'confidence', 'medium',
    'participants', jsonb_build_array(
      jsonb_build_object(
        'userId', 'b2000000-0000-4000-8000-000000000011',
        'displayName', 'Guide Planner',
        'participationRole', 'responsible',
        'contributionPercent', 60,
        'reason', 'Responsabilidad confirmada.'
      ),
      jsonb_build_object(
        'userId', 'b1000000-0000-4000-8000-000000000011',
        'displayName', 'Guide Owner',
        'participationRole', 'collaborator',
        'contributionPercent', 40,
        'reason', 'Revisión confirmada.'
      )
    ),
    'resultingLoad', jsonb_build_object(
      'level', 'medium',
      'percentage', 60,
      'label', 'Moderada · 60%',
      'basis', 'Capacidad declarada.'
    ),
    'knowledgeConcentration', 'medium',
    'rationale', 'Distribuye el trabajo con una revisión independiente.',
    'risks', jsonb_build_array('Disponibilidad sujeta a revisión.'),
    'discardedAlternatives', jsonb_build_array('Concentración individual.'),
    'changeConsequence', 'El contexto se conserva entre dos personas.',
    'evidence', jsonb_build_array(
      jsonb_build_object(
        'signal', 'Capacidad',
        'status', 'used',
        'detail', 'Disponibilidad declarada.'
      )
    ),
    'evidenceLimitations', jsonb_build_array('Sin telemetría individual.'),
    'engineKind', 'local_rules',
    'engineVersion', 'tr-assignment-2'
  )
);

select public.confirm_planning_guide(
  (
    select id from public.tickets
    where source_capture_id = 'b3000000-0000-4000-8000-000000000011'
  ),
  jsonb_build_object(
    'ticketId', (
      select id from public.tickets
      where source_capture_id = 'b3000000-0000-4000-8000-000000000011'
    ),
    'estimateId', (
      select id from public.estimates
      where ticket_id = (
        select id from public.tickets
        where source_capture_id = 'b3000000-0000-4000-8000-000000000011'
      )
      and is_current
    ),
    'assignmentPlanId', (
      select id from public.assignment_plans
      where ticket_id = (
        select id from public.tickets
        where source_capture_id = 'b3000000-0000-4000-8000-000000000011'
      )
      and is_current
    ),
    'objective', 'Entregar un pago seguro y verificable.',
    'sequenceRationale',
      'Primero se despejan dependencias, luego se construye y al final se verifica.',
    'verificationStrategy',
      'Cada paso conserva una comprobación reproducible.',
    'estimateRange', jsonb_build_object(
      'low', 3, 'high', 5, 'unit', 'days'
    ),
    'steps', jsonb_build_array(
      jsonb_build_object(
        'localId', 'step-prepare',
        'position', 0,
        'phase', 'prepare',
        'title', 'Asegurar proveedor',
        'outcome', 'Proveedor disponible con alternativa documentada.',
        'responsibleUserId', 'b2000000-0000-4000-8000-000000000011',
        'responsibleName', 'Guide Planner',
        'effortShare', 20,
        'verification', 'Credenciales y respuesta de prueba verificadas.',
        'dependencies', jsonb_build_array('Proveedor'),
        'risks', jsonb_build_array('Indisponibilidad'),
        'sourceKind', 'dependency',
        'sourceLabel', 'Proveedor'
      ),
      jsonb_build_object(
        'localId', 'step-build',
        'position', 1,
        'phase', 'build',
        'title', 'Crear pago',
        'outcome', 'Pago creado de forma idempotente.',
        'responsibleUserId', 'b2000000-0000-4000-8000-000000000011',
        'responsibleName', 'Guide Planner',
        'effortShare', 55,
        'verification', 'Caso aprobado y reintento quedan demostrados.',
        'dependencies', jsonb_build_array(),
        'risks', jsonb_build_array('Duplicados'),
        'sourceKind', 'subtask',
        'sourceLabel', 'Integrar'
      ),
      jsonb_build_object(
        'localId', 'step-verify',
        'position', 2,
        'phase', 'verify',
        'title', 'Verificar resultado',
        'outcome', 'El criterio de aceptación queda demostrado.',
        'responsibleUserId', 'b1000000-0000-4000-8000-000000000011',
        'responsibleName', 'Guide Owner',
        'effortShare', 25,
        'verification', 'Pago aprobado y error recuperable reproducidos.',
        'dependencies', jsonb_build_array(),
        'risks', jsonb_build_array(),
        'sourceKind', 'criterion',
        'sourceLabel', 'Pago aprobado'
      )
    ),
    'assumptions', jsonb_build_array('Proveedor activo'),
    'evidenceLimitations', jsonb_build_array(
      'La guía no observa actividad individual.'
    ),
    'engineKind', 'local_rules',
    'engineVersion', 'tr-guide-1'
  )
);

select
  'planning_guide_is_versioned_and_complete' as test,
  count(*) = 1
    and bool_and(is_current)
    and max(version) = 1
    and (
      select count(*) from public.planning_guide_steps
    ) = 3
    and (
      select sum(effort_share) from public.planning_guide_steps
    ) = 100
    as passed
from public.planning_guides;

select
  'planning_guide_confirmation_is_scoped_and_audited' as test,
  count(*) = 1
    and bool_and(not (metadata ? 'steps'))
    and bool_and((metadata ->> 'step_count')::integer = 3)
    as passed
from public.audit_events
where action = 'planning_guide.confirmed'
  and workspace_id = (
    select id from public.workspaces where slug = 'planning-guide-test'
  );

reset role;
rollback;
