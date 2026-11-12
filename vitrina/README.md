# LADELOS Control de Vitrina

**Fase 2 (conectada):** https://ladelos-app.vercel.app/vitrina.html, con las mismas cuentas de ladelos-app. Ver "Fase 2: cómo está montada" al final.

## Fase 1

App de inventario de vitrina, reposición y producción para LADELOS Bayamón.
Esta entrega es la **Fase 1: app funcional independiente**. No está conectada a Clover ni a Fresh KDS.

## Cómo usarla

- **Para probar:** abre el enlace publicado (artifact) en el iPhone o la tablet.
- **Sin internet de por medio:** abre `dist/standalone.html` en cualquier navegador. Necesita internet una sola vez para cargar React y las letras.
- **Administración:** Danny o Soha, PIN inicial `1234`. Cámbialo en Administración → Usuarios.
- **Probar fuera de horario:** ve a Administración → Pruebas → Hora simulada. Ahí está también **Cargar escenario de prueba**, que carga 4 semanas de ventas inventadas y producción inicial lista para recibir.

## Importante en esta fase

- **Los datos viven en el navegador de cada equipo.** La tablet y el iPhone **no** comparten inventario todavía. Varias pestañas del mismo equipo sí se mantienen al día. La sincronización real entre equipos es la Fase 2.
- **El PIN no es seguridad.** Solo separa la pantalla de Administración en ese equipo.
- **La hora** se calcula siempre en America/Puerto_Rico, pero en esta fase sale del reloj del equipo. En la Fase 2 la dará el servidor.
- **Las ventas** se prueban con el simulador. Las sugerencias que salen de datos simulados lo dicen en pantalla.

## Qué hace (implementado y probado)

| Área | Funciones |
| --- | --- |
| Vitrina | Semáforo por sabor (texto + ícono + color), recibir producción con un toque o con otra cantidad (parcial o cerrando con diferencia), aprobar / posponer / no reponer / sustituir amarillas, desperdicio con motivo, "Cliente preguntó" con protección contra toques repetidos, reactivar reposición, ver lo que viene en camino |
| Freidora | Producción inicial del día, cola Por hacer → Preparando → Lista, tipo de cada solicitud (automática, aprobada, sugerencia, sustitución, excepción), "No se puede" con motivo, ¿Qué conviene freír ahora?, producción terminada hoy con producido / recibido / diferencia |
| Administración | Resumen de hoy, ajustes de inventario con motivo, producción fuera de regla autorizada, sabores (mínimo, objetivo por hora, hora límite propia, restricción, nombre en Clover), horario y reglas, usuarios, historial de movimientos y acciones, estado de integraciones, simulador, hora simulada, cierre del día, copia de seguridad |

## Reglas clave (src/domain/engine.ts)

- **Necesidad = objetivo − disponible − pendiente − preparando − listo**, nunca negativa. Con esto no se duplican solicitudes.
- **Rojo** (0 en vitrina): reposición automática por la necesidad real si el sabor es de vitrina, no está bloqueado, está dentro de horario y **se puso en vitrina hoy**. Esta última regla se puede quitar en Reglas; evita que al abrir se pidan solos los 40 sabores que están en cero.
- **Amarillo** (≤ mínimo): propone; solo va a freidora si vitrina aprueba.
- **Producir no sube el inventario.** Sube cuando vitrina confirma lo que recibió, y la diferencia queda registrada.
- **Bloqueos:** no cambian el inventario; al vencer, el sistema reevalúa. Cancelar una automática bloquea ese sabor 30 min para que no se vuelva a crear sola.
- **Horario:** lunes a jueves no hay reposición nueva después de las 12:30 p. m.; viernes y sábado, después de la 1:30 p. m.; domingo cerrado. Revoltillo se repone solo hasta las 10:00 a. m. Danny o Soha pueden autorizar excepciones.
- **Al momento** (Queso, Pollo Brócoli, Brócoli Cebolla, Brócoli Cebolla Queso, Queso Cebolla, Guayaba Queso, Nutella, Apple Pie): sin inventario de vitrina, alertas ni sugerencias.
- **Ventas:** cada línea con VITRINA descuenta 1; AL MOMENTO no descuenta; una línea borrada devuelve; un reembolso no devuelve; el mismo evento dos veces no descuenta dos veces. Una venta sin modificador no descuenta y queda para revisar.
- **Sugerencias:** solo sabores con 0 en vitrina, sin bloqueo, en horario y sin producción suficiente en camino. Usan los pesos 35 / 25 / 20 / 10 / 10 (franja horaria, día de la semana, hoy, tendencia, clientes que preguntaron); un cliente que preguntó cuenta como demanda directa. Es una heurística, no un modelo validado. Nunca se fríe nada sin que alguien lo apruebe.
- Cada comando es atómico: si algo falla, nada cambia. Todo queda en el historial con usuario, hora, cantidad anterior y nueva, motivo y origen.

