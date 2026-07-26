# ADR 0011: Guías de planeación versionadas

## Estado

Aceptada.

## Contexto

TicketRoute ya podía estructurar una solicitud, estimarla por rangos y confirmar
una asignación con consecuencias visibles. Faltaba convertir esas decisiones en
una secuencia operativa. Generar una lista opaca o iniciar ejecución
automáticamente habría ocultado el origen de los pasos y debilitado el control
del equipo.

## Decisión

Planning Guide genera localmente una propuesta determinista a partir del ticket,
la estimación y la asignación vigentes. Cada paso conserva:

- fase y posición;
- resultado observable;
- responsable perteneciente al plan confirmado;
- proporción de esfuerzo;
- comprobación;
- fuente, dependencias y riesgos.

El usuario puede cambiar la propuesta antes de confirmarla. La confirmación crea
una versión inmutable mediante `confirm_planning_guide`; las tablas solo admiten
lectura protegida por RLS. La RPC vuelve a comprobar sesión, workspace, estado
del ticket, estimación, asignación, responsables y suma de esfuerzo.

Una guía confirmada solo se reutiliza si sus IDs de estimación y asignación
siguen vigentes. Si cambian, se genera una nueva propuesta y se exige otra
confirmación.

## Consecuencias

- La ruta es explicable desde su fuente hasta su comprobación.
- El equipo puede impugnar orden, esfuerzo o responsables.
- Las versiones anteriores conservan la decisión histórica.
- La auditoría registra versión y conteos, sin copiar el texto completo.
- Confirmar una guía no inicia ejecución ni modifica el estado del ticket.
- No se introducen telemetría, presencia ni métricas individuales.
- Execution Board podrá consumir la guía vigente sin alterar su snapshot.
