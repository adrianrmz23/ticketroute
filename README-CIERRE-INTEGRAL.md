# TicketRoute · cierre integral

Este paquete continúa directamente desde el esquema `0009` del Bloque 12. No
borra workspaces, usuarios, SMTP, plantillas de Auth ni datos existentes.

## 1. Actualizar la base

En Supabase SQL Editor ejecuta, en este orden y una sola vez:

1. `supabase/migrations/20260726090000_calibration_lab.sql`
2. `supabase/migrations/20260726100000_ai_council.sql`
3. `supabase/migrations/20260726110000_notifications_integrations.sql`
4. `supabase/migrations/20260726120000_governance_jobs.sql`

Después abre `/app/settings/system`. Debe indicar **esquema 0013 activo**.

La comprobación estructural acumulada está en:

```text
supabase/tests/0011_closure_integrity.sql
```

Se ejecuta desde SQL Editor después de las cuatro migraciones. Termina con
`rollback`, por lo que no conserva datos.

## 2. Variables

Conserva tus variables públicas actuales. Añade únicamente las privadas que
necesites tomando `.env.example` como referencia.

Obligatorias para la cola:

```text
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

Opcionales para Council Mode:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
MOONSHOT_API_KEY
```

Opcionales para conectores:

```text
TICKETROUTE_WEBHOOK_URL
SLACK_WEBHOOK_URL
GITHUB_TOKEN
LINEAR_API_KEY
JIRA_API_TOKEN
```

Opcionales para correo operacional:

```text
NOTIFICATION_EMAIL_WEBHOOK_URL
NOTIFICATION_EMAIL_WEBHOOK_TOKEN
```

El SMTP configurado en Supabase continúa enviando confirmación, OTP y
recuperación de contraseña. Las notificaciones del producto usan un worker
privado separado porque las credenciales de Auth no deben salir de Supabase.

Nunca agregues `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` ni una API key a una
variable `NEXT_PUBLIC_*`.

## 3. Qué quedó implementado

- Calibration Lab con borrador, confirmación inmutable y aprendizaje
  reutilizable.
- Adaptadores reales para OpenAI, Anthropic, Gemini y Kimi; si falta una clave
  o un proveedor falla, se identifica el fallback local.
- Council Mode con hasta cuatro opiniones independientes, procedencia,
  limitaciones, síntesis trazable y decisión humana final.
- Execution Board con Kanban/lista, búsqueda, filtros, rango, progreso,
  dependencias, riesgos, alertas de capacidad, Realtime y dictado con
  consentimiento.
- Inbox accionable para notificaciones, bloqueos, invitaciones y privacidad.
- Notificaciones por bloqueo, asignación, invitación, Consejo y jobs.
- Integraciones por eventos con secretos de servidor y entrega asíncrona.
- Privacidad con exportación autenticada, corrección, eliminación bajo revisión
  y auditoría mínima.
- Cola con `SKIP LOCKED`, recuperación de locks vencidos y hasta cinco intentos.
- Demo pública de ciclo completo: captura, ticket, escenarios, Consejo,
  ejecución y calibración.
- Rutas de error, 404, carga, headers defensivos y reducción de movimiento.

## 4. Proveedores

Los contratos se basan en documentación oficial:

- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text)
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages)
- [Gemini API](https://ai.google.dev/gemini-api/docs/text-generation)
- [Kimi Chat API](https://platform.kimi.ai/docs/api/chat)

La pantalla `/app/settings/ai` guarda únicamente proveedor, modelo y estado.
Las claves permanecen en variables privadas. `/app/council` muestra el origen
de cada respuesta.

## 5. Jobs y Vercel

`/api/jobs/run` admite GET y POST, exige:

```text
Authorization: Bearer <CRON_SECRET>
```

`vercel.json` incluye una ejecución diaria a las `03:00 UTC`, compatible con
la limitación diaria del plan Hobby. En un plan que acepte mayor frecuencia
puedes cambiar la expresión sin modificar el procesador.

Vercel agrega automáticamente el header Bearer cuando `CRON_SECRET` existe en
el proyecto:

- [Seguridad de Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Uso y límites de Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)

El paquete queda preparado para Vercel, pero no se despliega automáticamente.

## 6. Verificación local

Con el servidor detenido:

```bash
npm install
npm run verify
```

Luego:

```bash
npm run dev
```

Recorrido de aceptación recomendado:

1. Registro, OTP, cierre de sesión, recuperación y cambio de contraseña.
2. Onboarding y cambio de workspace.
3. Invitación, aceptación y cambio de rol.
4. Captura manual y dictado con consentimiento.
5. Ticket, criterios, subtareas e incógnitas.
6. Estimación, asignación, capacidad y guía.
7. Execution Board: iniciar, bloquear, reanudar, evidenciar y completar.
8. Calibration Lab: guardar borrador y confirmar aprendizaje.
9. Proveedores y Council Mode, incluyendo fallback visible.
10. Inbox, notificaciones Realtime e integraciones.
11. Exportación de privacidad y revisión de la cola.
12. Demo pública, navegación móvil, teclado y estados de error.

## 7. Criterios de seguridad

- RLS vuelve a comprobar workspace y rol.
- Service role solo se crea en módulos `server-only`.
- El exportador exige que la sesión corresponda al solicitante.
- Las URLs privadas de webhook y Slack nunca se guardan en PostgreSQL.
- Los fallos externos se registran; no se presentan como entregas exitosas.
- La eliminación de datos no se ejecuta automáticamente.
- No se infiere productividad desde presencia, conexión, escritura o velocidad.
