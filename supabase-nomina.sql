-- ============================================================
-- LADELOS PASTELILLOS — Fase 5: ponches y nómina
--
-- Ejecutar DESPUÉS de:
--   1. supabase-roadmap.sql   (crea empleados y las funciones de RLS)
--   2. supabase-rls-fix.sql   (quita la recursión de las tablas viejas)
--
-- Esto es dato sensible: sueldos. Las políticas de aquí son más estrictas
-- que las del resto de la app y usan es_admin(), no es_gerencia().
--
-- Idempotente.
-- ============================================================

DO $$
BEGIN
  IF to_regprocedure('public.es_admin()') IS NULL THEN
    RAISE EXCEPTION
      'Falta public.es_admin(). Ejecuta supabase-roadmap.sql primero.';
  END IF;
  IF to_regclass('public.empleados') IS NULL THEN
    RAISE EXCEPTION
      'Falta la tabla empleados. Ejecuta supabase-roadmap.sql primero.';
  END IF;
END $$;


-- ============================================================
-- 1. Tarifas por hora
-- ============================================================
-- La tarifa va en su propia tabla, no como columna de empleados, por una
-- razón concreta: el RLS de Postgres es por FILA, no por columna. La tabla
-- empleados la tiene que poder leer cualquiera autenticado (Horarios la
-- necesita para enseñar nombres), así que una columna tarifa_hora ahí sería
-- visible para todo el mundo. Separándola, el sueldo queda detrás de su
-- propia política admin-only.
--
-- Se guarda con historial (vigente_desde) para que una subida de sueldo no
-- reescriba las nóminas ya generadas.

CREATE TABLE IF NOT EXISTS public.empleados_tarifas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id   UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  tarifa_hora   NUMERIC(10,2) NOT NULL CHECK (tarifa_hora >= 0),
  vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES public.profiles(id),
  UNIQUE (empleado_id, vigente_desde)
);

CREATE INDEX IF NOT EXISTS idx_tarifas_empleado
  ON public.empleados_tarifas(empleado_id, vigente_desde DESC);

ALTER TABLE public.empleados_tarifas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_gestiona_tarifas" ON public.empleados_tarifas;
CREATE POLICY "admin_gestiona_tarifas" ON public.empleados_tarifas
  FOR ALL
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

-- Un empleado puede ver su propia tarifa, nada más.
DROP POLICY IF EXISTS "empleado_ve_su_tarifa" ON public.empleados_tarifas;
CREATE POLICY "empleado_ve_su_tarifa" ON public.empleados_tarifas
  FOR SELECT
  USING (
    empleado_id IN (SELECT id FROM public.empleados WHERE profile_id = auth.uid())
  );

-- Devuelve la tarifa vigente de un empleado en una fecha dada.
CREATE OR REPLACE FUNCTION public.tarifa_vigente(p_empleado UUID, p_fecha DATE)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tarifa_hora
  FROM public.empleados_tarifas
  WHERE empleado_id = p_empleado
    AND vigente_desde <= p_fecha
  ORDER BY vigente_desde DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.tarifa_vigente(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tarifa_vigente(UUID, DATE) TO authenticated;


-- ============================================================
-- 2. Ponches
-- ============================================================
-- Un ponche abierto es el que tiene hora_salida NULL.

CREATE TABLE IF NOT EXISTS public.ponches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id  UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  tienda       TEXT,
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_salida  TIMESTAMPTZ,
  notas        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salida_despues_de_entrada
    CHECK (hora_salida IS NULL OR hora_salida > hora_entrada)
);

