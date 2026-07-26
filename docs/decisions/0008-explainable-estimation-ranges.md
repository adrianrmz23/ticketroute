# ADR 0008: Estimaciones explicables por rangos

## Estado

Aceptada.

## Contexto

TicketRoute necesita estimar trabajo sin presentar una cifra exacta como si
fuera una verdad. La propuesta debe seguir funcionando sin proveedores de IA ni
historial previo, conservar el criterio humano y quedar aislada por workspace.

## Decisión

El motor inicial `tr-estimate-1` es local y determinista:

- Produce escenarios favorable, probable y adverso; cada uno tiene límite
  inferior y superior.
- Calcula una confianza explícita a partir de criterios, subtareas, riesgos,
  incógnitas, dependencias e historia disponible.
- Convierte complejidad a la unidad configurada por el workspace usando su
  capacidad declarada.
- Expone la descomposición, los factores y la evidencia que movieron el rango.
- Mantiene puntos de extensión para referencias históricas y evaluaciones de
  proveedores posteriores.
- Permite editar rangos, confianza y base antes de confirmar.
- Guarda versiones inmutables; una sola versión queda vigente por ticket.
- No cambia silenciosamente el estado del ticket ni confirma una asignación.

Las escrituras se realizan únicamente mediante `save_ticket_estimate`, que
vuelve a comprobar sesión, membresía, rol, orden de escenarios y que la
descomposición sume 100%. Las tablas nuevas permiten lectura con RLS y no
exponen escrituras directas al cliente.

## Consecuencias

- El primer cálculo es reproducible y no envía datos a terceros.
- Un cambio manual crea una nueva versión auditable.
- La ausencia de historia se muestra como una limitación, no como evidencia
  inventada.
- Assignment Studio podrá reutilizar la versión vigente sin cambiar el contrato
  de estimación.

