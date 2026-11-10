// "¿Qué conviene freír ahora?" — heurística interpretable, NO es un modelo entrenado.
// Solo considera sabores con CERO unidades físicas en vitrina.
import { committed, activeBlock, replenishWindow, targetAt } from './engine';
import { hm, prTime } from './time';
import type { State } from './types';

export type DataQuality = 'sin historial' | 'baja' | 'media' | 'alta';

export interface Suggestion {
  flavorId: string;
  name: string;
  qty: number;
  expected: number;
  reasons: string[];
  quality: DataQuality;
  historyDays: number;
  usesSimulatedData: boolean;
}

export function suggestions(s: State, now: Date, limit = 6): Suggestion[] {
  const t = prTime(now);
  const day = s.schedule.days[t.weekday];
  if (!day) return [];
  const minsToClose = hm(day.close) - t.minutes;
  const W = Math.min(s.settings.demandWindowMin, minsToClose);
  if (W <= 0) return [];
  const sinceOpen = t.minutes - hm(day.open);

  // Pre-cálculo del historial de ventas por fecha
  const logs = s.saleLog.map((l) => ({ ...l, pt: prTime(new Date(l.at)) }));
  const histDates = new Set(logs.filter((l) => l.pt.date < t.date).map((l) => l.pt.date));
  const weekdayDates = new Set(logs.filter((l) => l.pt.date < t.date && l.pt.weekday === t.weekday).map((l) => l.pt.date));
  const histDays = histDates.size;
  const quality: DataQuality = histDays >= 21 ? 'alta' : histDays >= 7 ? 'media' : histDays > 0 ? 'baja' : 'sin historial';
  const w = s.settings.weights;
  const out: Suggestion[] = [];

  for (const f of s.flavors) {
    if (!f.active || !f.vitrinaEligible) continue;
    if ((s.inventory[f.id] ?? 0) !== 0) continue; // regla fundamental: solo agotados
    if (!replenishWindow(s, f, now).allowed) continue;
    if (activeBlock(s, f.id, now)) continue;

    const fl = logs.filter((l) => l.flavorId === f.id);
    const inSlot = (l: (typeof fl)[number]) => l.pt.minutes >= t.minutes && l.pt.minutes < t.minutes + W;
    const comps: { w: number; v: number }[] = [];
    const reasons: string[] = [];
    let simulated = false;

    if (histDays > 0) {
      const q = fl.filter((l) => l.pt.date < t.date && inSlot(l));
      const v = q.reduce((a, l) => a + l.qty, 0) / histDays;
      comps.push({ w: w.slot, v });
      if (v > 0) reasons.push(`~${v.toFixed(1)} vendidos en esta franja en días anteriores`);
      simulated ||= q.some((l) => l.source !== 'clover');
    }
    if (weekdayDates.size > 0) {
      const q = fl.filter((l) => weekdayDates.has(l.pt.date) && inSlot(l));
      const v = q.reduce((a, l) => a + l.qty, 0) / weekdayDates.size;
      comps.push({ w: w.weekday, v });
      if (v > 0) reasons.push(`~${v.toFixed(1)} el mismo día de la semana`);
      simulated ||= q.some((l) => l.source !== 'clover');
    }
    const todayQ = fl.filter((l) => l.pt.date === t.date);
    if (sinceOpen >= 30) {
      const sold = todayQ.reduce((a, l) => a + l.qty, 0);
      const v = (sold / sinceOpen) * W;
      comps.push({ w: w.today, v });
      if (sold > 0) reasons.push(`${sold} vendidos hoy`);
      simulated ||= todayQ.some((l) => l.source !== 'clover');
    }
    if (sinceOpen >= 60) {
      const recent = todayQ.filter((l) => l.pt.minutes >= t.minutes - 60).reduce((a, l) => a + l.qty, 0);
      comps.push({ w: w.trend, v: (recent / 60) * W });
      if (recent > 0) reasons.push(`${recent} en la última hora`);
    }
    const asked = s.unmet.filter((u) => {
      const p = prTime(new Date(u.at));
      return u.flavorId === f.id && p.date === t.date && p.minutes >= t.minutes - 120;
    }).length;
    comps.push({ w: w.unmet, v: asked });
    if (asked > 0) reasons.push(`${asked} cliente${asked > 1 ? 's' : ''} preguntaron y no había`);

    const wsum = comps.reduce((a, c) => a + c.w, 0);
    const weighted = wsum > 0 ? comps.reduce((a, c) => a + c.w * c.v, 0) / wsum : 0;
    // Un cliente que pidió y no había es demanda directa: nunca se estima por debajo de eso.
    const expected = Math.max(weighted, asked);
    if (expected < 0.5) continue;
    const already = committed(s, f.id).total;
    const cap = targetAt(f, t.minutes);
    // Lote mínimo = el mínimo de alerta del sabor, sin pasar del objetivo.
    const qty = Math.min(cap, Math.max(Math.ceil(expected), f.min)) - already;
    if (qty < 1) continue;
    if (already > 0) reasons.push(`ya hay ${already} en camino`);
    out.push({
      flavorId: f.id,
      name: f.name,
      qty,
      expected,
      reasons,
      quality,
      historyDays: histDays,
      usesSimulatedData: simulated,
    });
  }
  return out.sort((a, b) => b.expected - a.expected).slice(0, limit);
}
