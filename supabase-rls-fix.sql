-- ============================================================
-- LADELOS PASTELILLOS — Migración de RLS de las tablas viejas
--
-- Ejecutar DESPUÉS de supabase-roadmap.sql (que es quien crea las
-- funciones mi_rol(), es_admin() y es_gerencia()).
--
-- Por qué hace falta
-- ------------------
-- supabase-schema.sql y supabase-gastos.sql definen sus políticas así:
--
--   CREATE POLICY "ver_gastos" ON gastos
--     FOR SELECT USING (
--       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN (...))
--     );
--
-- Para evaluar esa política Postgres tiene que leer profiles, y leer profiles
-- vuelve a evaluar la política de profiles, que a su vez lee profiles...
-- Postgres corta el ciclo con el error 42P17:
--
--   infinite recursion detected in policy for relation "profiles"
--
-- El resultado en la práctica es que las consultas fallan o devuelven vacío
-- sin explicación. Las funciones SECURITY DEFINER rompen el ciclo porque
-- corren con los permisos de su dueño y no vuelven a disparar RLS.
--
-- Esta migración es mecánica: misma semántica, sin la recursión. No cambia
-- quién puede ver qué.
--
-- Idempotente: se puede correr dos veces.
-- ============================================================

-- Comprobación previa: sin las funciones esto no tiene sentido.
DO $$
BEGIN
  IF to_regprocedure('public.es_gerencia()') IS NULL THEN
    RAISE EXCEPTION
      'Falta public.es_gerencia(). Ejecuta supabase-roadmap.sql primero.';
  END IF;
END $$;


-- ------------------------------------------------------------
-- dias_ventas
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "insertar_dias_ventas" ON public.dias_ventas;
CREATE POLICY "insertar_dias_ventas" ON public.dias_ventas
  FOR INSERT WITH CHECK (public.es_gerencia());

-- "ver_dias_ventas" usa auth.role() = 'authenticated', que no es recursivo.
-- Se deja como está.


-- ------------------------------------------------------------
-- tandas_cocina
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "insertar_tandas" ON public.tandas_cocina;
CREATE POLICY "insertar_tandas" ON public.tandas_cocina
  FOR INSERT WITH CHECK (
    COALESCE(public.mi_rol() IN ('admin', 'supervisor', 'cocina'), false)
  );


-- ------------------------------------------------------------
-- clientes_mayoristas
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "ver_mayoristas" ON public.clientes_mayoristas;
DROP POLICY IF EXISTS "gestionar_mayoristas" ON public.clientes_mayoristas;

-- FOR ALL ya cubre el SELECT, así que las dos políticas de antes se
-- colapsan en una sola.
CREATE POLICY "gestionar_mayoristas" ON public.clientes_mayoristas
  FOR ALL
  USING (public.es_gerencia())
  WITH CHECK (public.es_gerencia());


-- ------------------------------------------------------------
-- ordenes_mayoristas
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "ver_ordenes" ON public.ordenes_mayoristas;
DROP POLICY IF EXISTS "gestionar_ordenes" ON public.ordenes_mayoristas;

CREATE POLICY "gestionar_ordenes" ON public.ordenes_mayoristas
  FOR ALL
  USING (public.es_gerencia())
  WITH CHECK (public.es_gerencia());


-- ------------------------------------------------------------
-- facturas
-- ------------------------------------------------------------
-- Ojo: aquí el schema original daba SELECT a gerencia pero el resto de
-- operaciones solo a admin. Se mantiene esa diferencia.
DROP POLICY IF EXISTS "ver_facturas" ON public.facturas;
CREATE POLICY "ver_facturas" ON public.facturas
  FOR SELECT USING (public.es_gerencia());

DROP POLICY IF EXISTS "gestionar_facturas" ON public.facturas;
CREATE POLICY "gestionar_facturas" ON public.facturas
  FOR ALL
  USING (public.es_admin())
  WITH CHECK (public.es_admin());


-- ------------------------------------------------------------
-- gastos (de supabase-gastos.sql)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.gastos') IS NULL THEN
    RAISE NOTICE 'La tabla gastos no existe; se salta.';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "ver_gastos" ON public.gastos';
  EXECUTE 'DROP POLICY IF EXISTS "insertar_gastos" ON public.gastos';
  EXECUTE 'DROP POLICY IF EXISTS "actualizar_gastos" ON public.gastos';
  EXECUTE 'CREATE POLICY "gestionar_gastos" ON public.gastos
             FOR ALL
             USING (public.es_gerencia())
             WITH CHECK (public.es_gerencia())';
END $$;


-- ------------------------------------------------------------
-- conteos_carrito2
-- ------------------------------------------------------------
-- Sus políticas usan auth.role() = 'authenticated', que no es recursivo.
-- No hace falta tocarlas.


-- ============================================================
-- Comprobación
-- ============================================================
-- Después de correr esto, no debería quedar ninguna política que lea
-- profiles desde dentro. Esta consulta tiene que devolver 0 filas:
--
--   SELECT schemaname, tablename, policyname
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename <> 'profiles'
--     AND (qual LIKE '%FROM profiles%' OR with_check LIKE '%FROM profiles%');
