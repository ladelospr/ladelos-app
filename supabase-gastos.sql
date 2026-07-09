-- ============================================
-- TABLA DE GASTOS (agregar al schema existente)
-- Ejecutar en Supabase SQL Editor
-- ============================================

CREATE TABLE gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor TEXT NOT NULL,
  numero_factura TEXT,
  fecha DATE NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'materia_prima', 'utilidades', 'servicios', 'renta',
    'equipo', 'nomina', 'marketing', 'otros'
  )),
  items JSONB DEFAULT '[]',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notas TEXT,
  tiene_imagen BOOLEAN DEFAULT false,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

-- Admin y supervisor pueden ver y gestionar todos los gastos
CREATE POLICY "ver_gastos" ON gastos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor'))
  );

CREATE POLICY "insertar_gastos" ON gastos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor'))
  );

CREATE POLICY "actualizar_gastos" ON gastos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor'))
  );

-- Índices para reportes rápidos
CREATE INDEX idx_gastos_anio_mes ON gastos(anio, mes);
CREATE INDEX idx_gastos_categoria ON gastos(categoria);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