CREATE INDEX IF NOT EXISTS idx_ponches_empleado_fecha
  ON public.ponches(empleado_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ponches_tienda_fecha
  ON public.ponches(tienda, fecha DESC);

-- Un empleado no puede tener dos ponches abiertos a la vez. El índice
-- parcial lo impide en la base, no solo en la interfaz: si alguien le da
-- dos veces a "Entrada" desde dos pantallas, la segunda falla.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ponche_abierto_unico
  ON public.ponches(empleado_id)
  WHERE hora_salida IS NULL;

ALTER TABLE public.ponches ENABLE ROW LEVEL SECURITY;

-- Gerencia ve todos los ponches; un empleado solo los suyos.
DROP POLICY IF EXISTS "ver_ponches" ON public.ponches;
CREATE POLICY "ver_ponches" ON public.ponches
  FOR SELECT
  USING (
    public.es_gerencia()
    OR empleado_id IN (SELECT id FROM public.empleados WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "ponchar" ON public.ponches;
CREATE POLICY "ponchar" ON public.ponches
  FOR INSERT
  WITH CHECK (
    public.es_gerencia()
    OR empleado_id IN (SELECT id FROM public.empleados WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "cerrar_ponche" ON public.ponches;
CREATE POLICY "cerrar_ponche" ON public.ponches
  FOR UPDATE
  USING (
    public.es_gerencia()
    OR empleado_id IN (SELECT id FROM public.empleados WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    public.es_gerencia()
    OR empleado_id IN (SELECT id FROM public.empleados WHERE profile_id = auth.uid())
  );

-- Borrar un ponche es corregir el registro de horas de alguien: solo admin.
DROP POLICY IF EXISTS "admin_borra_ponches" ON public.ponches;
CREATE POLICY "admin_borra_ponches" ON public.ponches
  FOR DELETE USING (public.es_admin());


-- ============================================================
-- 3. Nómina
-- ============================================================
-- periodo es el primer día del mes ('2026-09-01'), igual que en gastos fijos.

CREATE TABLE IF NOT EXISTS public.nomina (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id      UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  periodo          DATE NOT NULL,
  horas_asignadas  NUMERIC(8,2) NOT NULL DEFAULT 0,
  horas_trabajadas NUMERIC(8,2) NOT NULL DEFAULT 0,
  tarifa_hora      NUMERIC(10,2) NOT NULL DEFAULT 0,
  bruto            NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuentos       NUMERIC(12,2) NOT NULL DEFAULT 0,
  neto             NUMERIC(12,2) GENERATED ALWAYS AS (bruto - descuentos) STORED,
  notas            TEXT,
  cerrada          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empleado_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_nomina_periodo ON public.nomina(periodo DESC);

ALTER TABLE public.nomina ENABLE ROW LEVEL SECURITY;

-- Solo admin gestiona la nómina. Ni siquiera supervisor: son sueldos.
DROP POLICY IF EXISTS "admin_gestiona_nomina" ON public.nomina;
CREATE POLICY "admin_gestiona_nomina" ON public.nomina
  FOR ALL
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

-- Un empleado puede ver su propia nómina, nada más.
DROP POLICY IF EXISTS "empleado_ve_su_nomina" ON public.nomina;
CREATE POLICY "empleado_ve_su_nomina" ON public.nomina
  FOR SELECT
  USING (
    empleado_id IN (SELECT id FROM public.empleados WHERE profile_id = auth.uid())
  );

-- Una nómina cerrada no se vuelve a tocar: es el registro de lo que se pagó.
CREATE OR REPLACE FUNCTION public.proteger_nomina_cerrada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.cerrada AND NEW.cerrada THEN
    RAISE EXCEPTION 'La nómina de este período ya está cerrada. Reábrela para editarla.';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nomina_cerrada ON public.nomina;
CREATE TRIGGER trg_nomina_cerrada
  BEFORE UPDATE ON public.nomina
  FOR EACH ROW EXECUTE FUNCTION public.proteger_nomina_cerrada();


-- ============================================================
-- 4. Cálculo de horas
-- ============================================================
-- Horas efectivamente ponchadas por un empleado en un mes.
-- Los ponches abiertos (hora_salida NULL) NO cuentan: todavía no son horas
-- trabajadas, son un ponche que alguien se dejó sin cerrar.

CREATE OR REPLACE FUNCTION public.horas_trabajadas(p_empleado UUID, p_periodo DATE)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(SUM(EXTRACT(EPOCH FROM (hora_salida - hora_entrada)) / 3600.0)::numeric, 2),
    0
  )
  FROM public.ponches
  WHERE empleado_id = p_empleado
    AND hora_salida IS NOT NULL
    AND fecha >= date_trunc('month', p_periodo)::date
    AND fecha <  (date_trunc('month', p_periodo) + INTERVAL '1 month')::date;
$$;

-- Horas que se le asignaron en el horario. Bloque 1 (7AM-2PM) son 7 horas,
-- bloque 2 (2PM-7PM) son 5.
--
-- Aproximación conocida: una semana se cuenta entera en el mes de su lunes,
-- así que la semana que va del 28 de septiembre al 4 de octubre cae toda en
-- septiembre. Es una cifra de referencia para comparar contra lo ponchado;
-- lo que se paga sale de horas_trabajadas, que sí va por fecha real.
CREATE OR REPLACE FUNCTION public.horas_asignadas(p_empleado UUID, p_periodo DATE)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE WHEN bloque = 1 THEN 7 ELSE 5 END), 0)::numeric
  FROM public.horarios_asignados
  WHERE empleado_id = p_empleado
    AND asignado
    AND semana_del >= date_trunc('month', p_periodo)::date
    AND semana_del <  (date_trunc('month', p_periodo) + INTERVAL '1 month')::date;
$$;

REVOKE ALL ON FUNCTION public.horas_trabajadas(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.horas_asignadas(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.horas_trabajadas(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.horas_asignadas(UUID, DATE) TO authenticated;


-- ============================================================
-- 5. Generar la nómina de un mes
-- ============================================================
-- Recalcula horas, tarifa y bruto para todos los empleados activos.
-- Respeta lo que ya esté cerrado y NO pisa los descuentos que el admin
-- haya escrito a mano.
--
-- Los descuentos (seguro social, medicare, retención de PR, CRIM...) NO se
-- calculan aquí a propósito: dependen del W-4 de cada empleado y de las
-- tablas del Departamento de Hacienda, y meterlos a ojo sería inventar
-- números sobre el sueldo de alguien. Se escriben a mano o se sacan del
-- proveedor de payroll.

-- Los parámetros de salida van con prefijo out_ porque PL/pgSQL los trata
-- como variables y chocarían con las columnas homónimas de nomina
-- ("column reference empleado_id is ambiguous").
CREATE OR REPLACE FUNCTION public.generar_nomina(p_periodo DATE)
RETURNS TABLE (out_empleado_id UUID, out_horas NUMERIC, out_bruto NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes DATE := date_trunc('month', p_periodo)::date;
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede generar la nómina.';
  END IF;

  -- RETURN QUERY no acepta un INSERT directamente: hay que envolverlo en
  -- un CTE, que es donde Postgres sí permite sentencias con RETURNING.
  RETURN QUERY
  WITH upsert AS (
  INSERT INTO public.nomina AS n (
    empleado_id, periodo, horas_asignadas, horas_trabajadas, tarifa_hora, bruto
  )
  SELECT
    e.id,
    v_mes,
    public.horas_asignadas(e.id, v_mes),
    public.horas_trabajadas(e.id, v_mes),
    COALESCE(public.tarifa_vigente(e.id, v_mes), 0),
    ROUND(
      public.horas_trabajadas(e.id, v_mes)
      * COALESCE(public.tarifa_vigente(e.id, v_mes), 0),
      2
    )
  FROM public.empleados e
  WHERE e.activo
  ON CONFLICT (empleado_id, periodo) DO UPDATE SET
    horas_asignadas  = EXCLUDED.horas_asignadas,
    horas_trabajadas = EXCLUDED.horas_trabajadas,
    tarifa_hora      = EXCLUDED.tarifa_hora,
    bruto            = EXCLUDED.bruto
    -- descuentos no se toca: lo escribe el admin
  WHERE NOT n.cerrada
  RETURNING n.empleado_id, n.horas_trabajadas, n.bruto
  )
  SELECT * FROM upsert;
END;
$$;

REVOKE ALL ON FUNCTION public.generar_nomina(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generar_nomina(DATE) TO authenticated;


-- ============================================================
-- 6. Semilla opcional de tarifas
-- ============================================================
-- INSERT INTO public.empleados_tarifas (empleado_id, tarifa_hora, vigente_desde)
-- SELECT id, 10.50, '2026-01-01' FROM public.empleados
-- ON CONFLICT DO NOTHING;
