# ADR 0004: Autenticación SSR y protección de rutas

## Estado

Aceptada.

## Decisión

TicketRoute utiliza Supabase Auth con flujo PKCE y cookies compartidas entre
navegador y servidor. `proxy.ts` sigue la convención de Next.js 16, renueva la
sesión y protege `/app`. El layout privado vuelve a validar el usuario en
servidor antes de consultar su perfil.

Las Server Actions coordinan registro, acceso, confirmación, recuperación,
cambio de contraseña y cierre de sesión. Los formularios se validan con Zod
antes de llamar a Supabase y traducen errores a mensajes que no revelan si una
cuenta existe ni detalles internos del proveedor.

El registro usa un OTP de seis dígitos para evitar depender de enlaces que
clientes de correo pueden consumir mediante prefetch. Google y GitHub usan el
callback PKCE común `/auth/callback`.

## Reglas

- `getSession()` no se utiliza para autorizar rutas en servidor.
- Proxy valida claims y el layout privado solicita el usuario actualizado.
- Toda redirección recibida como entrada debe ser una ruta interna segura.
- Los secretos OAuth viven en Supabase, nunca en el navegador.
- La recuperación termina cerrando la sesión local y exige un acceso nuevo.
- El perfil mostrado se obtiene con el usuario autenticado y queda sujeto a
  RLS.

## Consecuencias

El shell privado deja de mostrar una identidad de demostración. La identidad ya
es real, pero el workspace permanece “Por configurar” hasta que el onboarding
del siguiente bloque cree la primera membresía owner.
