# Auditoria agil de seguridad e infraestructura

Fecha: 2026-06-08

## Cambios aplicados ahora

- Se agregaron headers globales de seguridad en `next.config.ts`:
  - `Content-Security-Policy`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy`
  - `Permissions-Policy`
- Se elimino el build con errores de TypeScript ignorados.
- Se fijo `turbopack.root` para evitar inferencia incorrecta de raiz por lockfiles externos.
- Se protegieron rutas internas con `SUPABASE_SERVICE_ROLE_KEY`:
  - `/api/crear-usuario`
  - `/api/gestionar-usuario`
- Las rutas internas de usuarios ahora exigen sesion de gerente y validan que el usuario objetivo pertenezca al mismo negocio.
- Se agrego `src/lib/api-auth.ts` para centralizar autorizacion de APIs sensibles.
- Se agrego `supabase-security-audit.sql` con consultas de diagnostico de RLS, grants, funciones publicas y tablas grandes.
- Se corrigieron errores de TypeScript que estaban ocultos por la configuracion anterior.

## Riesgos criticos revisados

### Service role en backend

La llave `SUPABASE_SERVICE_ROLE_KEY` solo debe existir en rutas servidor y nunca en frontend. Se encontro uso correcto en servidor, pero dos rutas internas no validaban autorizacion propia. Eso quedo corregido.

Pendiente: revisar webhooks de MercadoPago con verificacion criptografica/firma del proveedor.

### RLS y datos publicos

El chequeo manual anterior devolvio cero tablas publicas sin RLS. Se deja SQL de auditoria para repetirlo.

Pendiente: revisar grants a `anon` y politicas demasiado permisivas con el archivo `supabase-security-audit.sql`.

### CSP y clickjacking

Se agrego CSP compatible con Supabase y MercadoPago. Tambien se bloqueo embedding externo con `frame-ancestors 'self'` y `X-Frame-Options: SAMEORIGIN`.

Pendiente: despues del deploy, validar con SecurityHeaders/Sucuri y ajustar dominios si aparece algun recurso bloqueado.

### Dependencias

`npm audit` reporta vulnerabilidad moderada en `postcss` por dependencia transitiva de `next`.

No se aplico `npm audit fix --force` porque propone cambios incompatibles. Recomendacion: actualizar Next cuando exista parche compatible en la rama actual.

### Puertos e infraestructura

Este proyecto corre en Vercel/Next y Supabase; no hay VM local que auditar desde el repo. En Vercel no deben existir puertos SSH/RDP abiertos como en una VPS.

Pendiente externo:
- Activar 2FA en GitHub, Supabase, Vercel y MercadoPago.
- Rotar `SUPABASE_SERVICE_ROLE_KEY` si alguna vez se compartio.
- Revisar variables de entorno en Vercel y eliminar cualquier secreta innecesaria.
- Configurar dominio con DNS solo a Vercel, sin registros viejos apuntando a servidores desconocidos.

## Plan de remediacion recomendado

1. Ejecutar `supabase-security-audit.sql` en Supabase y revisar resultados.
2. Confirmar que ninguna tabla sensible tiene permisos directos peligrosos para `anon`.
3. Agregar rate limit/captcha al registro publico y endpoints de pedidos publicos.
4. Verificar firma de webhooks de MercadoPago antes de procesar eventos.
5. Revisar politicas RLS de `clientes`, `pedidos`, `items_pedido`, `pagos`, `usuarios` e `inventario`.
6. Migrar `middleware.ts` a `proxy.ts` cuando se haga una limpieza de infraestructura Next.
7. Mantener `npm run build` con validacion de tipos activa en cada deploy.
8. Revisar `npm audit` semanalmente y actualizar Next/Supabase SDK con pruebas.

## Mantenimiento recomendado

- Antes de cada release: `npm run build`.
- Semanal: revisar Supabase Advisors y `npm audit`.
- Mensual: revisar accesos de usuarios en Supabase, Vercel y GitHub.
- Trimestral: rotar llaves sensibles si hubo accesos compartidos o cambios de equipo.
- Siempre: nunca publicar `service_role`, tokens de MercadoPago ni `.env.local`.