## Suposiciones (configurables en Administración)

- Sabores y nombres tomados del inventario real de Clover Bayamón. Pollo Queso y Carne Queso están separados en Americano y Mozzarella, igual que en Clover.
- Mínimo y objetivo: Carne 4/8, Pollo 4/8, Pollo Queso (los dos) 3/6, Jamón Queso 3/6, Pizza 3/6, Revoltillo 3/6. **El resto usa 2/4 provisional** y está marcado así.
- "Brócoli & Queso" quedó como sabor de vitrina porque no está en la lista de al momento. Cámbialo si no aplica.
- Al cierre del día, Administración escoge si los sobrantes van a desperdicio o se conservan.

## Estructura

```
src/domain/      lógica de negocio sin interfaz (types, engine, recommend, time, seed)
src/integrations clover.ts (leer órdenes y webhooks), freshkds.ts (ticket VITRINA — REPOSICIÓN)
src/ui/          pantallas React (Vitrina, Freidora, Admin), store local, sonido
tests/           33 pruebas automatizadas (vitest)
build.mjs        genera dist/ladelos-control-vitrina.html y dist/standalone.html
```

Comandos: `npm install`, luego `npx vitest run` (pruebas), `npx tsc -p .` (tipos) y `node build.mjs` (construir).

## Integraciones: lo verificado

