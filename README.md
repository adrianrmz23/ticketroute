# TicketRoute

Centro de control inteligente para convertir solicitudes naturales en trabajo
técnico claro, estimable, asignable y verificable.

## Stack

- Next.js 16 con App Router, React 19 y TypeScript estricto.
- Tailwind CSS 4 y módulos CSS para superficies especializadas.
- Supabase externo para PostgreSQL, Auth, RLS y funciones SQL.
- Zod, React Hook Form, Vitest y Testing Library.

## Desarrollo local

1. Copia `.env.example` como `.env.local`.
2. Completa la Project URL, la Publishable key y solo las variables privadas
   de los módulos que vayas a activar.
3. Instala y ejecuta:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Las instrucciones acumulativas del bloque actual están en
`README-CIERRE-INTEGRAL.md`. Las migraciones versionadas se conservan en
`supabase/migrations`.

## Verificación integral

```bash
npm run verify
```

Ese comando ejecuta pruebas, TypeScript, ESLint y el build de producción en
orden, y se detiene en la primera etapa que falle.

## Estado funcional

TicketRoute cubre captura manual y dictado con consentimiento, tickets
estructurados, rangos, asignación, capacidad declarada, guía, ejecución,
calibración, Council Mode multiproveedor, Inbox, notificaciones Realtime,
integraciones asíncronas, privacidad, auditoría y recuperación.

Las credenciales de proveedores, webhooks, correo operativo y service role no
se guardan en PostgreSQL ni se exponen con el prefijo `NEXT_PUBLIC_`.
