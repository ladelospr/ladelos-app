-- ============================================
-- LADELOS PASTELILLOS - Schema de Base de Datos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Tabla de perfiles de usuario (extiende auth.users de Supabase)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'supervisor', 'cocina', 'produccion')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Días de ventas (reportes de Clover)
CREATE TABLE dias_ventas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  dia_semana TEXT NOT NULL,
  total_vendido INTEGER,
  productos JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Tandas de cocina (proteínas cocinadas)
CREATE TABLE tandas_cocina (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  proteina TEXT NOT NULL,
  libras DECIMAL(8,2) NOT NULL,
  tipo TEXT DEFAULT 'cocinar' CHECK (tipo IN ('cocinar', 'preparar')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Conteo del Carrito 2 (pastelillo armado pendiente)
CREATE TABLE conteos_carrito2 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  productos JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(fecha)
);

-- Clientes mayoristas
CREATE TABLE clientes_mayoristas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Órdenes de mayoristas
CREATE TABLE ordenes_mayoristas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes_mayoristas(id),
  cliente_nombre TEXT NOT NULL,
  fecha_entrega DATE NOT NULL,
  fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '{}',
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'entregada', 'cancelada')),
  notas TEXT,
  total_calculado DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Facturas generadas
CREATE TABLE facturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  orden_id UUID REFERENCES ordenes_mayoristas(id),
  cliente_nombre TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '{}',
  total DECIMAL(10,2) NOT NULL,
  estado TEXT DEFAULT 'emitida' CHECK (estado IN ('emitida', 'pagada', 'anulada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dias_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tandas_cocina ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteos_carrito2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_mayoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_mayoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver su propio perfil
CREATE POLICY "usuarios_ver_perfil" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin puede ver todos los perfiles
CREATE POLICY "admin_ver_perfiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Días de ventas: todos pueden ver, solo admin/supervisor pueden insertar
CREATE POLICY "ver_dias_ventas" ON dias_ventas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "insertar_dias_ventas" ON dias_ventas
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor'))
  );

-- Tandas de cocina: todos pueden ver, cocina/admin/supervisor pueden insertar
CREATE POLICY "ver_tandas" ON tandas_cocina
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "insertar_tandas" ON tandas_cocina
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor', 'cocina'))
  );

-- Carrito 2: todos pueden ver e insertar
CREATE POLICY "ver_carrito2" ON conteos_carrito2
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "insertar_carrito2" ON conteos_carrito2
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "actualizar_carrito2" ON conteos_carrito2
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Mayoristas y facturas: solo admin/supervisor
CREATE POLICY "ver_mayoristas" ON clientes_mayoristas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor'))
  );

CREATE POLICY "gestionar_mayoristas" ON clientes_mayoristas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor'))
  );

CREATE POLICY "ver_ordenes" ON ordenes_mayoristas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor'))
  );

CREATE POLICY "gestionar_ordenes" ON ordenes_mayoristas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor'))
  );

CREATE POLICY "ver_facturas" ON facturas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'supervisor'))
  );

CREATE POLICY "gestionar_facturas" ON facturas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- ============================================
-- FUNCIÓN: auto-crear perfil al registrar usuario
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nombre, rol)
  VALUES (NEW.id, NEW.email, 'cocina');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
