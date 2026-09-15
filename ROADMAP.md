# Roadmap Ladelos — estado

Qué quedó hecho en esta tanda, qué falta y qué hay que correr en Supabase
para que funcione.

## Antes de nada: correr el SQL

```
supabase-roadmap.sql   → pegar en el SQL Editor de Supabase y ejecutar
```

Crea `inv_ordenes_compra`, `empleados`, `disponibilidades`,
`horarios_asignados`, `horarios_historial`, el bucket de storage
`gastos_fijos`, y arregla la recursión de RLS en `profiles` (ver más abajo).

Y desplegar el Edge Function:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy process-receipt
```

---

## Fase 1 — Recibos ✅

Lo que estaba roto y ahora está arreglado:

- **La llave de Anthropic viajaba al navegador.** `Recibos.jsx` llamaba a
  `api.anthropic.com` con `import.meta.env.VITE_ANTHROPIC_API_KEY`. Todo lo
  que empieza con `VITE_` se empaqueta en el bundle, así que la llave era
  pública para cualquiera que abriera la app y mirara el código. Aparte de
  eso, `api.anthropic.com` no manda cabeceras CORS, así que la llamada desde
  el navegador fallaba siempre. **Si esa llave llegó a estar en producción,
  rótala.**
- Ahora la llamada pasa por el Edge Function `process-receipt`, que guarda la
  llave como secreto del proyecto, valida la sesión del usuario y exige rol
  `admin` o `supervisor`.
- El modelo se llama con *strict tool use*, así que los datos vienen
  validados contra un esquema en vez de sacados con un regex de un bloque de
  texto.
- **Validación antes de guardar**: no se guarda sin suplidor, sin fecha, o
  con total ≤ 0.
- Los datos extraídos salen en un formulario **editable**: lo que se guarda
  es lo que el usuario ve, no lo que adivinó la IA.
- Si fallan las líneas (`inv_recibo_lineas`), se borra la cabecera para no
  dejar un recibo huérfano a medias.
- **Historial de los últimos 10 recibos** en la misma pantalla.

## Fase 2 — Lista de compra ✅

`src/pages/ListaCompra.jsx`, sobre la vista `inv_lista_compra`.

- Pestañas Bayamón / Cataño.
- Tabla: Área | Producto | En mano | Red zone | Par | Pedir | Origen.
- Filtros por área y por origen (conteo / dos cajas).
- Resumen arriba: "N items para pedir".
- **Copiar para WhatsApp**: texto agrupado por área, con negritas de WhatsApp.
  Tiene respaldo para navegadores sin `navigator.clipboard` (pasa en http).
- **Exportar Excel**: CSV con BOM UTF-8, que es lo que hace que Excel abra los
  acentos bien. Si hace falta un `.xlsx` de verdad hay que meter una
  librería (`xlsx` o `exceljs`); el CSV evita esa dependencia.
- **Marcar como enviado**: guarda la orden en `inv_ordenes_compra`.

Nota: los nombres de columna de la vista se leen por alias
(`producto` / `producto_nombre` / `nombre`, etc.), así que si la vista se
renombra por dentro la pantalla no se cae. Si `inv_lista_compra` no trae
columna `tienda`, las dos pestañas enseñan lo mismo — hay que añadirla a la
vista para que el filtro por tienda tenga efecto.

## Fase 3 — Gastos fijos ✅

`src/pages/GastosFijos.jsx`, sobre `inv_gastos_fijos`.

- Selector de mes, y dos columnas (Bayamón | Cataño).
- Por gasto: tipo, monto, vencimiento, toggle de pagado, foto del recibo.
- Modal "Añadir gasto" con tipo, monto, vencimiento y foto.
- Totales del mes: total, pagado y pendiente.
- Alerta roja para lo que vence en 3 días o menos (y lo ya vencido).
- Las fotos van al bucket **privado** `gastos_fijos`, en
  `{tienda}/{YYYY-MM}/{id}.{ext}`, y se muestran con URL firmada. Son
  facturas de servicios; no tienen por qué ser públicas.

**Asunción a verificar**: el módulo escribe `periodo` como el primer día del
mes (`2026-09-01`). Si la columna en Supabase es `text` con formato
`2026-09`, hay que normalizarla:

```sql
ALTER TABLE inv_gastos_fijos
  ALTER COLUMN periodo TYPE date
  USING (periodo || '-01')::date;
