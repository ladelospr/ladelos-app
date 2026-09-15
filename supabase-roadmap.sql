-- ============================================================
-- LADELOS PASTELILLOS — Tablas del roadmap
-- Ejecutar en el SQL Editor de Supabase.
--
-- Cubre:
--   Fase 2  — inv_ordenes_compra  (marcar la lista de compra como enviada)
--   Fase 3  — bucket de storage para las fotos de gastos fijos
--   Fase 4  — empleados, disponibilidades, horarios_asignados,
--             horarios_historial
--   Extra   — arregla la recursión infinita de RLS en profiles
--
-- Todo el archivo es idempotente: se puede correr dos veces sin romper nada.
-- ============================================================


-- ============================================================
-- 0. ARREGLO DE RLS (hacer esto PRIMERO)
-- ============================================================
--
-- La política "admin_ver_perfiles" de supabase-schema.sql hace:
--
--   CREATE POLICY "admin_ver_perfiles" ON profiles
--     FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE ...));
--
-- Es decir: para decidir si puedes leer profiles, Postgres tiene que leer
-- profiles, lo que vuelve a evaluar la política... Eso es recursión infinita
-- y Postgres la corta con el error 42P17 ("infinite recursion detected in
-- policy for relation profiles"). El mismo patrón está copiado en casi todas
-- las tablas del schema, así que cualquier consulta que dependa del rol falla
-- o devuelve vacío.
--
-- La salida estándar es una función SECURITY DEFINER: corre con los permisos
-- de su dueño y por eso NO vuelve a disparar RLS sobre profiles.

CREATE OR REPLACE FUNCTION public.mi_rol()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.mi_rol() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.es_gerencia()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.mi_rol() IN ('admin', 'supervisor'), false);
$$;

-- Reemplaza la política recursiva de profiles.
DROP POLICY IF EXISTS "admin_ver_perfiles" ON public.profiles;

CREATE POLICY "admin_gestiona_perfiles" ON public.profiles
  FOR ALL
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

-- Las demás tablas del schema original tienen el mismo patrón recursivo.
-- No se tocan aquí para no cambiar módulos que ya están en producción,
-- pero la migración recomendada es sustituir en cada una
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN (...))
-- por
--     public.es_gerencia()   (o public.es_admin())


-- ============================================================
-- 1. FASE 2 — Órdenes de compra enviadas
-- ============================================================
-- Guarda una foto del momento en que se mandó el pedido al proveedor.
-- items_json lleva las filas tal como se vieron en pantalla, para que la
-- orden siga siendo legible aunque el inventario cambie después.

CREATE TABLE IF NOT EXISTS public.inv_ordenes_compra (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda      TEXT NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  items_json  JSONB NOT NULL DEFAULT '[]',
  enviado     BOOLEAN NOT NULL DEFAULT false,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_ordenes_compra_tienda_fecha
  ON public.inv_ordenes_compra(tienda, fecha DESC);

ALTER TABLE public.inv_ordenes_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gerencia_ordenes_compra" ON public.inv_ordenes_compra;
CREATE POLICY "gerencia_ordenes_compra" ON public.inv_ordenes_compra
  FOR ALL
  USING (public.es_gerencia())
  WITH CHECK (public.es_gerencia());


-- ============================================================
-- 2. FASE 3 — Storage de las fotos de gastos fijos
-- ============================================================
-- Bucket privado: son facturas de servicios, no tienen por qué ser públicas.
-- La app pide URLs firmadas cuando hay que enseñar la foto.

INSERT INTO storage.buckets (id, name, public)
VALUES ('gastos_fijos', 'gastos_fijos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "gerencia_lee_gastos_fijos" ON storage.objects;
CREATE POLICY "gerencia_lee_gastos_fijos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'gastos_fijos' AND public.es_gerencia());

DROP POLICY IF EXISTS "gerencia_sube_gastos_fijos" ON storage.objects;
CREATE POLICY "gerencia_sube_gastos_fijos" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'gastos_fijos' AND public.es_gerencia());

DROP POLICY IF EXISTS "gerencia_actualiza_gastos_fijos" ON storage.objects;
CREATE POLICY "gerencia_actualiza_gastos_fijos" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'gastos_fijos' AND public.es_gerencia());

-- La app usa upsert:true al subir la foto; en storage eso se traduce en un
-- UPDATE sobre el objeto existente, así que la política de arriba hace falta.


-- ============================================================
-- 3. FASE 4 — Empleados
-- ============================================================
-- Los 11 empleados. profile_id es opcional: no todos tienen login.
-- La tarifa por hora NO va aquí — es dato de nómina y la nómina espera
-- a que el RLS del proyecto esté completo.

CREATE TABLE IF NOT EXISTS public.empleados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  tienda      TEXT,
  profile_id  UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empleados_activo ON public.empleados(activo);

ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

