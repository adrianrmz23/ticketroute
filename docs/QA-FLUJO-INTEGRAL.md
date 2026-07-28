# QA — Flujo Integral de Pruebas Funcionales

## 1. Alcance

Validación funcional integral de TicketRoute cubriendo autenticación, onboarding, captura, tickets, planificación, asignación, ejecución, calibración, Council Mode, integraciones, notificaciones, privacidad, sistema y experiencia general.

## 2. Entorno

| Aspecto | Valor |
|---------|-------|
| Framework | Next.js 16.2.11 (Turbopack) |
| React | 19.2.8 |
| Node.js | ≥ 22 |
| SO | Windows |
| Base de datos | Supabase (PostgreSQL + Auth + Realtime) |
| Tests | Vitest 4.1.10 + Testing Library |
| Estado inicial | 32 archivos, 71 tests, build OK |

## 3. Datos de prueba

| Elemento | Convención |
|----------|------------|
| Usuario | `qa-ticketroute@test.local` |
| Nombre | QA TicketRoute |
| Workspace | QA-TicketRoute-Integral |
| Slug | qa-ticketroute |
| Tickets | QA-TR-001, QA-TR-002, etc. |
| Capturas | Prefijo "QA-TR" en input_text |

### Limpieza

```sql
-- Ejecutar en SQL Editor de Supabase al terminar
DELETE FROM workspaces WHERE slug = 'qa-ticketroute';
-- Cascade eliminará members, tickets, captures, estimates, etc.
-- Luego eliminar el usuario de prueba desde Auth > Users
```

## 4. Precondiciones

