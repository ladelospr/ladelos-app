import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { RECETAS, PROTEINAS, PASTELILLO_CATS, GRUPO_A, GRUPO_B, TANDAS_LB, MARGEN_ALERTA_DIAS } from '../lib/constants'

export function useProduccion() {
  const [diasVentas, setDiasVentas] = useState([])
  const [tandasCocina, setTandasCocina] = useState([])
  const [conteoCarrito2, setConteoCarrito2] = useState({})
  const [ordenesMayoristas, setOrdenesMayoristas] = useState([])
  const [loading, setLoading] = useState(true)

  const DOW_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadDiasVentas(), loadTandas(), loadCarrito2(), loadOrdenes()])
    setLoading(false)
  }

  async function loadDiasVentas() {
    const { data } = await supabase
      .from('dias_ventas')
      .select('*')
      .order('fecha', { ascending: true })
    setDiasVentas(data || [])
  }

  async function loadTandas() {
    const { data } = await supabase
      .from('tandas_cocina')
      .select('*')
      .order('fecha', { ascending: false })
    setTandasCocina(data || [])
  }

  async function loadCarrito2() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('conteos_carrito2')
      .select('*')
      .eq('fecha', today)
      .single()
    setConteoCarrito2(data?.productos || {})
  }

  async function loadOrdenes() {
    const { data } = await supabase
      .from('ordenes_mayoristas')
      .select('*')
      .neq('estado', 'cancelada')
      .order('fecha_entrega', { ascending: true })
    setOrdenesMayoristas(data || [])
  }

  // Guardar día de ventas desde reporte CSV de Clover
  async function guardarDiaVentas(fechaKey, dow, totalSold, products) {
    const { error } = await supabase
      .from('dias_ventas')
      .upsert({
        fecha: fechaKey,
        dia_semana: dow,
        total_vendido: totalSold,
        productos: products,
      }, { onConflict: 'fecha' })
    if (!error) await loadDiasVentas()
    return { error }
  }

  // Registrar tanda de cocina
  async function agregarTanda(proteina, libras, tipo = 'cocinar', notas = '') {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('tandas_cocina')
      .insert({ fecha: today, proteina, libras, tipo, notas })
    if (!error) await loadTandas()
    return { error }
  }

  // Guardar conteo del Carrito 2
  async function guardarCarrito2(productos) {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('conteos_carrito2')
      .upsert({ fecha: today, productos }, { onConflict: 'fecha' })
    if (!error) {
      setConteoCarrito2(productos)
      await loadAll() // recalcular todo
    }
    return { error }
  }

  // Calcular inventario disponible de proteínas
  function calcInventario() {
    const inv = {}
    // Sumar todas las tandas
    for (const t of tandasCocina) {
      inv[t.proteina] = (inv[t.proteina] || 0) + (t.libras * 16)
    }
    // Descontar ventas registradas
    for (const dia of diasVentas) {
      for (const [prodKey, qty] of Object.entries(dia.productos || {})) {
        const [cat, ...rest] = prodKey.split('|')
        const name = rest.join('|')
        if (!PASTELILLO_CATS.includes(cat)) continue
        const rec = RECETAS[name]
        if (!rec) continue
        for (const [ing, ozPorUnit] of Object.entries(rec)) {
          if (PROTEINAS.includes(ing)) {
            inv[ing] = (inv[ing] || 0) - (ozPorUnit * qty)
          }
        }
      }
    }
    for (const k in inv) { if (inv[k] < 0) inv[k] = 0 }
    return inv
  }

  // Consumo promedio diario de proteínas (últimos 14 días)
  function calcConsumoDiario() {
    const ultimos14 = diasVentas.slice(-14)
    if (!ultimos14.length) return {}
    const consumo = {}
    for (const dia of ultimos14) {
      for (const [prodKey, qty] of Object.entries(dia.productos || {})) {
        const [cat, ...rest] = prodKey.split('|')
        const name = rest.join('|')
        if (!PASTELILLO_CATS.includes(cat)) continue
        const rec = RECETAS[name]
        if (!rec) continue
        for (const [ing, oz] of Object.entries(rec)) {
          if (PROTEINAS.includes(ing)) {
            consumo[ing] = (consumo[ing] || 0) + (oz * qty)
          }
        }
      }
    }
    const n = ultimos14.length
    const result = {}
    for (const k in consumo) result[k] = consumo[k] / n
    return result
  }

  // Promedio ponderado
  function weightedAvg(values) {
    if (!values.length) return 0
    if (values.length === 1) return values[0]
    if (values.length === 2) return values[0] * 0.35 + values[1] * 0.65
    const l = values.slice(-3)
    if (l.length === 3) return l[0] * 0.2 + l[1] * 0.3 + l[2] * 0.5
    return l[0] * 0.35 + l[1] * 0.65
  }

  // Demanda de mayoristas para un día de la semana
  function getMayoristaDemanda(dow) {
    const demand = {}
    for (const orden of ordenesMayoristas) {
      const fechaDt = new Date(orden.fecha_entrega + 'T12:00:00')
      const entregaDow = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][fechaDt.getDay()]
      if (entregaDow !== dow) continue
      for (const [sabor, docenas] of Object.entries(orden.items || {})) {
        demand[sabor] = (demand[sabor] || 0) + docenas * 12
      }
    }
    return demand
  }

  // Plan de producción para un día de la semana
  function calcPlanParaDow(dow) {
    const pd = {}
    for (const dia of diasVentas) {
      for (const [prodKey, qty] of Object.entries(dia.productos || {})) {
        const [cat, ...rest] = prodKey.split('|')
        const name = rest.join('|')
        if (!PASTELILLO_CATS.includes(cat)) continue
        if (!pd[name]) pd[name] = {}
        if (!pd[name][dia.dia_semana]) pd[name][dia.dia_semana] = []
        pd[name][dia.dia_semana].push({ fecha: dia.fecha, qty })
      }
    }

    const mayoristaDemanda = getMayoristaDemanda(dow)
    const allNames = new Set([...Object.keys(pd), ...Object.keys(mayoristaDemanda)])
    const items = []

    for (const name of allNames) {
      const entries = (pd[name]?.[dow] || []).sort((a, b) => a.fecha.localeCompare(b.fecha))
      const base = entries.length ? weightedAvg(entries.map(e => e.qty)) : 0
      const grupo = GRUPO_A.includes(name) ? 'A' : GRUPO_B.includes(name) ? 'B' : 'C'
      const colchon = grupo === 'A' ? 0.10 : grupo === 'B' ? 0.07 : 0
      const sugerido = Math.ceil(base * (1 + colchon))
      const mayorista = mayoristaDemanda[name] || 0
      const pendiente = conteoCarrito2[name] || 0
      const total = Math.max(0, sugerido + mayorista - pendiente)
      if (sugerido + mayorista === 0) continue
      items.push({ name, grupo, base: Math.round(base * 10) / 10, sugerido, mayorista, pendiente, total })
    }

    return items.sort((a, b) => b.total - a.total)
  }

  // Ingredientes necesarios para un día
  function calcIngredientesParaDow(dow) {
    const items = calcPlanParaDow(dow)
    const needed = {}
    for (const item of items) {
      const rec = RECETAS[item.name]
      if (!rec || !item.total) continue
      for (const [ing, oz] of Object.entries(rec)) {
        needed[ing] = (needed[ing] || 0) + oz * item.total
      }
    }
    return needed
  }

  // Alertas de inventario bajo
  function calcAlertas() {
    const inv = calcInventario()
    const consumo = calcConsumoDiario()
    const alertas = []
    for (const prot of PROTEINAS) {
      const disponible = inv[prot] || 0
      const diario = consumo[prot] || 0
      if (diario > 0) {
        const dias = disponible / diario
        if (dias <= MARGEN_ALERTA_DIAS && tandasCocina.find(t => t.proteina === prot)) {
          alertas.push({ proteina: prot, disponible, diasRestantes: dias })
        }
      }
    }
    return alertas
  }

  // Descartes del Carrito 2 (producto con 2+ días)
  async function calcDescartes() {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = yesterday.toISOString().split('T')[0]

    const { data: hoy } = await supabase
      .from('conteos_carrito2').select('productos').eq('fecha', today).single()
    const { data: ayer } = await supabase
      .from('conteos_carrito2').select('productos').eq('fecha', yesterdayKey).single()

    const descartes = new Set()
    const hoyProds = hoy?.productos || {}
    const ayerProds = ayer?.productos || {}
    for (const name in hoyProds) {
      if (hoyProds[name] > 0 && ayerProds[name] > 0) descartes.add(name)
    }
    return descartes
  }

  return {
    diasVentas, tandasCocina, conteoCarrito2, ordenesMayoristas,
    loading, loadAll,
    guardarDiaVentas, agregarTanda, guardarCarrito2, loadOrdenes,
    calcInventario, calcConsumoDiario, calcPlanParaDow,
    calcIngredientesParaDow, calcAlertas, calcDescartes,
  }
}
