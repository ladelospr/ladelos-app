// ============================================
// LADELOS PASTELILLOS - Constantes del negocio
// ============================================

export const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  COCINA: 'cocina',
  PRODUCCION: 'produccion',
}

export const ROLE_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  cocina: 'Encargado de Cocina',
  produccion: 'Encargado de Producción',
}

// Acceso por módulo según rol
export const MODULO_ACCESO = {
  ventas:       ['admin', 'supervisor'],
  cocina:       ['admin', 'supervisor', 'cocina'],
  calendario:   ['admin', 'supervisor', 'cocina', 'produccion'],
  carrito2:     ['admin', 'supervisor', 'cocina', 'produccion'],
  produccion:   ['admin', 'supervisor', 'cocina', 'produccion'],
  mayoristas:   ['admin', 'supervisor'],
  ingredientes: ['admin', 'supervisor', 'produccion'],
  facturas:     ['admin', 'supervisor'],
  compras:      ['admin', 'supervisor'],
  clover:       ['admin', 'supervisor'],
  historial:    ['admin', 'supervisor'],
  configuracion:['admin'],
}

export const S = 0.75 // oz por slice de queso

export const RECETAS = {
  // CLÁSICOS
  "Carne":                      { carne_molida: 3 },
  "Pollo":                      { cadera: 3 },
  "Pizza":                      { mozzarella: 2, salsa_pizza: 1 },
  "Queso":                      { queso_americano: S * 2 },
  // CON QUESO
  "Carne con Queso Americano":  { carne_molida: 2.5, queso_americano: S },
  "Carne con Queso Mozzarella": { carne_molida: 2, mozzarella: 1 },
  "Pollo con Queso Americano":  { cadera: 2.5, queso_americano: S },
  "Pollo con Queso Mozzarella": { cadera: 2, mozzarella: 1 },
  "Revoltillo":                 { huevo: 1, jamon: 1, queso_americano: S },
  "Jamón Queso":                { jamon: 2, queso_americano: S },
  // ESPECIALIDADES
  "Carbonara":                  { pechuga: 2, salsa_alfredo: 0.5, mozzarella: 1, bacon: 1, parmesano: 0.1 },
  "Chicken Deluxe":             { cadera: 2, jamon: 1, queso_suizo: S, cebolla: 0.1, parmesano: 0.2 },
  "Cheeseburger":               { carne_molida: 2, cebolla: 0.2, pepinillo: 0.2, queso_americano: S * 2 },
  "Bistec":                     { bistec: 2, cebolla: 0.2, mozzarella: 1 },
  "BBQ Pork":                   { carnita: 3, salsa_bbq: 0.5 },
  "Carne Ahumada":              { carne_ahumada: 3 },
  "Cubano":                     { carnita: 2, jamon: 1, pepinillo: 0.2, queso_suizo: S, mostaza: 0.1 },
  "Monte Cristo":               { jamon: 1.5, pavo: 1.5, queso_suizo: S },
  "Meat Lover":                 { cadera: 1, jamon: 0.75, chorizo: 0.75, bacon: 0.75, mozzarella: 1 },
  "Pastrami":                   { pastrami: 2.5, queso_suizo: S },
  "Philly Cheesesteak":         { philly: 2.5, queso_americano: S },
  "Pechuga Rellena":            { pechuga: 2, bacon: 1.5, amarillo: 0.5, mozzarella: 0.5, queso_crema: 0.1 },
  "Pollo Bacon Ranch":          { cadera: 2, bacon: 0.5, queso_cheddar: 0.05, salsa_ranch: 0.5 },
  // GOURMET
  "Pizza Pepperoni":            { mozzarella: 2, salsa_ragu: 0.5, pepperoni: 1.5 },
  "Pizza Chorizo":              { mozzarella: 2, salsa_ragu: 0.5, chorizo: 1 },
  "Pollo Brócoli":              { cadera: 2.5, brocoli: 1, mozzarella: 1 },
  "Pollo Picante":              { cadera: 2.5, salsa_picante: 0.5, mozzarella: 1 },
  "Pastelón Pollo":             { cadera: 2.5, amarillo: 0.5, mozzarella: 0.5, queso_crema: 0.1 },
  "Revoltillo Deluxe":          { huevo: 1, jamon: 1, queso_americano: S, cebolla: 0.2, bacon: 0.5 },
  "Lasaña":                     { carne_molida: 0.2, queso_crema: 0.5, pasta_lasagna: 0.2, salsa_ragu: 0.5, mozzarella: 1 },
  "Tripleta":                   { cadera: 1.5, carnita: 1.5, jamon: 1, mayonesa: 0.2, ketchup: 0.2, cheddar_liquido: 0.2, papitas: 0.1 },
  "Pastelón de Carne":          { carne_molida: 2.5, amarillo: 0.5, mozzarella: 0.5, queso_crema: 0.1 },
  // PREMIUM
  "Camarón":                        { camaron: 3 },
  "Carbonara Camarón":              { pechuga: 1.5, salsa_alfredo: 0.5, mozzarella: 1, bacon: 1, parmesano: 0.1, camaron: 1 },
  "Camarón, Churrasco y Queso":     { camaron: 1, churrasco: 1.5, mozzarella: 1 },
  "Churrasco Queso":                { churrasco: 2.5, mozzarella: 1 },
  "Churrasco, Amarillos y Queso":   { churrasco: 2, amarillo: 1, mozzarella: 0.5 },
  "Pulpo":                          { pulpo: 3 },
  "Spicy Crab":                     { crab: 3 },
  // VEGGIE
  "Brócoli & Cebolla":          { brocoli: 2, cebolla: 2 },
  "Queso & Cebolla":            { cebolla: 2, mozzarella: 2 },
  "Brócoli & Queso":            { brocoli: 2, mozzarella: 2 },
  "Brócoli, Cebolla & Queso":   { brocoli: 2, cebolla: 2, mozzarella: 1 },
}

