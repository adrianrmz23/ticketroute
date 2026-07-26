# ADR 0007: Organización explicable antes de conectar IA externa

## Estado

Aceptada.

## Decisión

TicketRoute incorpora primero un organizador determinista y local que transforma
una captura lista en un borrador estructurado. Esta ruta no requiere claves, no
envía contenido a terceros y permanece disponible aunque no exista un proveedor
de IA configurado.

El organizador conserva la entrada original, propone campos editables, limita
las incógnitas prioritarias a dos y etiqueta expresamente su origen como
`local_rules / tr-local-1`. Confirmar el borrador crea el ticket, sus criterios,
subtareas y primera revisión dentro de una sola transacción PostgreSQL.

Las revisiones posteriores conservan snapshots completos. RLS controla las
lecturas y las mutaciones pasan por funciones autorizadas que vuelven a
comprobar la membresía y el rol.

## Consecuencias

- La capacidad principal funciona sin IA externa.
- Ninguna propuesta se presenta como una decisión silenciosa.
- La futura arquitectura multiproveedor podrá generar el mismo contrato
  `TicketDraft` sin cambiar Ticket Studio.
- La propuesta local es deliberadamente conservadora: señala incertidumbre en
  lugar de inventar contexto, dependencias o fechas.
- El motor de estimaciones permanece fuera de este bloque y no se muestran
  cifras mágicas.
