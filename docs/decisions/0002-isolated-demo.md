# ADR 0002: Demo pública aislada

## Estado

Aceptada.

## Decisión

La primera demostración de TicketRoute se ejecuta con estado local y datos
determinísticos. Reproduce la secuencia captura → ticket → escenarios → plan sin
llamar proveedores de IA, escribir en Supabase ni modificar el workspace
privado.

## Motivo

Permite verificar la propuesta de valor, interacción, accesibilidad y narrativa
del producto antes de introducir autenticación, persistencia y costos de IA.

## Evolución

Los bloques posteriores sustituirán los cálculos de demostración por casos de
uso reales detrás de contratos de aplicación. La ruta `/demo` conservará su
aislamiento y nunca reutilizará datos productivos.