- [ ] Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` definidas
- [ ] Variable `NEXT_PUBLIC_SITE_URL` definida
- [ ] Supabase alcanzable (`/api/health/supabase` retorna `connected`)
- [ ] Migraciones hasta esquema 0013 aplicadas
- [ ] Usuario de prueba creado en Supabase Auth
- [ ] `npm run verify` aprobado

## 5. Inventario de Rutas

### Rutas Públicas (sin sesión)

| Ruta | Tipo | Descripción |
|------|------|-------------|
| `/` | Page | Landing pública |
| `/demo` | Page | Demo guiada interactiva |
| `/auth/login` | Page | Inicio de sesión |
| `/auth/register` | Page | Registro |
| `/auth/confirm` | Page | Confirmación de email (OTP) |
| `/auth/recover` | Page | Recuperación de contraseña |
| `/auth/update-password` | Page | Actualizar contraseña (token) |
| `/auth/callback` | Route | OAuth/código → sesión |
| `/api/health/supabase` | API | Health check público |

### Rutas Protegidas (requieren sesión)

| Ruta | Tipo | Descripción |
|------|------|-------------|
| `/onboarding` | Page | Creación de workspace |
| `/invite/[token]` | Page | Aceptar invitación |
| `/app` | Page | Dashboard / Command Center |
| `/app/capture` | Page | Capture Hub (manual + dictado) |
| `/app/inbox` | Page | Bandeja de entrada unificada |
| `/app/tickets` | Page | Lista de tickets |
| `/app/tickets/new` | Page | Crear ticket desde captura |
| `/app/tickets/[ticketId]` | Page | Detalle / edición de ticket |
| `/app/planning` | Page | Planning Lab (lista) |
| `/app/planning/[ticketId]` | Page | Estimación por escenarios |
| `/app/planning/[ticketId]/assignment` | Page | Assignment Studio |
| `/app/planning/[ticketId]/guide` | Page | Guía de planificación |
| `/app/board` | Page | Tablero de ejecución |
| `/app/board/[ticketId]` | Page | Detalle de ejecución |
| `/app/calibration` | Page | Calibración (lista) |
| `/app/calibration/[ticketId]` | Page | Formulario de calibración |
| `/app/council` | Page | Council Mode |
| `/app/notifications` | Page | Notificaciones + preferencias |
| `/app/integrations` | Page | Conectores (5 proveedores) |
| `/app/team` | Page | Equipo + invitaciones |
| `/app/team/capacity` | Page | Capacidad declarada |
| `/app/settings/ai` | Page | Proveedores de IA |
| `/app/settings/security` | Page | Privacidad y gobierno |
| `/app/settings/system` | Page | Estado del sistema |

### API Routes

| Ruta | Método | Protección |
|------|--------|-----------|
| `/api/health/supabase` | GET | Público |
| `/api/jobs/run` | GET/POST | `CRON_SECRET` (Bearer) |
| `/api/privacy/export/[requestId]` | GET | Sesión + ownership |

### Server Actions (12 archivos)

| Feature | Actions |
|---------|---------|
| auth | login, register, confirmEmail, resendCode, recoverPassword, updatePassword, signOut |
| workspaces | createWorkspace, selectWorkspace, createInvite, revokeInvite, changeMemberRole, removeMember, acceptInvite |
| capture | saveCapture, archiveCapture, recordMicrophoneConsent |
| tickets | createTicketFromCapture, updateTicket |
| planning | saveEstimate |
| assignment | confirmAssignment |
| guides | confirmPlanningGuide |
| execution | startExecution, updateExecutionStep |
| calibration | saveCalibration |
| ai | saveProviderConfig, runCouncil |
| system | saveNotificationPreferences, markNotificationRead, saveIntegration, createPrivacyRequest, resolvePrivacyRequest |
| capacity | savePlanningProfile |

### Tablas de Supabase utilizadas

profiles, workspaces, workspace_members, workspace_invites, audit_events, capture_sessions, consent_records, tickets, ticket_criteria, ticket_subtasks, ticket_revisions, estimates, estimate_factors, estimate_breakdown, member_planning_profiles, assignment_plans, assignment_plan_participants, planning_guides, planning_guide_steps, execution_runs, execution_steps, execution_step_events, calibration_records, ai_provider_configs, council_sessions, council_opinions, notification_preferences, notifications, workspace_integrations, integration_events, privacy_requests, background_jobs

### Roles

| Rol | Gestión de equipo | Edición de contenido | Lectura |
|-----|------------------|---------------------|---------|
| owner | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ |
| planner | ✗ | ✓ | ✓ |
| member | ✗ | ✓ | ✓ |
| viewer | ✗ | ✗ | ✓ |

## 6. Matriz de Pruebas


| ID | Módulo | Flujo | Ruta | Precondición | Prioridad |
|----|--------|-------|------|--------------|-----------|
| A01 | Auth | Ruta protegida sin sesión → redirect login | `/app` | Sin sesión | P0 |
| A02 | Auth | Registro con datos válidos | `/auth/register` | Sin sesión | P0 |
| A03 | Auth | Registro con email inválido | `/auth/register` | Sin sesión | P1 |
| A04 | Auth | Registro con contraseña insuficiente | `/auth/register` | Sin sesión | P1 |
| A05 | Auth | Login correcto | `/auth/login` | Usuario registrado | P0 |
| A06 | Auth | Login con contraseña incorrecta | `/auth/login` | Usuario registrado | P0 |
| A07 | Auth | Persistencia de sesión al recargar | `/app` | Sesión activa | P0 |
| A08 | Auth | Cierre de sesión | `/app` (acción signOut) | Sesión activa | P0 |
| A09 | Auth | Acceso directo post-logout | `/app` | Recién cerró sesión | P1 |
| A10 | Auth | Recuperación de contraseña | `/auth/recover` | Usuario registrado | P2 |
| A11 | Auth | Confirmación de email (OTP) | `/auth/confirm` | Registro reciente | P1 |
| A12 | Auth | Actualizar contraseña | `/auth/update-password` | Token válido | P2 |
| B01 | Onboarding | Usuario nuevo → onboarding | `/onboarding` | Sesión sin workspace | P0 |
| B02 | Onboarding | Crear workspace completo | `/onboarding` | Sesión activa | P0 |
| B03 | Onboarding | Campos obligatorios vacíos | `/onboarding` | Sesión activa | P1 |
| B04 | Onboarding | Slug duplicado | `/onboarding` | Slug ya existe | P1 |
| B05 | Onboarding | Usuario ya con workspace → redirect /app | `/onboarding` | Workspace existente | P1 |
| B06 | Onboarding | Crear segundo workspace | `/onboarding?new=1` | Workspace existente | P2 |
| C01 | Workspace | Cambiar workspace activo | `/app` (selectWorkspace) | Múltiples workspaces | P1 |
| C02 | Workspace | Persistencia de workspace en cookie | `/app` | Workspace seleccionado | P1 |
| C03 | Workspace | Invitar miembro (owner/admin) | `/app/team` | Rol owner/admin | P1 |
| C04 | Workspace | Aceptar invitación | `/invite/[token]` | Invitación pendiente | P1 |
| C05 | Workspace | Revocar invitación | `/app/team` | Invitación pendiente | P2 |
| C06 | Workspace | Cambiar rol de miembro | `/app/team` | Rol owner/admin | P2 |
| C07 | Workspace | Remover miembro | `/app/team` | Rol owner/admin | P2 |
| C08 | Workspace | Viewer no puede editar | `/app/capture` | Rol viewer | P1 |
| D01 | Captura | Crear captura manual válida | `/app/capture` | Workspace activo | P0 |
| D02 | Captura | Captura vacía rechazada | `/app/capture` | Workspace activo | P1 |
| D03 | Captura | Captura texto muy corto (<12 chars "ready") | `/app/capture` | Workspace activo | P1 |
| D04 | Captura | Captura con texto largo | `/app/capture` | Workspace activo | P2 |
| D05 | Captura | Guardar como borrador | `/app/capture` | Workspace activo | P1 |
| D06 | Captura | Guardar como "ready" | `/app/capture` | Texto suficiente | P0 |
| D07 | Captura | Archivar captura | `/app/capture` | Captura existente | P2 |
| D08 | Captura | Consentimiento de micrófono | `/app/capture` | Workspace activo | P1 |
| D09 | Captura | Dictado con permiso concedido | `/app/capture` | Permiso granted | P1 |
| D10 | Captura | Dictado con permiso denegado | `/app/capture` | Permiso denied | P2 |
| D11 | Captura | Persistencia post-recarga | `/app/capture` | Captura guardada | P1 |
| E01 | Inbox | Visualizar notificaciones sin leer | `/app/inbox` | Notificaciones existentes | P0 |
| E02 | Inbox | Marcar notificación como leída | `/app/inbox` | Notificación sin leer | P1 |
| E03 | Inbox | Estado vacío (sin pendientes) | `/app/inbox` | Sin notificaciones | P2 |
| E04 | Inbox | Visualizar bloqueos declarados | `/app/inbox` | Steps bloqueados | P1 |
| E05 | Inbox | Visualizar invitaciones pendientes | `/app/inbox` | Invitaciones existentes | P2 |
| F01 | Tickets | Crear ticket desde captura | `/app/tickets/new?capture=X` | Captura "ready" | P0 |
| F02 | Tickets | Editar ticket existente | `/app/tickets/[id]` | Ticket existente | P0 |
| F03 | Tickets | Persistencia de edición | `/app/tickets/[id]` | Cambio guardado | P1 |
| F04 | Tickets | Lista de tickets | `/app/tickets` | Tickets existentes | P1 |
| F05 | Tickets | Ticket inexistente → 404 | `/app/tickets/invalid-id` | ID inválido | P2 |
| G01 | Planning | Lista de tickets estimables | `/app/planning` | Tickets confirmados | P1 |
| G02 | Planning | Calcular estimación por escenarios | `/app/planning/[id]` | Ticket listo | P0 |
| G03 | Planning | Guardar estimación | `/app/planning/[id]` | Propuesta válida | P0 |
| G04 | Planning | Estimación con rangos inválidos | `/app/planning/[id]` | Rangos incorrectos | P1 |
| G05 | Planning | Persistencia post-recarga | `/app/planning/[id]` | Estimación guardada | P1 |
| H01 | Assignment | Generar escenarios de asignación | `/app/planning/[id]/assignment` | Estimación existente | P0 |
| H02 | Assignment | Comparar 4 estrategias | `/app/planning/[id]/assignment` | Escenarios generados | P0 |
| H03 | Assignment | Confirmar asignación | `/app/planning/[id]/assignment` | Estrategia seleccionada | P0 |
| H04 | Assignment | Sin miembros operativos → error | `/app/planning/[id]/assignment` | Solo viewers | P2 |
| H05 | Assignment | Persistencia del plan confirmado | `/app/planning/[id]/assignment` | Plan confirmado | P1 |
| I01 | Guide | Construir guía de planificación | `/app/planning/[id]/guide` | Asignación confirmada | P0 |
| I02 | Guide | Editar pasos de la guía | `/app/planning/[id]/guide` | Guía existente | P1 |
| I03 | Guide | Confirmar guía | `/app/planning/[id]/guide` | Guía completa | P0 |
| I04 | Guide | Validar que esfuerzo sume 100% | `/app/planning/[id]/guide` | Guía en edición | P1 |
| I05 | Guide | Guía sin datos → error visible | `/app/planning/[id]/guide` | Sin asignación | P2 |
| J01 | Execution | Iniciar ejecución desde guía | `/app/board/[id]` | Guía confirmada | P0 |
| J02 | Execution | Cambiar estado de paso | `/app/board/[id]` | Ejecución activa | P0 |
| J03 | Execution | Declarar bloqueo con nota | `/app/board/[id]` | Ejecución activa | P1 |
| J04 | Execution | Completar todos los pasos | `/app/board/[id]` | Ejecución activa | P1 |
| J05 | Execution | Progreso no excede 100% | `/app/board/[id]` | Pasos avanzando | P1 |
| J06 | Execution | Tablero muestra ejecuciones | `/app/board` | Ejecuciones existentes | P1 |
| J07 | Execution | Persistencia post-recarga | `/app/board/[id]` | Cambios guardados | P1 |
| K01 | Calibration | Formulario de calibración | `/app/calibration/[id]` | Ejecución completada | P1 |
| K02 | Calibration | Guardar borrador | `/app/calibration/[id]` | Formulario válido | P1 |
| K03 | Calibration | Confirmar aprendizaje (inmutable) | `/app/calibration/[id]` | Borrador válido | P1 |
| K04 | Calibration | Registro confirmado no editable | `/app/calibration/[id]` | Ya confirmado | P2 |
| L01 | Council | Formulario vacío rechazado | `/app/council` | Workspace activo | P1 |
| L02 | Council | Convocar consejo | `/app/council` | Título + contexto | P0 |
| L03 | Council | Sin proveedores → fallback visible | `/app/council` | 0 proveedores habilitados | P1 |
| L04 | Council | Resultado trazable con procedencia | `/app/council?session=X` | Sesión completada | P1 |
| L05 | Council | Doble clic prevenido (pending) | `/app/council` | Formulario enviado | P2 |
| M01 | AI Config | Configurar proveedor | `/app/settings/ai` | Workspace activo | P1 |
| M02 | AI Config | Estado "sin credencial" visible | `/app/settings/ai` | Sin env var | P1 |
| M03 | AI Config | Credenciales no visibles en browser | `/app/settings/ai` | Config guardada | P0 |
| N01 | Integrations | Configurar webhook | `/app/integrations` | Workspace activo (owner/admin) | P1 |
| N02 | Integrations | URL inválida rechazada | `/app/integrations` | URL sin HTTPS | P1 |
| N03 | Integrations | Historial de eventos visible | `/app/integrations` | Eventos existentes | P2 |
| N04 | Integrations | Secretos no en Supabase público | `/app/integrations` | Config guardada | P0 |
| O01 | Notifications | Preferencias editables | `/app/notifications` | Workspace activo | P1 |
| O02 | Notifications | Tiempo real (insert → refresh) | `/app/notifications` | Canal activo | P2 |
| O03 | Notifications | Marcar leída | `/app/notifications` | Notificación existente | P1 |
| P01 | Privacy | Crear solicitud de exportación | `/app/settings/security` | Workspace activo | P1 |
| P02 | Privacy | Resolver solicitud (owner/admin) | `/app/settings/security` | Solicitud pendiente | P2 |
| P03 | Privacy | Descargar exportación | `/api/privacy/export/[id]` | Export completado | P2 |
| Q01 | Capacity | Declarar disponibilidad | `/app/team/capacity` | Workspace activo | P1 |
| Q02 | Capacity | Guardar habilidades y señales | `/app/team/capacity` | Formulario válido | P1 |
| R01 | System | Health check muestra estado | `/app/settings/system` | Siempre | P0 |
| R02 | System | API health retorna JSON | `/api/health/supabase` | Siempre | P1 |
| R03 | System | Jobs protegidos sin CRON_SECRET | `/api/jobs/run` | Sin Bearer | P0 |
| S01 | Security | Server Action sin sesión → redirect | Cualquier action | Sin sesión | P0 |
| S02 | Security | Workspace de otro usuario → sin datos | `/app/tickets` | Workspace ajeno | P0 |
| S03 | Security | Service role key fuera del bundle | Build output | Siempre | P0 |
| S04 | Security | Secretos ausentes de console/network | DevTools | Sesión activa | P0 |
| T01 | Navigation | Landing carga correctamente | `/` | Sin sesión | P1 |
| T02 | Navigation | Demo interactiva funciona | `/demo` | Sin sesión | P2 |
| T03 | Navigation | 404 para ruta inexistente | `/app/nonexistent` | Sesión activa | P2 |
| T04 | Navigation | Error boundary captura errores | `/app/...` error forzado | Sesión activa | P2 |
| T05 | Navigation | Paleta de comandos funciona | `/app` (Ctrl+K) | Sesión activa | P2 |
| T06 | Navigation | Menú móvil abre y cierra | `/app` (< 900px) | Sesión activa | P2 |

## 7. Flujos Principales (End-to-End)

### Flujo Completo P0

```
Login → Onboarding → Captura Manual → Confirmar Ticket →
Estimar (3 escenarios) → Asignar (4 estrategias) →
Construir Guía → Iniciar Ejecución → Avanzar Pasos →
Completar → Calibrar → Council Mode
```

### Flujos Secundarios

- Dictado por micrófono → Captura → Ticket
- Invitar miembro → Aceptar → Ver equipo
- Configurar proveedor IA → Convocar consejo con proveedor
- Configurar webhook → Verificar encolamiento
- Crear solicitud de privacidad → Resolver → Descargar

## 8. Resultado Esperado por Módulo

| Módulo | Criterio de aceptación |
|--------|----------------------|
| Auth | Usuario sin sesión no accede a datos privados |
| Onboarding | Se completa una sola vez; workspace queda activo |
| Captura | Sesión persistida en Supabase; aparece en lista |
| Tickets | CRUD completo con validación y persistencia |
| Planning | Estimación por rangos guardada y consultable |
| Assignment | 4 escenarios comparables; plan confirmado |
| Guide | Pasos con responsables y esfuerzo = 100% |
| Execution | Progreso real, bloqueos declarados, no > 100% |
| Calibration | Comparación declarada; confirmado = inmutable |
| Council | Procedencia visible; síntesis no auto-ejecuta |
| AI Config | Credenciales en servidor; metadatos en Supabase |
| Integrations | Secretos privados; cola no bloquea UI |
| Privacy | Exportación, corrección, eliminación trazables |
| System | Health check funcional; RLS activo |

## 9. Limpieza de Datos

Al finalizar todas las pruebas:

1. Eliminar workspace `qa-ticketroute` desde SQL o dashboard.
2. Eliminar usuario `qa-ticketroute@test.local` desde Auth.
3. Verificar que no quedan registros huérfanos.