```

## Fase 4 — Horarios: pantalla 1 ✅ / pantallas 2 y 3 ⏳

`src/pages/Horarios.jsx`.

**Hecho — Pantalla 1 (Disponibilidades):**
- Grid 7 días × 2 bloques (7AM–2PM, 2PM–7PM).
- Se guarda solo al tocar cada casilla (upsert optimista; si falla, revierte).
- Un empleado solo edita su propia disponibilidad; gerencia edita a cualquiera.
  Esto está forzado tanto en la UI como en RLS.
- Vista admin "Ver todas": matriz de todos los empleados × 14 bloques.
- Contador de horas disponibles por semana.

**Falta — Pantalla 2 (Scheduling):** necesita primero la sincronización de
Clover (abajo). Sin ventas hora por hora no hay con qué calcular "a las 7 AM
necesito 3 personas". Las tablas `horarios_asignados` y `horarios_historial`
ya están creadas y listas.

**Falta — Pantalla 3 (Reportes):** PDF semanal y horas por empleado. El PDF
necesita una librería (`jspdf` + `jspdf-autotable`, o imprimir una vista con
CSS `@media print`).

## Fase 5 — Nómina y ponches ⏸️ bloqueada a propósito

No se implementó, siguiendo el constraint del roadmap: la nómina es dato
sensible y espera a que el RLS esté arreglado.

`supabase-roadmap.sql` da el primer paso de ese arreglo — ver abajo.

## Fase 6 — Dashboards ⏳

No se implementó: los KPI de ventas dependen de la sincronización de Clover,
que todavía no persiste nada. Tiene sentido hacerlo justo después de Clover.

## Integración Clover ⏳

`src/lib/clover.js` ya habla con la API, pero llama a `api.clover.com` desde
el navegador con `VITE_CLOVER_API_TOKEN` — **el mismo problema que tenía
Recibos**: el token queda público y Clover tampoco manda CORS. Antes de
construir nada encima, esto debería moverse a un Edge Function, igual que
`process-receipt`. Después: tabla `clover_sync` y sincronización diaria.

---

## El problema de RLS (importante)

`supabase-schema.sql` define políticas así:

```sql
CREATE POLICY "admin_ver_perfiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
  );
```

Para decidir si puedes leer `profiles`, Postgres tiene que leer `profiles`,
lo que vuelve a evaluar la política. Es recursión infinita: Postgres la corta
con el error **42P17 — *infinite recursion detected in policy for relation
profiles***. El mismo patrón está copiado en casi todas las tablas del
schema.

`supabase-roadmap.sql` mete la solución estándar: funciones
`SECURITY DEFINER` (`mi_rol()`, `es_admin()`, `es_gerencia()`) que leen
`profiles` sin volver a disparar RLS, y reescribe la política de `profiles`
para usarlas. Las tablas nuevas ya las usan.

Las tablas viejas (`dias_ventas`, `tandas_cocina`, `clientes_mayoristas`,
`ordenes_mayoristas`, `facturas`, `gastos`) **siguen con el patrón
recursivo**. No se tocaron para no cambiar módulos que ya están corriendo en
producción, pero la migración es mecánica: sustituir

```sql
EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','supervisor'))
```

por

```sql
public.es_gerencia()
```

Ese es el trabajo que desbloquea la Fase 5.

---

## Nota sobre estilos

`Inventario.jsx` y `Recibos.jsx` ya venían escritos con clases de Tailwind,
pero Tailwind nunca se había instalado: las clases no hacían nada y las dos
pantallas salían sin estilo. Se añadió `tailwindcss` + `postcss` +
`autoprefixer` con su configuración.

Para que el *preflight* de Tailwind no aplastara los `<h2>` pelados de
Cocina, Compras, Mayoristas y Ventas, `src/index.css` restaura los tamaños
por defecto de `h1`–`h3` después de las directivas de Tailwind. Los módulos
nuevos mandan con sus clases, que ganan por especificidad.
