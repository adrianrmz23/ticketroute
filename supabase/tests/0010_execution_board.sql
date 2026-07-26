-- Verificación transaccional del Bloque 12. No conserva datos.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'c1000000-0000-4000-8000-000000000012',
  'authenticated', 'authenticated', 'execution-owner@ticketroute.test',
  crypt('not-a-real-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Execution Owner"}'::jsonb, now(), now()
);

insert into public.workspaces (
  id, name, slug, created_by, onboarding_completed_at
) values (
  'c2000000-0000-4000-8000-000000000012',
  'Execution Test',
  'execution-test',
  'c1000000-0000-4000-8000-000000000012',
  now()
);

insert into public.workspace_members (workspace_id, user_id, role)
values (
  'c2000000-0000-4000-8000-000000000012',
  'c1000000-0000-4000-8000-000000000012',
  'owner'
);

insert into public.tickets (
  id, workspace_id, created_by, title, objective, status
) values (
  'c3000000-0000-4000-8000-000000000012',
  'c2000000-0000-4000-8000-000000000012',
  'c1000000-0000-4000-8000-000000000012',
  'Ejecutar un recorrido verificable',
  'Entregar un resultado reproducible',
  'planned'
);

insert into public.estimates (
  id, workspace_id, ticket_id, version, unit,
  favorable_low, favorable_high, probable_low, probable_high,
  adverse_low, adverse_high, confidence, basis, created_by
) values (
  'c4000000-0000-4000-8000-000000000012',
  'c2000000-0000-4000-8000-000000000012',
  'c3000000-0000-4000-8000-000000000012',
  1, 'days', 2, 3, 3, 5, 5, 8, 'medium',
  'Rango confirmado para prueba.',
  'c1000000-0000-4000-8000-000000000012'
);

insert into public.assignment_plans (
  id, workspace_id, ticket_id, estimate_id, version, strategy,
  range_low, range_high, unit, confidence, resulting_load_percent,
  resulting_load_level, knowledge_concentration, rationale,
  change_consequence, created_by
) values (
  'c5000000-0000-4000-8000-000000000012',
  'c2000000-0000-4000-8000-000000000012',
  'c3000000-0000-4000-8000-000000000012',
  'c4000000-0000-4000-8000-000000000012',
  1, 'balanced_load', 3, 5, 'days', 'medium', 50,
  'medium', 'low', 'Responsabilidad confirmada.',
  'La capacidad permanece visible.',
  'c1000000-0000-4000-8000-000000000012'
);

insert into public.planning_guides (
  id, workspace_id, ticket_id, estimate_id, assignment_plan_id, version,
  objective, sequence_rationale, verification_strategy, created_by
) values (
  'c6000000-0000-4000-8000-000000000012',
  'c2000000-0000-4000-8000-000000000012',
  'c3000000-0000-4000-8000-000000000012',
  'c4000000-0000-4000-8000-000000000012',
  'c5000000-0000-4000-8000-000000000012',
  1,
  'Ejecutar un recorrido con evidencia.',
  'Preparar, construir y verificar el resultado.',
  'Cada cierre necesita una comprobación.',
  'c1000000-0000-4000-8000-000000000012'
);

insert into public.planning_guide_steps (
  id, workspace_id, planning_guide_id, position, phase, title, outcome,
  responsible_user_id, effort_share, verification, source_kind, source_label
) values
(
  'c7100000-0000-4000-8000-000000000012',
  'c2000000-0000-4000-8000-000000000012',
  'c6000000-0000-4000-8000-000000000012',
  0, 'prepare', 'Preparar alcance', 'Alcance acordado',
  'c1000000-0000-4000-8000-000000000012',
  20, 'Límites revisados', 'ticket', 'Alcance'
),
(
  'c7200000-0000-4000-8000-000000000012',
  'c2000000-0000-4000-8000-000000000012',
  'c6000000-0000-4000-8000-000000000012',
  1, 'build', 'Construir resultado', 'Resultado funcional',
  'c1000000-0000-4000-8000-000000000012',
  55, 'Caso principal demostrado', 'subtask', 'Implementar'
),
(
  'c7300000-0000-4000-8000-000000000012',
  'c2000000-0000-4000-8000-000000000012',
  'c6000000-0000-4000-8000-000000000012',
  2, 'verify', 'Verificar resultado', 'Resultado comprobado',
  'c1000000-0000-4000-8000-000000000012',
  25, 'Criterio reproducido', 'criterion', 'Aceptación'
);

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000012',
  true
);
select set_config(
  'request.jwt.claim.email',
  'execution-owner@ticketroute.test',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.start_execution_run(
  'c3000000-0000-4000-8000-000000000012',
  'c6000000-0000-4000-8000-000000000012'
);

select
  'guide_is_copied_without_mutation' as test,
  count(*) = 3
    and sum(effort_share) = 100
    and bool_and(status = 'pending')
    and (
      select status
      from public.tickets
      where id = 'c3000000-0000-4000-8000-000000000012'
    ) = 'in_progress'
    as passed
from public.execution_steps;

select public.update_execution_step(id, 'in_progress', '', '')
from public.execution_steps
where planning_guide_step_id = 'c7100000-0000-4000-8000-000000000012'
  and status = 'pending';
select public.update_execution_step(
  id, 'done', 'Alcance revisado con el equipo.', ''
)
from public.execution_steps
where planning_guide_step_id = 'c7100000-0000-4000-8000-000000000012';

select public.update_execution_step(
  id, 'blocked', '', 'Falta acceso al entorno de prueba.'
)
from public.execution_steps
where planning_guide_step_id = 'c7200000-0000-4000-8000-000000000012';

select
  'blocker_propagates_to_run_and_ticket' as test,
  (
    select status from public.execution_runs
    where planning_guide_id = 'c6000000-0000-4000-8000-000000000012'
  ) = 'blocked'
  and (
    select status from public.tickets
    where id = 'c3000000-0000-4000-8000-000000000012'
  ) = 'blocked'
  as passed;

select public.update_execution_step(id, 'in_progress', '', '')
from public.execution_steps
where planning_guide_step_id = 'c7200000-0000-4000-8000-000000000012';
select public.update_execution_step(
  id, 'done', 'Resultado probado de forma reproducible.', ''
)
from public.execution_steps
where planning_guide_step_id = 'c7200000-0000-4000-8000-000000000012';
select public.update_execution_step(
  id, 'skipped', 'Criterio cubierto por la prueba anterior.', ''
)
from public.execution_steps
where planning_guide_step_id = 'c7300000-0000-4000-8000-000000000012';

select
  'all_resolved_steps_close_the_run' as test,
  status = 'completed'
    and completed_at is not null
    and (
      select status from public.tickets
      where id = 'c3000000-0000-4000-8000-000000000012'
    ) = 'done'
    and (
      select sum(effort_share)
      from public.execution_steps
      where execution_run_id = public.execution_runs.id
        and status in ('done', 'skipped')
    ) = 100
    as passed
from public.execution_runs
where planning_guide_id = 'c6000000-0000-4000-8000-000000000012';

select
  'events_are_append_only_and_audit_is_minimal' as test,
  (select count(*) from public.execution_step_events) = 6
  and count(*) = 7
  and bool_and(not (metadata ? 'evidence_note'))
  and bool_and(not (metadata ? 'blocker_note'))
  as passed
from public.audit_events
where action in ('execution.started', 'execution.step_updated');

reset role;
rollback;
