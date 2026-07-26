# ADR 0006: Entrada original, borradores y consentimiento

## Estado

Aceptada.

## Decisión

Capture Hub conserva la entrada original antes de aplicar organización,
estimación o IA. Cada captura pertenece a un workspace, registra a su autor y
mantiene un estado pequeño: `draft`, `ready` o `archived`. El texto puede
guardarse manualmente o mediante autoguardado controlado; marcarlo como listo
no crea todavía un ticket ni ejecuta una integración.

Las mutaciones se realizan mediante funciones PostgreSQL autorizadas. RLS
permite consultar solamente capturas de workspaces a los que pertenece la
sesión. Owner, Admin, Planner y Member pueden crear capturas; Viewer conserva
acceso de lectura.

El dictado inicial utiliza la capacidad disponible en el navegador. Antes de
solicitar el micrófono se presenta una explicación explícita y la decisión se
registra de forma append-oriented en `consent_records`. TicketRoute no carga ni
conserva audio en este bloque: solamente almacena la transcripción editable.

## Consecuencias

- La entrada manual no depende de proveedores externos ni de IA.
- La intención original permanece disponible para comparación y trazabilidad.
- El autoguardado no genera eventos de auditoría repetitivos.
- Las transiciones relevantes —creación, lista y archivo— sí se auditan.
- La compatibilidad y calidad del dictado dependen temporalmente del navegador.
- Una implementación futura podrá sustituir la transcripción sin cambiar el
  contrato del dominio ni la política de consentimiento.
