-- Verificación estructural de los esquemas 0010–0013. No conserva datos.
begin;

select
  'closure_tables_exist' as test,
  count(*) = 11 as passed
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'calibration_records',
    'ai_provider_configs',
    'council_sessions',
    'council_opinions',
    'notification_preferences',
    'notifications',
    'workspace_integrations',
    'integration_events',
    'privacy_requests',
    'background_jobs',
    'execution_steps'
  );

select
  'closure_rls_is_enabled' as test,
  count(*) = 10 and bool_and(relrowsecurity) as passed
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'calibration_records',
    'ai_provider_configs',
    'council_sessions',
    'council_opinions',
    'notification_preferences',
    'notifications',
    'workspace_integrations',
    'integration_events',
    'privacy_requests',
    'background_jobs'
  );

select
  'provider_metadata_has_no_secret_value_column' as test,
  count(*) = 0 as passed
from information_schema.columns
where table_schema = 'public'
  and table_name in ('ai_provider_configs', 'workspace_integrations')
  and column_name in (
    'api_key',
    'secret',
    'secret_key',
    'access_token',
    'refresh_token',
    'password'
  );

select
  'execution_boundaries_are_snapshotted' as test,
  count(*) = 2 as passed
from information_schema.columns
where table_schema = 'public'
  and table_name = 'execution_steps'
  and column_name in ('dependencies_snapshot', 'risks_snapshot');

select
  'realtime_surfaces_are_published' as test,
  count(*) = 3 as passed
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('execution_runs', 'execution_steps', 'notifications');

select
  'jobs_are_service_role_only' as test,
  not has_function_privilege(
    'authenticated',
    'public.claim_background_jobs(integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.claim_background_jobs(integer)',
    'EXECUTE'
  ) as passed;

select
  'event_triggers_are_installed' as test,
  count(*) = 4 as passed
from information_schema.triggers
where event_object_schema = 'public'
  and trigger_name in (
    'execution_step_blocked_notification',
    'audit_event_product_notification',
    'execution_step_enqueue_integrations',
    'notification_enqueue_email'
  );

select
  'latest_healthcheck_is_active' as test,
  public.healthcheck() ->> 'schema_version' = '0013' as passed;

rollback;
