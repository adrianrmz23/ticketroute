-- Ejecuta este archivo completo en Supabase SQL Editor después de la migración.
-- No modifica datos.

do $$
declare
  missing_tables text[];
  tables_without_rls text[];
  policy_count integer;
begin
  select array_agg(expected.name)
  into missing_tables
  from (
    values
      ('profiles'),
      ('workspaces'),
      ('workspace_members'),
      ('workspace_invites'),
      ('audit_events')
  ) as expected(name)
  left join information_schema.tables as actual
    on actual.table_schema = 'public'
    and actual.table_name = expected.name
  where actual.table_name is null;

  if missing_tables is not null then
    raise exception 'Faltan tablas: %', missing_tables;
  end if;

  select array_agg(classes.relname)
  into tables_without_rls
  from pg_catalog.pg_class as classes
  join pg_catalog.pg_namespace as namespaces
    on namespaces.oid = classes.relnamespace
  where namespaces.nspname = 'public'
    and classes.relname in (
      'profiles',
      'workspaces',
      'workspace_members',
      'workspace_invites',
      'audit_events'
    )
    and not classes.relrowsecurity;

  if tables_without_rls is not null then
    raise exception 'RLS no está activo en: %', tables_without_rls;
  end if;

  select count(*)
  into policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'workspaces',
      'workspace_members',
      'workspace_invites',
      'audit_events'
    );

  if policy_count <> 14 then
    raise exception
      'Se esperaban 14 políticas RLS y se encontraron %',
      policy_count;
  end if;

  if to_regprocedure('public.create_workspace(text,text,text,text)') is null then
    raise exception 'Falta la función create_workspace';
  end if;

  if to_regprocedure('public.healthcheck()') is null then
    raise exception 'Falta la función healthcheck';
  end if;
end
$$;

select
  'foundation_schema' as test,
  'passed' as result,
  public.healthcheck() as details;
