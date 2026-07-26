# ADR 0001: Fundación visual de TicketRoute

## Estado

Aceptada.

## Decisión

TicketRoute utilizará una interfaz de centro de control con:

- Navegación grafito de alta densidad.
- Superficie operativa marfil.
- Verde señal como acento funcional.
- Geist Sans para interfaz y Geist Mono para estados, métricas e identificadores.
- Bordes y divisiones como estructura principal; sombras solamente en capas flotantes.
- Animaciones entre 140 y 200 ms, respetando `prefers-reduced-motion`.

El shell mantiene solamente la interacción que ya puede cumplir: navegación a
`/app`, menú móvil y paleta global. Las rutas de capacidades futuras permanecen
visibles pero deshabilitadas hasta que existan.

## Consecuencia

Los siguientes bloques reutilizarán los tokens de `src/styles/tokens.css` y el
shell de `src/components/shell`. No será necesario rediseñar la estructura
privada cuando se agreguen Supabase, captura, tickets o planeación.