export const TANDAS_LB = {
  carne_molida: 80,
  cadera:       80,
  pechuga:      40,
  churrasco:    20,
  crab:          6,
  camaron:      20,
  pastrami:     20,
  philly:       20,
  bistec:       20,
}

export const PROTEINAS = Object.keys(TANDAS_LB)

export const ING_LABELS = {
  carne_molida:    "Carne molida",
  cadera:          "Cadera (pollo)",
  pechuga:         "Pechuga",
  churrasco:       "Churrasco",
  crab:            "Crab",
  camaron:         "Camarón",
  pastrami:        "Pastrami",
  philly:          "Philly (carne)",
  bistec:          "Bistec",
  bacon:           "Bacon",
  jamon:           "Jamón",
  chorizo:         "Chorizo",
  pavo:            "Pavo",
  carnita:         "Carnita",
  carne_ahumada:   "Carne ahumada",
  pulpo:           "Pulpo",
  mozzarella:      "Mozzarella",
  queso_americano: "Queso americano",
  queso_suizo:     "Queso suizo",
  queso_crema:     "Queso crema",
  queso_cheddar:   "Queso cheddar",
  cheddar_liquido: "Cheddar líquido",
  parmesano:       "Parmesano",
  huevo:           "Huevos",
  amarillo:        "Amarillos",
  brocoli:         "Brócoli",
  cebolla:         "Cebolla",
  pepinillo:       "Pepinillo",
  papitas:         "Papitas",
  salsa_pizza:     "Salsa pizza",
  salsa_ragu:      "Salsa ragú",
  salsa_alfredo:   "Salsa alfredo",
  salsa_bbq:       "Salsa BBQ",
  salsa_picante:   "Salsa picante",
  salsa_ranch:     "Salsa ranch",
  mostaza:         "Mostaza",
  mayonesa:        "Mayonesa",
  ketchup:         "Ketchup",
  pasta_lasagna:   "Pasta lasaña",
  pepperoni:       "Pepperoni",
}

