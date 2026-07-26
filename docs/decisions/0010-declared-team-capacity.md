# ADR 0010: Capacidad de equipo declarada

## Estado

Aceptada.

## Contexto

Assignment Studio podía usar la capacidad general del workspace y contar planes
confirmados, pero todavía no conocía la disponibilidad real, el contexto técnico
ni los objetivos de aprendizaje que cada persona decide compartir. Inferir esas
señales desde actividad, presencia o velocidad convertiría la planeación en
vigilancia y produciría recomendaciones difíciles de impugnar.

## Decisión

Team & Capacity conserva un perfil explícito y editable por membresía:

- disponibilidad semanal;
- horas ya planeadas;
- habilidades;
- experiencia en componentes;
- ownership técnico;
- objetivos de aprendizaje.

Cada persona puede modificar su propio perfil. Owner, Admin y Planner pueden
mantener perfiles operativos del equipo. Las lecturas usan RLS por workspace y
las escrituras pasan por `save_member_planning_profile`.

El motor `tr-assignment-2` utiliza esas señales con reglas visibles:

- disponibilidad y horas planeadas determinan la carga propuesta;
- continuidad, ownership, componentes y habilidades pueden justificar entrega
  rápida;
- los objetivos relacionados pueden justificar una transferencia de
  conocimiento;
- cuando falta disponibilidad se conserva un fallback explícito al valor del
  workspace.

Se excluyen conexión, presencia, velocidad de escritura, telemetría individual,
productividad inferida y cualquier puntaje secreto.

## Consecuencias

- La recomendación mejora solamente cuando el equipo declara más contexto.
- Una persona puede revisar y cambiar la información que influye en el motor.
- El perfil no constituye una evaluación de desempeño.
- La auditoría registra la modificación y conteos, pero no duplica el contenido
  de habilidades, ownership u objetivos.
- Los planes ya confirmados mantienen su snapshot; una nueva confirmación usa
  el motor y las declaraciones vigentes.
- Planning Guide puede consumir el plan confirmado sin introducir nuevas
  señales personales.

