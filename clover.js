const CLOVER_TOKEN = import.meta.env.VITE_CLOVER_API_TOKEN
const MERCHANT_ID = import.meta.env.VITE_CLOVER_MERCHANT_ID
const BASE_URL = `https://api.clover.com/v3/merchants/${MERCHANT_ID}`

const headers = {
  'Authorization': `Bearer ${CLOVER_TOKEN}`,
  'Content-Type': 'application/json',
}

// Obtener ventas de un día específico
export async function getVentasDelDia(fecha) {
  const startOfDay = new Date(fecha + 'T00:00:00')
  const endOfDay = new Date(fecha + 'T23:59:59')
  
  const startMs = startOfDay.getTime()
  const endMs = endOfDay.getTime()

  const response = await fetch(
    `${BASE_URL}/line_items?filter=createdTime>=${startMs}&filter=createdTime<=${endMs}&expand=item&limit=1000`,
    { headers }
  )
  
  if (!response.ok) throw new Error('Error conectando con Clover')
  
  const data = await response.json()
  return data.elements || []
}

// Procesar line items de Clover al formato que usa la app
export function procesarVentasClover(lineItems) {
  const products = {}
  let totalSold = 0

  for (const item of lineItems) {
    if (!item.item) continue
    const name = item.item.name
    const category = item.item.categories?.[0]?.category?.name || 'Sin categoría'
    const key = category + '|' + name
    products[key] = (products[key] || 0) + 1
    totalSold++
  }

  return { products, totalSold }
}

// Obtener ventas de hoy
export async function sincronizarVentasHoy() {
  const today = new Date().toISOString().split('T')[0]
  const lineItems = await getVentasDelDia(today)
  const { products, totalSold } = procesarVentasClover(lineItems)
  
  const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]
  
  return { fecha: today, dow, products, totalSold }
}
