# ADR 0012: Ejecución mediante eventos declarados

## Estado

Aceptada.

## Contexto

Planning Guide conserva una decisión explicable, pero no representa trabajo en
curso. Modificar sus pasos directamente destruiría la fuente de la decisión.
Inferir progreso desde presencia, actividad o velocidad introduciría vigilancia
y produciría señales ambiguas.

## Decisión

La activación crea una ejecución y copia cada paso vigente como snapshot
operativo. La guía queda intacta. Los pasos usan transiciones explícitas entre:

- pendiente;
- en curso;
- bloqueado;
- completado;
- omitido.

Completar u omitir exige evidencia o razón. Bloquear exige describir el
impedimento. Cada transición se escribe mediante una RPC `security definer` que
vuelve a comprobar sesión, membresía, rol, responsable, recorrido abierto y
transición permitida.

El responsable del paso puede declarar su estado. Owner, Admin y Planner pueden
intervenir en todos los pasos del workspace. Viewer no puede escribir.

## Consecuencias

- La decisión original y la ejecución pueden compararse sin confundirlas.
- El progreso se calcula desde el esfuerzo confirmado, no desde actividad.
- Los bloqueos permanecen visibles y trazables.
- El historial de transiciones es append-only.
- La auditoría no copia evidencia ni texto del bloqueo.
- No se recopilan presencia, conexión, pulsaciones, velocidad o productividad.
- La calibración futura podrá usar únicamente recorridos cerrados y evidencia
  declarada.