**Clover** ([docs: webhooks](https://docs.clover.com/docs/webhooks))
- El webhook solo envía `objectId` (por ejemplo `O:<id de orden>`), `type` (CREATE / UPDATE / DELETE) y `ts`. La orden completa con modificadores se busca por la REST API desde un servidor.
- Requiere una app de Clover (Developer Dashboard), permiso de leer órdenes, una URL pública HTTPS (no sirve localhost) y validar el encabezado `X-Clover-Auth`.
- La documentación no describe reintentos, así que hace falta una reconciliación periódica por API.
- **Por verificar con órdenes reales:** si al poner cantidad 2 Clover crea 2 líneas o una con `unitQty`. La app cuenta 1 por línea y avisa si ve `unitQty`.
- Ya está hecho en Clover: el grupo **Despacho** es obligatorio, con una sola selección (VITRINA - NO HACER / AL MOMENTO – COCINA), en los 49 pastelillos de Bayamón y Cataño.

**Fresh KDS** ([docs: KDS Orders](https://fresh-technology.github.io/fresh.kds.docs.mobile-local-network-integration/docs/api/api_kds_orders))
- Hay una API para integradores: `POST /integrators/kds-orders` con `x-integration-token`, `x-location-id` y `x-device-ids`, además de webhooks de orden creada y orden marcada como hecha.
- Requiere sandbox y aprobación de Fresh (partnerships@freshtechnology.com).
- `mode` solo acepta For Here, ToGo, Pickup, DriveThru, Delivery y Curbside, y no hay color documentado. El ticket se distingue por el nombre "VITRINA — REPOSICIÓN", una nota y `priority`.
- **No verificado:** que Fresh KDS siga sonando y actualizando en pantalla dividida en la TCL NXTPAPER 14. Hay que probarlo en la tablet.

## Fase 2: cómo está montada

- **Página:** `ladelos-app/public/vitrina.html` (generada con `node build.mjs`, que la deja en `dist/vitrina.html`). Vercel la publica junto con ladelos-app.
- **Servidor:** la Edge Function `vitrina` de Supabase (`dist/edge/vitrina.ts`, un solo archivo generado desde `supabase/functions/vitrina/index.ts` + `src/server/handler.ts` + `src/domain`). Valida la sesión y el rol, aplica cada acción con la hora del servidor y guarda con control de versión; si dos equipos guardan a la vez, reintenta sobre lo más reciente.
- **Base de datos:** `supabase/vitrina.sql` crea `vitrina_store` (estado de cada tienda, sin acceso directo desde la app), `vitrina_members` (quién entra y con qué rol), `vitrina_history` (cada acción con sus movimientos, para siempre) y `vitrina_ping` (aviso en vivo). Todo con RLS. No toca las tablas existentes.
- **Tiendas:** `bayamon` (real, hora del servidor) y `bayamon-prueba` (para probar: simulador, hora simulada y escenario de prueba). Las ventas simuladas no se aceptan en la tienda real.
- **Roles:** Vitrina, Freidora, Vitrina y freidora (tablet compartida) y Administración. Se asignan en Administración → Usuarios.
- **Sin conexión:** la acción no se guarda y la pantalla lo dice. No hay cola sin conexión todavía.

### Para actualizar
1. `node build.mjs`
2. Copia `dist/vitrina.html` a `ladelos-app/public/` y haz push.
3. Si cambió la lógica, pega `dist/edge/vitrina.ts` en Supabase → Edge Functions → vitrina → Code y dale Deploy.

## Plan original de la Fase 2

Propuesta: usar **Supabase**, el mismo proyecto que ya usa ladelos-app.
- Tablas con políticas de acceso, cambios en tiempo real entre la tablet y el iPhone, y funciones del servidor que apliquen cada comando en una transacción con control de versión.
- Cuentas reales por empleado y la hora tomada del servidor.
- El motor (`src/domain`) se reutiliza tal cual del lado del servidor.

Costo: el plan gratis de Supabase probablemente alcanza para una tienda, aunque pausa los proyectos inactivos. El plan Pro cuesta unos US$25 al mes por organización, y quizás ya lo pagas por ladelos-app. Para la Fase 3, el servidor del webhook de Clover puede ser una Edge Function de Supabase. **No se ha contratado nada.**

## Fase 3: webhook de Clover (Edge Function `clover-webhook`)

Archivo para pegar en Supabase: `dist/edge/clover-webhook.ts` (se genera con `node build.mjs`).
1. Supabase → Edge Functions → crear `clover-webhook`, pegar el archivo y **desactivar Verify JWT** (Clover no manda el JWT; la seguridad es el código en `X-Clover-Auth`).
2. Secrets: `CLOVER_WEBHOOK_CODE`, `CLOVER_API_TOKEN` (solo lectura de órdenes), `CLOVER_MERCHANTS` = `{"REKD5Z4C7KA71":"bayamon"}`. Opcional: `CLOVER_API_BASE`, `CLOVER_DIRECT_BUTTONS=false` para apagar los botones directos.
3. Clover (Developer Dashboard): app con permiso de leer órdenes, webhook a `https://<proyecto>.supabase.co/functions/v1/clover-webhook`; el código de verificación aparece en los logs de la función.
4. Probar primero con una orden de prueba y revisar Administración → historial. Los eventos son idempotentes: si Clover reintenta no se descuenta dos veces.
