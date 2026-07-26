# ADR 0009: Escenarios de asignación transparentes

## Estado

Aceptada.

## Contexto

Una estimación vigente todavía no responde quién debería ejecutar el trabajo ni
qué consecuencias produce esa decisión. Una recomendación opaca podría
convertirse en vigilancia, inventar habilidades o presentar una persona como
objetivamente superior sin evidencia suficiente.

## Decisión

El motor inicial `tr-assignment-1` es local y determinista:

- Compara entrega rápida, carga equilibrada, transferencia de conocimiento y
  una alternativa personalizada.
- Reutiliza únicamente la estimación vigente.
- Usa membresía, rol, participación previa, capacidad declarada y planes
  confirmados visibles.
- Expone disponibilidad, habilidades, ownership y objetivos de aprendizaje como
  señales faltantes mientras todavía no hayan sido declaradas.
- Excluye presencia, conexión, velocidad de escritura, puntuaciones secretas y
  comparaciones públicas de rendimiento.
- Muestra responsable, colaboradores, rango, confianza, carga, concentración,
  riesgos, razones, alternativas descartadas y consecuencia del cambio.
- Permite editar personas, contribución, rango, confianza y razón antes de
  confirmar.
- Guarda versiones inmutables; solamente una permanece vigente por ticket.

Las escrituras se realizan mediante `confirm_assignment_plan`, que vuelve a
validar autenticación, rol, estimación vigente, rango, elegibilidad del equipo,
un responsable y contribución total de 100%. Las tablas solamente exponen
lectura protegida por RLS.

## Consecuencias

- Dos personas con los mismos datos reciben la misma propuesta.
- La ausencia de una señal se declara; no se reemplaza con inferencias.
- Confirmar un plan mueve un ticket abierto a `planned` de forma explícita.
- Cada cambio crea una nueva versión auditable.
- Team & Capacity puede enriquecer señales declaradas sin cambiar el contrato de
  privacidad.