export const GRUPO_A = [
  "Carbonara","Pollo","Carne con Queso Americano","Carne","Pizza Pepperoni",
  "Pastelón de Carne","Revoltillo","Cheeseburger","Pollo Bacon Ranch","Carne Ahumada",
  "Revoltillo Deluxe","Carne con Queso Mozzarella","Pollo con Queso Mozzarella",
  "Meat Lover","Lasaña","Pollo con Queso Americano","Philly Cheesesteak",
]
export const GRUPO_B = [
  "Cubano","Bistec","Pechuga Rellena","Pastrami","Pizza","Monte Cristo","Chicken Deluxe",
]

export const PASTELILLO_CATS = ["Gourmet", "Clasicos"]

export function getGrupo(name) {
  if (GRUPO_A.includes(name)) return 'A'
  if (GRUPO_B.includes(name)) return 'B'
  return 'C'
}

export const PRECIOS_REVENTA = {
  "Carne": 24, "Pollo": 24, "Pizza": 24, "Queso": 24,
  "Carne con Queso Americano": 28, "Carne con Queso Mozzarella": 28,
  "Pollo con Queso Americano": 28, "Pollo con Queso Mozzarella": 28,
  "Jamón Queso": 28, "Revoltillo": 28,
  "Pastelillo Guayaba Queso": 24, "Pastelillo Nutella": 24,
  "Pizza Pepperoni": 32, "Pizza Chorizo": 32, "Pollo Brócoli": 32,
  "Pollo Picante": 32, "Pastelón Pollo": 32, "Revoltillo Deluxe": 32,
  "Pastelón de Carne": 32, "Lasaña": 32,
  "Brócoli & Cebolla": 34, "Queso & Cebolla": 34,
  "Camarón": 42, "Carbonara Camarón": 42, "Camarón, Churrasco y Queso": 42,
  "Churrasco Queso": 42, "Churrasco, Amarillos y Queso": 42, "Pulpo": 42, "Spicy Crab": 42,
  "Bistec": 36, "Carbonara": 36, "Cheeseburger": 36, "Cubano": 36,
  "Monte Cristo": 36, "Meat Lover": 36, "Pastrami": 36, "Pechuga Rellena": 36,
  "Pollo Bacon Ranch": 36, "Tripleta": 36, "Carne Ahumada": 36,
  "Chicken Deluxe": 36, "BBQ Pork": 36, "Philly Cheesesteak": 36,
}

export const CALENDARIO_BASE = {
  Monday:    [
    { proteina: "carne_molida", lb: 80, tipo: "cocinar" },
    { proteina: "cadera",       lb: 80, tipo: "cocinar" },
  ],
  Tuesday:   [
    { proteina: "pastrami",  lb: 20, tipo: "cocinar" },
    { proteina: "philly",    lb: 20, tipo: "cocinar" },
    { proteina: "pechuga",   lb: 40, tipo: "cocinar" },
    { proteina: "camaron",   lb: 20, tipo: "preparar" },
    { proteina: "churrasco", lb: 20, tipo: "preparar" },
    { proteina: "bistec",    lb: 20, tipo: "preparar" },
  ],
  Wednesday: [
    { proteina: "churrasco", lb: 30, tipo: "cocinar" },
    { proteina: "bistec",    lb: 20, tipo: "cocinar" },
    { proteina: "camaron",   lb: 20, tipo: "preparar" },
    { proteina: "crab",      lb: 6,  tipo: "preparar" },
  ],
  Thursday:  [
    { proteina: "cadera",      lb: 120, tipo: "cocinar" },
    { proteina: "carne_molida",lb: 80,  tipo: "cocinar" },
  ],
  Friday:    [
    { proteina: "cualquier_faltante", lb: 0, tipo: "buffer" },
  ],
  Saturday:  [],
  Sunday:    [],
}

export const LIMITE_DIAS_FIFO = 2
export const MARGEN_ALERTA_DIAS = 2

export const DOW_ES = {
  Monday: "Lunes", Tuesday: "Martes", Wednesday: "Miércoles",
  Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado", Sunday: "Domingo",
}

export const DOW_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