-- Todo el mundo autenticado puede ver la lista (hace falta para leer un
-- horario), pero solo gerencia la edita.
DROP POLICY IF EXISTS "ver_empleados" ON public.empleados;
CREATE POLICY "ver_empleados" ON public.empleados
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "gerencia_gestiona_empleados" ON public.empleados;
CREATE POLICY "gerencia_gestiona_empleados" ON public.empleados
  FOR ALL
  USING (public.es_gerencia())
  WITH CHECK (public.es_gerencia());


-- ============================================================
-- 4. FASE 4 — Disponibilidades
-- ============================================================
-- Una fila por empleado / día / bloque.
--   dia_semana: 0 = lunes ... 6 = domingo
--   bloque:     1 = 7AM-2PM, 2 = 2PM-7PM
-- El UNIQUE es lo que permite que la app haga upsert sin duplicar.

CREATE TABLE IF NOT EXISTS public.disponibilidades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  bloque      SMALLINT NOT NULL CHECK (bloque IN (1, 2)),
  disponible  BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empleado_id, dia_semana, bloque)
);

ALTER TABLE public.disponibilidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver_disponibilidades" ON public.disponibilidades;
CREATE POLICY "ver_disponibilidades" ON public.disponibilidades
  FOR SELECT USING (auth.role() = 'authenticated');

-- Gerencia edita a cualquiera; un empleado solo se edita a sí mismo.
DROP POLICY IF EXISTS "editar_disponibilidades" ON public.disponibilidades;
CREATE POLICY "editar_disponibilidades" ON public.disponibilidades
  FOR ALL
  USING (
    public.es_gerencia()
    OR empleado_id IN (SELECT id FROM public.empleados WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    public.es_gerencia()
    OR empleado_id IN (SELECT id FROM public.empleados WHERE profile_id = auth.uid())
  );


-- ============================================================
-- 5. FASE 4 — Horarios asignados
-- ============================================================
-- semana_del es siempre el lunes de esa semana.

CREATE TABLE IF NOT EXISTS public.horarios_asignados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  semana_del  DATE NOT NULL,
  dia         SMALLINT NOT NULL CHECK (dia BETWEEN 0 AND 6),
  bloque      SMALLINT NOT NULL CHECK (bloque IN (1, 2)),
  tienda      TEXT,
  asignado    BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empleado_id, semana_del, dia, bloque)
);

CREATE INDEX IF NOT EXISTS idx_horarios_semana
  ON public.horarios_asignados(semana_del, dia, bloque);

ALTER TABLE public.horarios_asignados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver_horarios" ON public.horarios_asignados;
CREATE POLICY "ver_horarios" ON public.horarios_asignados
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "gerencia_gestiona_horarios" ON public.horarios_asignados;
CREATE POLICY "gerencia_gestiona_horarios" ON public.horarios_asignados
  FOR ALL
  USING (public.es_gerencia())
  WITH CHECK (public.es_gerencia());


-- ============================================================
-- 6. FASE 4 — Historial de cambios (auditoría)
-- ============================================================
-- Quién movió el horario de quién y cuándo. Se llena solo con el trigger
-- de abajo; la app nunca escribe aquí directamente.

CREATE TABLE IF NOT EXISTS public.horarios_historial (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id  UUID,
  empleado_id UUID,
  semana_del  DATE,
  dia         SMALLINT,
  bloque      SMALLINT,
  accion      TEXT NOT NULL CHECK (accion IN ('insert', 'update', 'delete')),
  antes       JSONB,
  despues     JSONB,
  cambiado_por UUID,
  cambiado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_horarios_historial_empleado
  ON public.horarios_historial(empleado_id, cambiado_at DESC);

ALTER TABLE public.horarios_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gerencia_ve_historial" ON public.horarios_historial;
CREATE POLICY "gerencia_ve_historial" ON public.horarios_historial
  FOR SELECT USING (public.es_gerencia());

CREATE OR REPLACE FUNCTION public.registrar_cambio_horario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fila RECORD;
BEGIN
  fila := COALESCE(NEW, OLD);
  INSERT INTO public.horarios_historial (
    horario_id, empleado_id, semana_del, dia, bloque,
    accion, antes, despues, cambiado_por
  )
  VALUES (
    fila.id, fila.empleado_id, fila.semana_del, fila.dia, fila.bloque,
    LOWER(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN NULL; -- trigger AFTER: el valor de retorno se ignora
END;
$$;

DROP TRIGGER IF EXISTS trg_horarios_historial ON public.horarios_asignados;
CREATE TRIGGER trg_horarios_historial
  AFTER INSERT OR UPDATE OR DELETE ON public.horarios_asignados
  FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio_horario();


-- ============================================================
-- 7. Semilla opcional de empleados
-- ============================================================
-- Descomenta y cambia los nombres por los 11 reales.
--
-- INSERT INTO public.empleados (nombre, tienda) VALUES
--   ('Nombre 1',  'Bayamón'),
--   ('Nombre 2',  'Bayamón'),
--   ('Nombre 3',  'Cataño')
-- ON CONFLICT DO NOTHING;
