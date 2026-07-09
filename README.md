# Ladelos Pastelillos — Sistema Operacional

App web de gestión de producción, inventario, cocina y mayoristas para Ladelos Pastelillos.

---

## Stack
- React 18 + Vite
- Supabase (base de datos + autenticación)
- Vercel (hosting)

---

## Instrucciones de despliegue (paso a paso)

### Paso 1 — Crear cuenta en GitHub
1. Ve a https://github.com → "Sign up"
2. Crea cuenta con tu email

### Paso 2 — Crear proyecto en Supabase
1. Ve a https://supabase.com → "Start your project"
2. Conecta con tu cuenta de GitHub
3. Crea un nuevo proyecto (nombre: ladelos-app)
4. Espera ~2 minutos a que se inicialice
5. Ve a "SQL Editor" y pega el contenido de `supabase-schema.sql`
6. Ejecuta el SQL
7. Ve a Settings → API y copia:
   - Project URL (VITE_SUPABASE_URL)
   - anon public key (VITE_SUPABASE_ANON_KEY)

### Paso 3 — Subir código a GitHub
1. En GitHub, crea un nuevo repositorio llamado "ladelos-app"
2. Descarga el ZIP de este proyecto
3. En tu computadora, abre terminal y ejecuta:
```
cd ladelos-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/ladelos-app.git
git push -u origin main
```

### Paso 4 — Obtener API key de Anthropic (para leer facturas con IA)
1. Ve a https://console.anthropic.com
2. Crea cuenta o inicia sesión
3. Ve a "API Keys" → "Create Key"
4. Copia la key (empieza con sk-ant-...)

### Paso 5 — Ejecutar SQL adicional para gastos
1. En Supabase → SQL Editor → New query
2. Pega el contenido de `supabase-gastos.sql`
3. Ejecuta

### Paso 6 — Desplegar en Vercel
1. Ve a https://vercel.com → "Sign Up" con GitHub
2. Click "New Project" → importa el repositorio "ladelos-app"
3. En "Environment Variables" agrega:
   - VITE_SUPABASE_URL = (tu URL de Supabase)
   - VITE_SUPABASE_ANON_KEY = (tu anon key)
   - VITE_ANTHROPIC_API_KEY = (tu API key de Anthropic)
4. Click "Deploy"
5. En ~2 minutos tienes tu URL: ladelos-app.vercel.app

### Paso 5 — Crear el primer usuario (tú)
1. En Supabase → Authentication → Users → "Invite user"
2. Ingresa tu email
3. Acepta la invitación en tu email
4. En Supabase → Table Editor → profiles → edita tu fila:
   - nombre: Danny
   - rol: admin

---

## Módulos y acceso por rol

| Módulo        | Admin | Supervisor | Cocina | Producción |
|---------------|-------|------------|--------|------------|
| Ventas        | ✓     | ✓          |        |            |
| Cocina        | ✓     | ✓          | ✓      |            |
| Calendario    | ✓     | ✓          | ✓      | ✓          |
| Carrito 2     | ✓     | ✓          | ✓      | ✓          |
| Producción    | ✓     | ✓          | ✓      | ✓          |
| Mayoristas    | ✓     | ✓          |        |            |
| Ingredientes  | ✓     | ✓          |        | ✓          |
| Facturas      | ✓     | ✓          |        |            |
| Historial     | ✓     | ✓          |        |            |
| Configuración | ✓     |            |        |            |

---

## Soporte
Sistema desarrollado con Claude (Anthropic). Para modificaciones, abre una conversación nueva con el código y describe el cambio.
