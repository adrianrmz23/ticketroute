# Migraciones de Supabase

Ejecuta los archivos en orden cronológico y una sola vez:

1. `20260725213000_foundation.sql`
   - Perfiles, workspaces, membresías, invitaciones, auditoría y RLS base.
2. `20260726010000_workspace_access.sql`
   - Onboarding, preferencias, roles autorizados e invitaciones aceptables.
3. `20260726020000_capture_hub.sql`
   - Capturas, borradores persistentes, consentimiento, auditoría y RLS.
4. `20260726030000_ticket_organizer.sql`
   - Tickets estructurados, criterios, subtareas, revisiones y RLS.
5. `20260726040000_estimation_engine.sql`
   - Rangos por escenario, confianza, factores, descomposición, versiones y RLS.
6. `20260726050000_assignment_studio.sql`
   - Planes de asignación, participantes, carga, consecuencias, versiones,
     auditoría y RLS.
7. `20260726060000_team_capacity.sql`
   - Disponibilidad, compromisos, habilidades, componentes, ownership,
     aprendizaje, auditoría y RLS.
8. `20260726070000_planning_guide.sql`
   - Guías versionadas, pasos verificables, responsables del plan confirmado,
     auditoría y RLS.
9. `20260726080000_execution_board.sql`
   - Runs de ejecución, snapshots de pasos, transiciones, bloqueos, evidencia,
     historial, auditoría y RLS.
10. `20260726090000_calibration_lab.sql`
    - Resultado real, interrupciones, cambios de alcance, desviación,
      aprendizaje confirmado e inmutabilidad.
11. `20260726100000_ai_council.sql`
    - Metadatos multiproveedor, sesiones del Consejo, procedencia de opiniones,
      fallback explícito, auditoría y RLS.
12. `20260726110000_notifications_integrations.sql`
    - Límites de ejecución, notificaciones por eventos, Realtime,
      integraciones no secretas y auditoría.
13. `20260726120000_governance_jobs.sql`
    - Privacidad, exportaciones autenticadas, cola asíncrona, recuperación de
      bloqueos, reintentos e integraciones en segundo plano.

No ejecutes nuevamente una migración que ya fue aplicada al proyecto externo.
Las pruebas manuales y transaccionales viven en `supabase/tests`.
