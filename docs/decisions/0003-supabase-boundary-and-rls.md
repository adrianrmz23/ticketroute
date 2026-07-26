# ADR 0003: Supabase como frontera de datos

## Estado

Aceptada.

## Decisión

TicketRoute usa dos clientes tipados de Supabase: uno para interacciones reales
del navegador y otro para Server Components, Route Handlers y Server Actions.
Ambos consumen únicamente la URL del proyecto y la Publishable key. Las
operaciones privilegiadas no forman parte de esta frontera.

El modelo multiworkspace comienza con tablas separadas para perfiles,
workspaces, membresías, invitaciones y auditoría. Cada tabla con datos de
usuarios o workspaces tiene RLS habilitado. Las políticas se apoyan en funciones
`security definer` pequeñas y con `search_path` vacío para comprobar membresía y
rol sin producir recursión entre políticas.

La creación de un workspace ocurre mediante `create_workspace(...)`: crea
workspace, owner y evento de auditoría dentro de una misma transacción.

## Consecuencias

- Ocultar un control en React nunca sustituye una autorización en PostgreSQL.
- La clave pública no concede acceso transversal entre workspaces.
- Los eventos de auditoría son append-oriented para clientes autenticados.
- La última membresía owner no puede eliminarse ni degradarse.
- Las invitaciones no pueden otorgar el rol owner.
- Las futuras tablas del dominio deben incluir `workspace_id` y sus propias
  políticas antes de exponerse a la API.

## Verificación

`supabase/tests/0001_foundation_verify.sql` comprueba tablas, RLS, políticas y
funciones. `supabase/tests/0002_rls_isolation.sql` simula dos identidades,
demuestra que no pueden leer el workspace ajeno y revierte todos los datos de
prueba.
