# ADR 0005: Contexto activo, roles e invitaciones

## Estado

Aceptada.

## Decisión

Cada usuario autenticado puede pertenecer a varios workspaces. El workspace
activo se selecciona únicamente entre membresías devueltas por PostgreSQL y su
identificador se conserva en una cookie `HttpOnly`, `SameSite=Lax`. La cookie
mejora continuidad de navegación, pero nunca concede acceso: las políticas RLS
y las funciones SQL vuelven a comprobar la membresía.

La creación inicial usa `create_workspace_v2()` para insertar workspace,
membresía Owner y auditoría dentro de una sola transacción. Las mutaciones de
membresías e invitaciones se retiran de las tablas públicas y se realizan
mediante funciones con reglas explícitas por rol.

Las invitaciones utilizan un token aleatorio de 256 bits. El enlace contiene el
token original; PostgreSQL almacena solamente su hash SHA-256. La aceptación
exige una sesión válida, coincidencia exacta del correo, estado pendiente y
vigencia. El token no otorga acceso por sí mismo.

## Reglas

- Owner y Admin pueden invitar.
- Solo Owner administra roles privilegiados.
- Admin no puede modificar ni retirar Owners o Admins.
- El último Owner no puede degradarse ni eliminarse.
- Planner, Member y Viewer consultan el directorio sin mutarlo.
- Una invitación expira en siete días y puede revocarse.
- La auditoría se escribe desde funciones autorizadas y los clientes no pueden
  editarla.

## Consecuencias

El shell deja de usar “Por configurar”, Command Center recibe capacidad real y
`/app/team` se convierte en la primera superficie privada conectada al dominio.
El envío automático de la invitación se reserva para Notificaciones; mientras
tanto se comparte un enlace seguro sin introducir Service Role en la aplicación.
