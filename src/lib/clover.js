import { supabase } from './supabase'

// La llamada a api.clover.com ya NO se hace desde aqui. Pasa por el Edge
// Function clover-sync, que guarda CLOVER_API_TOKEN como secreto del
// proyecto. Antes ese token viajaba en el bundle (VITE_CLOVER_API_TOKEN) y
// era visible para cualquiera que abriera la app; ademas api.clover.com no
// manda cabeceras CORS, asi que la llamada directa desde el navegador nunca
// pudo haber completado. Ver supabase/functions/clover-sync/index.ts.

export async function getVentasDelDia(fecha) {
  const { data, error } = await supabase.functions.invoke('clover-sync', {
    body: { fecha },
  })

  if (error) {
    let detalle = error.message
    try {
      const cuerpo = await error.context?.json()
      if (cuerpo?.error) detalle = cuerpo.error
    } catch { /* la respuesta no era JSON */ }
    throw new Error(detalle)
  }
  if (!data?.ok) throw new Error('El servidor no devolvió datos de Clover.')

  return data.items || []
}

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

export async function sincronizarVentasHoy() {
  const today = new Date().toISOString().split('T')[0]
  const lineItems = await getVentasDelDia(today)
  const { products, totalSold } = procesarVentasClover(lineItems)
  const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]
  return { fecha: today, dow, products, totalSold }
}
