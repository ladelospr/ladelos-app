// Motor de inventario y reposición de LADELOS Control de Vitrina.
// Toda la lógica de negocio vive aquí (sin React). Cada comando se aplica de forma atómica:
// se trabaja sobre una copia del estado y, si algo falla, el estado anterior queda intacto.
import { hm, instantAtPRMinutes, prTime } from './time';
import type {
  Block,
  Flavor,
  ReplenishRequest,
  RequestKind,
  Role,
  SaleLineStatus,
  SaleOrigin,
  Schedule,
  Settings,
  State,
  User,
} from './types';

export interface Ctx {
  now: Date;
  userId: string; // 'sistema' para eventos automáticos o integraciones
}

export type Result =
  | { ok: true; id?: string; info?: string }
  | { ok: false; error: string; code?: 'conflict' | 'duplicate' | 'forbidden' | 'invalid' | 'schedule' | 'blocked' };

export type Command =
  | { type: 'tick' }
  | { type: 'approve'; requestId: string; qty?: number; expectedVersion?: number }
  | { type: 'postpone'; flavorId: string; minutes: number }
  | { type: 'block'; flavorId: string; minutes: number | null; reason: string }
  | { type: 'reactivate'; flavorId: string }
  | {
      type: 'substitute';
      fromFlavorId: string;
      toFlavorId: string;
      qty: number;
      reason: string;
      originalAction: 'bloquear' | 'posponer';
      minutes?: number | null;
    }
  | { type: 'receive'; requestId: string; qty: number; close: boolean }
  | { type: 'waste'; flavorId: string; qty: number; reason: string }
  | { type: 'adjust'; flavorId: string; qty: number; reason: string }
  | { type: 'unmet'; flavorId: string; confirmDuplicate?: boolean }
  | { type: 'start'; requestId: string }
  | { type: 'ready'; requestId: string; qtyProduced: number }
  | { type: 'initialProduction'; items: { flavorId: string; qty: number }[] }
  | { type: 'approveSuggestion'; flavorId: string; qty: number }
  | { type: 'cancelRequest'; requestId: string; reason: string }
  | { type: 'authorizeException'; flavorId: string; qty: number; reason: string }
  | {
      type: 'saleLine';
      eventId?: string;
      lineId: string;
      orderId: string;
      flavorId: string;
      qty: number;
      origin: SaleOrigin;
      status: SaleLineStatus;
      source: 'clover' | 'simulador';
    }
  | { type: 'closeDay'; leftover: 'desperdicio' | 'conservar' }
  | { type: 'updateFlavor'; flavor: Flavor }
  | { type: 'updateSchedule'; schedule: Schedule }
  | { type: 'updateSettings'; settings: Settings }
  | { type: 'updateUser'; user: User };

type ActorRole = Role | 'system';

const PERMS: Record<Command['type'], ActorRole[]> = {
  tick: ['vitrina', 'freidora', 'admin', 'system'],
  approve: ['vitrina', 'ambos', 'admin'],
  postpone: ['vitrina', 'ambos', 'admin'],
  block: ['vitrina', 'ambos', 'admin'],
  reactivate: ['vitrina', 'ambos', 'admin'],
  substitute: ['vitrina', 'ambos', 'admin'],
  receive: ['vitrina', 'ambos', 'admin'],
  waste: ['vitrina', 'ambos', 'admin'],
  adjust: ['admin'],
  unmet: ['vitrina', 'ambos', 'admin'],
  start: ['freidora', 'ambos', 'admin'],
  ready: ['freidora', 'ambos', 'admin'],
  initialProduction: ['freidora', 'ambos', 'admin'],
  approveSuggestion: ['freidora', 'ambos', 'admin'],
  cancelRequest: ['vitrina', 'freidora', 'ambos', 'admin'],
  authorizeException: ['admin'],
  saleLine: ['system', 'admin'],
  closeDay: ['admin'],
  updateFlavor: ['admin'],
  updateSchedule: ['admin'],
  updateSettings: ['admin'],
  updateUser: ['admin'],
};

// ---------- Consultas (usadas también por la interfaz) ----------

export function roleOf(s: State, userId: string): ActorRole | null {
  if (userId === 'sistema') return 'system';
  const u = s.users.find((x) => x.id === userId && x.active);
  return u ? u.role : null;
}

export function nameOf(s: State, userId: string): string {
  if (userId === 'sistema') return 'Sistema';
  return s.users.find((x) => x.id === userId)?.name ?? userId;
}

export function flavorById(s: State, id: string): Flavor | undefined {
  return s.flavors.find((f) => f.id === id);
}

export function targetAt(f: Flavor, minutes: number): number {
  const slots = [...f.targets].sort((a, b) => hm(a.from) - hm(b.from));
  if (slots.length === 0) return 0;
  let t = slots[0].target;
  for (const sl of slots) if (hm(sl.from) <= minutes) t = sl.target;
  return t;
}

export function committed(s: State, flavorId: string) {
  let pending = 0;
  let preparing = 0;
  let ready = 0;
  for (const r of s.requests) {
    if (r.flavorId !== flavorId) continue;
    if (r.status === 'pendiente') pending += r.qtyRequested;
    else if (r.status === 'preparando') preparing += r.qtyRequested;
    else if (r.status === 'lista') ready += (r.qtyProduced ?? 0) - r.qtyReceived;
  }
  return { pending, preparing, ready, total: pending + preparing + ready };
}

export type Light = 'verde' | 'amarillo' | 'rojo';

export function lightOf(available: number, min: number): Light {
  if (available <= 0) return 'rojo';
  if (available <= min) return 'amarillo';
  return 'verde';
}

export function activeBlock(s: State, flavorId: string, now: Date): Block | undefined {
  const iso = now.toISOString();
  return s.blocks.find((b) => b.flavorId === flavorId && b.active && b.until > iso);
}

export function replenishWindow(s: State, f: Flavor, now: Date): { allowed: boolean; reason?: string } {
  if (!f.active) return { allowed: false, reason: 'Sabor desactivado' };
  if (!f.vitrinaEligible) return { allowed: false, reason: 'Se prepara solo al momento' };
  if (f.adminRestricted) return { allowed: false, reason: 'Restricción administrativa' };
  const t = prTime(now);
  const day = s.schedule.days[t.weekday];
  if (!day) return { allowed: false, reason: 'Hoy está cerrado' };
  if (t.minutes < hm(day.staffStart)) return { allowed: false, reason: 'Antes del horario del personal' };
  if (f.replenishUntil && t.minutes >= hm(f.replenishUntil))
    return { allowed: false, reason: `${f.name} no se repone después de las ${f.replenishUntil}` };
  if (t.minutes >= hm(day.replenishCutoff))
    return { allowed: false, reason: `Pasó la hora límite de reposición (${day.replenishCutoff})` };
  return { allowed: true };
}

export function needFor(s: State, f: Flavor, now: Date): number {
  const t = prTime(now);
  const avail = s.inventory[f.id] ?? 0;
  return Math.max(0, targetAt(f, t.minutes) - avail - committed(s, f.id).total);
}

export interface FlavorStatus {
  flavor: Flavor;
  available: number;
  light: Light;
  committed: ReturnType<typeof committed>;
  target: number;
  need: number;
  block?: Block;
  postponedUntil?: string;
  window: { allowed: boolean; reason?: string };
  stockedToday: boolean;
  proposal?: ReplenishRequest;
}

export function flavorStatus(s: State, f: Flavor, now: Date): FlavorStatus {
  const t = prTime(now);
  const available = s.inventory[f.id] ?? 0;
  const pu = s.postponedUntil[f.id];
  return {
    flavor: f,
    available,
    light: lightOf(available, f.min),
    committed: committed(s, f.id),
    target: targetAt(f, t.minutes),
    need: needFor(s, f, now),
    block: activeBlock(s, f.id, now),
    postponedUntil: pu && pu > now.toISOString() ? pu : undefined,
    window: replenishWindow(s, f, now),
    stockedToday: s.stockedToday[f.id] === t.date,
    proposal: s.requests.find((r) => r.flavorId === f.id && r.status === 'propuesta'),
  };
}

// ---------- Utilidades internas ----------

function nid(s: State, prefix: string) {
  return `${prefix}${s.seq++}`;
}

function audit(s: State, ctx: Ctx, action: string, detail: string, flavorId?: string) {
  s.audit.push({ id: nid(s, 'a'), at: ctx.now.toISOString(), by: ctx.userId, action, detail, flavorId });
}

function move(
  s: State,
  ctx: Ctx,
  flavorId: string,
  delta: number,
  type: State['movements'][number]['type'],
  source: string,
  reason?: string,
  ref?: string,
) {
  const before = s.inventory[flavorId] ?? 0;
  const after = before + delta;
  if (after < 0) throw new Error('El inventario no puede quedar negativo');
  s.inventory[flavorId] = after;
  s.movements.push({
    id: nid(s, 'm'),
    at: ctx.now.toISOString(),
    flavorId,
    type,
    delta,
    before,
    after,
    by: ctx.userId,
    reason,
    source,
    ref,
  });
}

function newRequest(
  s: State,
  ctx: Ctx,
  flavorId: string,
  kind: RequestKind,
  status: ReplenishRequest['status'],
  qty: number,
): ReplenishRequest {
  const iso = ctx.now.toISOString();
  const r: ReplenishRequest = {
    id: nid(s, 'r'),
    flavorId,
    kind,
    status,
    qtyRequested: qty,
    qtyProduced: null,
    qtyReceived: 0,
    receptions: [],
    difference: null,
    businessDate: prTime(ctx.now).date,
    createdAt: iso,
    createdBy: ctx.userId,
    version: 1,
  };
  s.requests.push(r);
  return r;
}

function cancel(s: State, ctx: Ctx, r: ReplenishRequest, reason: string) {
  r.status = 'cancelada';
  r.cancelReason = reason;
  r.closedAt = ctx.now.toISOString();
  r.closedBy = ctx.userId;
  r.version++;
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const err = (error: string, code?: Extract<Result, { ok: false }>['code']): Result => ({ ok: false, error, code });

function closeInstant(s: State, now: Date): Date {
  const t = prTime(now);
  const day = s.schedule.days[t.weekday];
  const closeMin = day ? hm(day.close) : 23 * 60 + 59;
  const end = closeMin > t.minutes ? closeMin : 23 * 60 + 59;
  return instantAtPRMinutes(now, end);
}

function addBlock(s: State, ctx: Ctx, flavorId: string, minutes: number | null, reason: string) {
  const iso = ctx.now.toISOString();
  for (const b of s.blocks)
    if (b.flavorId === flavorId && b.active) {
      b.active = false;
      b.endedAt = iso;
      b.endedBy = ctx.userId;
      b.endedHow = 'reactivado';
    }
  const until = minutes === null ? closeInstant(s, ctx.now) : new Date(ctx.now.getTime() + minutes * 60000);
  const b: Block = {
    id: nid(s, 'b'),
    flavorId,
    reason,
    by: ctx.userId,
    start: iso,
    until: until.toISOString(),
    untilClose: minutes === null,
    active: true,
  };
  s.blocks.push(b);
  for (const r of s.requests)
    if (r.flavorId === flavorId && r.status === 'propuesta') cancel(s, ctx, r, 'Sabor bloqueado (no reponer)');
  return b;
}

/** Historial de demanda agrupado en franjas de 15 min para que el documento no crezca sin control. */
function logDemand(s: State, now: Date, flavorId: string, qty: number, origin: SaleOrigin, source: 'clover' | 'simulador') {
  const slotStart = new Date(Math.floor(now.getTime() / 900000) * 900000).toISOString();
  let last: State['saleLog'][number] | undefined;
  for (let i = s.saleLog.length - 1; i >= 0 && !last; i--) {
    const x = s.saleLog[i];
    if (x.at < slotStart) break;
    if (x.flavorId === flavorId && x.origin === origin && x.source === source && x.at === slotStart) last = x;
  }
  if (last) last.qty += qty;
  else s.saleLog.push({ at: slotStart, flavorId, qty, origin, source });
}

// ---------- Comandos ----------

function run(s: State, cmd: Command, ctx: Ctx): Result {
  const role = roleOf(s, ctx.userId);
  if (!role) return err('Usuario no válido', 'forbidden');
  if (!PERMS[cmd.type].includes(role)) return err('No tienes permiso para esta acción', 'forbidden');
  const iso = ctx.now.toISOString();
  const today = prTime(ctx.now).date;

  const getFlavor = (id: string) => flavorById(s, id);
  const getReq = (id: string) => s.requests.find((r) => r.id === id);

  switch (cmd.type) {
    case 'tick':
      return { ok: true };

    case 'approve': {
      const r = getReq(cmd.requestId);
      if (!r) return err('Solicitud no encontrada', 'invalid');
      if (r.status !== 'propuesta') return err('Esta solicitud ya fue procesada por otra persona', 'conflict');
      if (cmd.expectedVersion !== undefined && r.version !== cmd.expectedVersion)
        return err('La solicitud cambió mientras la mirabas. Revísala de nuevo.', 'conflict');
      const f = getFlavor(r.flavorId)!;
      const win = replenishWindow(s, f, ctx.now);
      if (!win.allowed) return err(win.reason!, 'schedule');
      if (activeBlock(s, f.id, ctx.now)) return err(`${f.name} está bloqueado`, 'blocked');
      const qty = cmd.qty ?? r.qtyRequested;
      if (!isInt(qty) || qty <= 0) return err('La cantidad debe ser un número entero mayor que 0', 'invalid');
      r.status = 'pendiente';
      r.qtyRequested = qty;
      r.approvedBy = ctx.userId;
      r.approvedAt = iso;
      r.version++;
      audit(s, ctx, 'aprobar_reposicion', `Aprobó ${qty} ${f.name}`, f.id);
      return { ok: true, id: r.id };
    }

    case 'postpone': {
      const f = getFlavor(cmd.flavorId);
      if (!f) return err('Sabor no encontrado', 'invalid');
      if (!isInt(cmd.minutes) || cmd.minutes <= 0) return err('Minutos inválidos', 'invalid');
      s.postponedUntil[f.id] = new Date(ctx.now.getTime() + cmd.minutes * 60000).toISOString();
      for (const r of s.requests)
        if (r.flavorId === f.id && r.status === 'propuesta') cancel(s, ctx, r, `Pospuesta ${cmd.minutes} min`);
      audit(s, ctx, 'posponer', `Pospuso ${f.name} ${cmd.minutes} min`, f.id);
      return { ok: true };
    }

    case 'block': {
      const f = getFlavor(cmd.flavorId);
      if (!f) return err('Sabor no encontrado', 'invalid');
      if (cmd.minutes !== null && (!isInt(cmd.minutes) || cmd.minutes <= 0)) return err('Duración inválida', 'invalid');
      const reason = cmd.reason.trim() || 'Sin motivo';
      const b = addBlock(s, ctx, f.id, cmd.minutes, reason);
      audit(
        s,
        ctx,
        'bloquear',
        `NO REPONER ${f.name} ${cmd.minutes === null ? 'hasta el cierre' : `${cmd.minutes} min`} — ${reason}`,
        f.id,
      );
      return { ok: true, id: b.id };
    }

    case 'reactivate': {
      const f = getFlavor(cmd.flavorId);
      if (!f) return err('Sabor no encontrado', 'invalid');
      for (const b of s.blocks)
        if (b.flavorId === f.id && b.active) {
          b.active = false;
          b.endedAt = iso;
          b.endedBy = ctx.userId;
          b.endedHow = 'reactivado';
        }
      delete s.postponedUntil[f.id];
      audit(s, ctx, 'reactivar', `Reactivó reposición de ${f.name}`, f.id);
      return { ok: true };
    }

    case 'substitute': {
      const from = getFlavor(cmd.fromFlavorId);
      const to = getFlavor(cmd.toFlavorId);
      if (!from || !to) return err('Sabor no encontrado', 'invalid');
      if (from.id === to.id) return err('Escoge un sabor distinto', 'invalid');
      if (!isInt(cmd.qty) || cmd.qty <= 0) return err('La cantidad debe ser mayor que 0', 'invalid');
      const win = replenishWindow(s, to, ctx.now);
      if (!win.allowed) return err(`${to.name}: ${win.reason}`, 'schedule');
      if (activeBlock(s, to.id, ctx.now)) return err(`${to.name} está bloqueado`, 'blocked');
      const reason = cmd.reason.trim() || `Sustituido por ${to.name}`;
      if (cmd.originalAction === 'bloquear') {
        addBlock(s, ctx, from.id, cmd.minutes ?? null, `Sustituido por ${to.name}: ${reason}`);
      } else {
        const m = cmd.minutes ?? s.settings.postponeDefaultMin;
        s.postponedUntil[from.id] = new Date(ctx.now.getTime() + m * 60000).toISOString();
        for (const r of s.requests)
          if (r.flavorId === from.id && r.status === 'propuesta') cancel(s, ctx, r, `Sustituido por ${to.name}`);
      }
      // No duplicar producción del sustituto: si ya hay una solicitud sin empezar, se suma a esa.
      let req = s.requests.find((r) => r.flavorId === to.id && r.status === 'pendiente');
      if (req) {
        req.qtyRequested += cmd.qty;
        req.note = `${req.note ? req.note + ' · ' : ''}+${cmd.qty} por sustitución de ${from.name}`;
        req.version++;
      } else {
        req = newRequest(s, ctx, to.id, 'sustitucion', 'pendiente', cmd.qty);
        req.approvedBy = ctx.userId;
        req.approvedAt = iso;
        req.note = `En lugar de ${from.name}`;
      }
      for (const r of s.requests)
        if (r.flavorId === to.id && r.status === 'propuesta') cancel(s, ctx, r, 'Cubierta por sustitución');
      s.substitutions.push({
        id: nid(s, 's'),
        fromFlavorId: from.id,
        toFlavorId: to.id,
        qty: cmd.qty,
        reason,
        originalAction: cmd.originalAction,
        requestId: req.id,
        by: ctx.userId,
        at: iso,
      });
      audit(s, ctx, 'sustituir', `${from.name} → ${cmd.qty} ${to.name} (${reason})`, from.id);
      return { ok: true, id: req.id };
    }

    case 'receive': {
      const r = getReq(cmd.requestId);
      if (!r) return err('Solicitud no encontrada', 'invalid');
      if (r.status !== 'lista') return err('Esta producción no está esperando recepción', 'conflict');
      if (!isInt(cmd.qty) || cmd.qty < 0) return err('Cantidad inválida', 'invalid');
      const produced = r.qtyProduced ?? 0;
      const remaining = produced - r.qtyReceived;
      if (cmd.qty > remaining)
        return err(`No puedes recibir más de lo que falta por recibir (${remaining}). Si hay más, usa Ajustar.`, 'invalid');
      if (cmd.qty === 0 && !cmd.close) return err('Indica cuántas recibiste', 'invalid');
      const f = getFlavor(r.flavorId)!;
      if (cmd.qty > 0) {
        move(s, ctx, f.id, cmd.qty, 'recepcion', 'vitrina', undefined, r.id);
        s.stockedToday[f.id] = today;
      }
      r.receptions.push({ qty: cmd.qty, by: ctx.userId, at: iso });
      r.qtyReceived += cmd.qty;
      if (cmd.close || r.qtyReceived === produced) {
        r.status = 'cerrada';
        r.difference = produced - r.qtyReceived;
        r.closedAt = iso;
        r.closedBy = ctx.userId;
        if (r.difference !== 0)
          audit(s, ctx, 'diferencia_recepcion', `${f.name}: producidas ${produced}, recibidas ${r.qtyReceived}`, f.id);
      }
      r.version++;
      audit(s, ctx, 'recibir', `Recibió ${cmd.qty} ${f.name}`, f.id);
      return { ok: true, id: r.id };
    }

    case 'waste': {
      const f = getFlavor(cmd.flavorId);
      if (!f) return err('Sabor no encontrado', 'invalid');
      if (!isInt(cmd.qty) || cmd.qty <= 0) return err('La cantidad debe ser mayor que 0', 'invalid');
      const avail = s.inventory[f.id] ?? 0;
      if (cmd.qty > avail) return err(`Solo hay ${avail} ${f.name} en vitrina`, 'invalid');
      const reason = cmd.reason.trim();
      if (!reason) return err('Indica el motivo del desperdicio', 'invalid');
      move(s, ctx, f.id, -cmd.qty, 'desperdicio', 'vitrina', reason);
      s.waste.push({ id: nid(s, 'w'), flavorId: f.id, qty: cmd.qty, reason, by: ctx.userId, at: iso });
      audit(s, ctx, 'desperdicio', `${cmd.qty} ${f.name} — ${reason}`, f.id);
      return { ok: true };
    }

    case 'adjust': {
      const f = getFlavor(cmd.flavorId);
      if (!f) return err('Sabor no encontrado', 'invalid');
      if (!isInt(cmd.qty) || cmd.qty < 0) return err('La cantidad no puede ser negativa', 'invalid');
      const reason = cmd.reason.trim();
      if (!reason) return err('El ajuste requiere un motivo', 'invalid');
      const delta = cmd.qty - (s.inventory[f.id] ?? 0);
      if (delta === 0) return err('La cantidad es igual a la actual', 'invalid');
      move(s, ctx, f.id, delta, 'ajuste', 'admin', reason);
      if (cmd.qty > 0) s.stockedToday[f.id] = today;
      audit(s, ctx, 'ajuste', `${f.name}: ${cmd.qty - delta} → ${cmd.qty} (${reason})`, f.id);
      return { ok: true };
    }

    case 'unmet': {
      const f = getFlavor(cmd.flavorId);
      if (!f) return err('Sabor no encontrado', 'invalid');
      if (!f.vitrinaEligible) return err('Este sabor se prepara al momento', 'invalid');
      if ((s.inventory[f.id] ?? 0) > 0) return err(`Todavía hay ${f.name} en vitrina`, 'invalid');
      const last = [...s.unmet].reverse().find((u) => u.flavorId === f.id);
      if (last && !cmd.confirmDuplicate) {
        const secs = (ctx.now.getTime() - new Date(last.at).getTime()) / 1000;
        if (secs < s.settings.unmetDedupSeconds)
          return err(`Ya se registró hace ${Math.round(secs)} s. ¿Fue otro cliente?`, 'duplicate');
      }
      s.unmet.push({ id: nid(s, 'u'), flavorId: f.id, by: ctx.userId, at: iso });
      audit(s, ctx, 'cliente_pregunto', `Cliente preguntó por ${f.name}`, f.id);
      return { ok: true };
    }

    case 'start': {
      const r = getReq(cmd.requestId);
      if (!r) return err('Solicitud no encontrada', 'invalid');
      if (r.status !== 'pendiente') return err('Esta solicitud ya fue empezada o cerrada', 'conflict');
      r.status = 'preparando';
      r.startedBy = ctx.userId;
      r.startedAt = iso;
      r.version++;
      audit(s, ctx, 'empezar', `Empezó ${r.qtyRequested} ${getFlavor(r.flavorId)!.name}`, r.flavorId);
      return { ok: true, id: r.id };
    }

    case 'ready': {
      const r = getReq(cmd.requestId);
      if (!r) return err('Solicitud no encontrada', 'invalid');
      if (r.status !== 'preparando' && r.status !== 'pendiente')
        return err('Esta solicitud no está en preparación', 'conflict');
      if (!isInt(cmd.qtyProduced) || cmd.qtyProduced < 0) return err('Cantidad inválida', 'invalid');
      if (cmd.qtyProduced === 0) return err('Si no se produjo nada, cancela la solicitud', 'invalid');
      if (r.status === 'pendiente') {
        r.startedBy = ctx.userId;
        r.startedAt = iso;
      }
      r.status = 'lista';
      r.qtyProduced = cmd.qtyProduced;
      r.readyBy = ctx.userId;
      r.readyAt = iso;
      r.version++;
      audit(s, ctx, 'lista', `Lista: ${cmd.qtyProduced} ${getFlavor(r.flavorId)!.name}`, r.flavorId);
      return { ok: true, id: r.id };
    }

    case 'initialProduction': {
      const items = cmd.items.filter((i) => i.qty !== 0);
      if (items.length === 0) return err('Indica al menos un sabor', 'invalid');
      for (const it of items) {
        const f = getFlavor(it.flavorId);
        if (!f || !f.active || !f.vitrinaEligible) return err(`Sabor no válido para vitrina: ${it.flavorId}`, 'invalid');
        if (!isInt(it.qty) || it.qty < 0) return err(`Cantidad inválida para ${f.name}`, 'invalid');
      }
      for (const it of items) {
        const r = newRequest(s, ctx, it.flavorId, 'inicial', 'lista', it.qty);
        r.qtyProduced = it.qty;
        r.startedBy = r.readyBy = ctx.userId;
        r.startedAt = r.readyAt = iso;
      }
      audit(s, ctx, 'produccion_inicial', items.map((i) => `${i.qty} ${getFlavor(i.flavorId)!.name}`).join(', '));
      return { ok: true };
    }

    case 'approveSuggestion': {
      const f = getFlavor(cmd.flavorId);
      if (!f) return err('Sabor no encontrado', 'invalid');
      if (!isInt(cmd.qty) || cmd.qty <= 0) return err('La cantidad debe ser mayor que 0', 'invalid');
      const win = replenishWindow(s, f, ctx.now);
      if (!win.allowed) return err(win.reason!, 'schedule');
      if (activeBlock(s, f.id, ctx.now)) return err(`${f.name} está bloqueado`, 'blocked');
      if ((s.inventory[f.id] ?? 0) > 0) return err(`Ya hay ${f.name} en vitrina`, 'conflict');
      const c = committed(s, f.id).total;
      if (c >= cmd.qty) return err(`Ya hay ${c} ${f.name} en camino`, 'conflict');
      const r = newRequest(s, ctx, f.id, 'sugerencia', 'pendiente', cmd.qty);
      r.approvedBy = ctx.userId;
      r.approvedAt = iso;
      audit(s, ctx, 'aprobar_sugerencia', `Sugerencia aprobada: ${cmd.qty} ${f.name}`, f.id);
      return { ok: true, id: r.id };
    }

    case 'cancelRequest': {
      const r = getReq(cmd.requestId);
      if (!r) return err('Solicitud no encontrada', 'invalid');
      const reason = cmd.reason.trim() || 'Cancelada';
      if (r.status === 'cerrada' || r.status === 'cancelada') return err('Esta solicitud ya está cerrada', 'conflict');
      if ((r.status === 'preparando' || r.status === 'lista') && role !== 'admin')
        return err('Solo Administración puede cancelar producción empezada o lista', 'forbidden');
      cancel(s, ctx, r, reason);
      const f = getFlavor(r.flavorId)!;
      // Si se cancela una automática, se bloquea 30 min para que no se vuelva a crear sola.
      if (r.kind === 'roja') addBlock(s, ctx, f.id, 30, `Solicitud automática cancelada: ${reason}`);
      audit(s, ctx, 'cancelar_solicitud', `${f.name} (${r.qtyRequested}) — ${reason}`, f.id);
      return { ok: true };
    }

    case 'authorizeException': {
      const f = getFlavor(cmd.flavorId);
      if (!f || !f.active || !f.vitrinaEligible) return err('Sabor no válido para vitrina', 'invalid');
      if (!isInt(cmd.qty) || cmd.qty <= 0) return err('La cantidad debe ser mayor que 0', 'invalid');
      const reason = cmd.reason.trim();
      if (!reason) return err('Indica el motivo de la excepción', 'invalid');
      const r = newRequest(s, ctx, f.id, 'excepcion', 'pendiente', cmd.qty);
      r.authorizedBy = ctx.userId;
      r.approvedBy = ctx.userId;
      r.approvedAt = iso;
      r.note = reason;
      audit(s, ctx, 'excepcion', `Autorizó ${cmd.qty} ${f.name} fuera de regla — ${reason}`, f.id);
      return { ok: true, id: r.id };
    }

    case 'saleLine': {
      if (cmd.eventId && s.processedEvents[cmd.eventId]) return { ok: true, info: 'Evento ya procesado (duplicado ignorado)' };
      const f = getFlavor(cmd.flavorId);
      if (!f) return err('Sabor no reconocido', 'invalid');
      if (!isInt(cmd.qty) || cmd.qty < 0) return err('Cantidad inválida', 'invalid');
      const prev = s.saleLines[cmd.lineId];
      const prevApplied = prev?.appliedQty ?? 0;
      let effective = cmd.origin === 'VITRINA' && cmd.status === 'activa' ? cmd.qty : 0;
      // Un reembolso no devuelve el pastelillo a la vitrina (ya se entregó).
      if (cmd.status === 'reembolsada') effective = prevApplied;
      let decremented = prev?.decremented ?? 0;
      const delta = effective - prevApplied;
      if (f.vitrinaEligible && delta > 0) {
        const avail = s.inventory[f.id] ?? 0;
        const take = Math.min(delta, avail);
        if (take > 0) move(s, ctx, f.id, -take, 'venta', cmd.source, undefined, cmd.lineId);
        decremented += take;
        if (take < delta)
          audit(
            s,
            ctx,
            'venta_sin_inventario',
            `Venta de vitrina de ${delta} ${f.name} pero el sistema solo tenía ${avail}. Revisar conteo.`,
            f.id,
          );
      } else if (f.vitrinaEligible && delta < 0) {
        const back = Math.min(-delta, decremented);
        if (back > 0) move(s, ctx, f.id, back, 'reverso_venta', cmd.source, 'Línea eliminada', cmd.lineId);
        decremented -= back;
      }
      if (cmd.origin === 'DESCONOCIDO' && cmd.status === 'activa')
        audit(s, ctx, 'venta_sin_origen', `${f.name}: venta sin VITRINA ni AL MOMENTO. No se descontó.`, f.id);
      if (cmd.status === 'reembolsada') audit(s, ctx, 'reembolso', `${f.name}: reembolso (no regresa a vitrina)`, f.id);
      // Historial de demanda (todas las ventas, de vitrina o al momento)
      const prevDemand = prev && prev.status === 'activa' ? prev.qty : prev?.status === 'reembolsada' ? prev.qty : 0;
      const newDemand = cmd.status === 'eliminada' ? 0 : cmd.qty;
      if (newDemand !== prevDemand) logDemand(s, ctx.now, f.id, newDemand - prevDemand, cmd.origin, cmd.source);
      s.saleLines[cmd.lineId] = {
        lineId: cmd.lineId,
        orderId: cmd.orderId,
        flavorId: f.id,
        qty: cmd.qty,
        origin: cmd.origin,
        status: cmd.status,
        appliedQty: effective,
        decremented,
        at: prev?.at ?? iso,
        source: cmd.source,
      };
      if (cmd.eventId) s.processedEvents[cmd.eventId] = iso;
      return { ok: true };
    }

    case 'closeDay': {
      for (const f of s.flavors) {
        const q = s.inventory[f.id] ?? 0;
        if (q > 0 && cmd.leftover === 'desperdicio') {
          move(s, ctx, f.id, -q, 'cierre_dia', 'admin', 'Sobrante al cierre');
          s.waste.push({ id: nid(s, 'w'), flavorId: f.id, qty: q, reason: 'Sobrante al cierre', by: ctx.userId, at: iso });
        }
      }
      for (const r of s.requests)
        if (r.status === 'propuesta' || r.status === 'pendiente') cancel(s, ctx, r, 'Cierre del día');
      for (const b of s.blocks)
        if (b.active) {
          b.active = false;
          b.endedAt = iso;
          b.endedBy = ctx.userId;
          b.endedHow = 'expirado';
        }
      s.postponedUntil = {};
      s.stockedToday = {};
      audit(s, ctx, 'cierre_dia', cmd.leftover === 'desperdicio' ? 'Sobrantes registrados como desperdicio' : 'Sobrantes conservados');
      return { ok: true };
    }

    case 'updateFlavor': {
      const f = cmd.flavor;
      if (!f.name.trim()) return err('El sabor necesita un nombre', 'invalid');
      if (!isInt(f.min) || f.min < 0) return err('Mínimo inválido', 'invalid');
      if (f.targets.length === 0 || f.targets.some((t) => !isInt(t.target) || t.target < 0 || !/^\d{2}:\d{2}$/.test(t.from)))
        return err('Objetivos inválidos (usa HH:MM=cantidad)', 'invalid');
      if (f.replenishUntil && !/^\d{2}:\d{2}$/.test(f.replenishUntil)) return err('Hora límite inválida', 'invalid');
      const i = s.flavors.findIndex((x) => x.id === f.id);
      if (i >= 0) s.flavors[i] = { ...f, provisional: false };
      else {
        s.flavors.push({ ...f, provisional: false });
        s.inventory[f.id] = 0;
      }
      audit(s, ctx, 'configurar_sabor', `${f.name}: mínimo ${f.min}, objetivos ${f.targets.map((t) => `${t.from}=${t.target}`).join(' ')}`, f.id);
      return { ok: true };
    }

    case 'updateSchedule': {
      for (const d of cmd.schedule.days) {
        if (!d) continue;
        for (const k of ['open', 'close', 'staffStart', 'replenishCutoff'] as const)
          if (!/^\d{2}:\d{2}$/.test(d[k])) return err('Hora inválida en el horario', 'invalid');
      }
      s.schedule = cmd.schedule;
      audit(s, ctx, 'configurar_horario', 'Horario actualizado');
      return { ok: true };
    }

    case 'updateSettings': {
      s.settings = cmd.settings;
      audit(s, ctx, 'configurar_reglas', 'Reglas actualizadas');
      return { ok: true };
    }

    case 'updateUser': {
      const u = cmd.user;
      if (!u.name.trim()) return err('Nombre requerido', 'invalid');
      if (u.role === 'admin' && !/^\d{4,6}$/.test(u.pin)) return err('Los administradores necesitan un PIN de 4 a 6 dígitos', 'invalid');
      const i = s.users.findIndex((x) => x.id === u.id);
      if (i >= 0) s.users[i] = u;
      else s.users.push(u);
      audit(s, ctx, 'configurar_usuario', `${u.name} (${u.role})`);
      return { ok: true };
    }
  }
}

// ---------- Evaluación automática (semáforo + reposición) ----------

export function evaluate(s: State, now: Date) {
  const ctx: Ctx = { now, userId: 'sistema' };
  const iso = now.toISOString();
  const t = prTime(now);

  for (const b of s.blocks)
    if (b.active && b.until <= iso) {
      b.active = false;
      b.endedAt = iso;
      b.endedBy = 'sistema';
      b.endedHow = 'expirado';
      audit(s, ctx, 'bloqueo_expirado', `Terminó el bloqueo de ${flavorById(s, b.flavorId)?.name}`, b.flavorId);
    }
  for (const k of Object.keys(s.postponedUntil)) if (s.postponedUntil[k] <= iso) delete s.postponedUntil[k];

  for (const f of s.flavors) {
    if (!f.active || !f.vitrinaEligible) continue;
    const avail = s.inventory[f.id] ?? 0;
    const win = replenishWindow(s, f, now);
    const blocked = !!activeBlock(s, f.id, now);
    const proposal = s.requests.find((r) => r.flavorId === f.id && r.status === 'propuesta');
    const need = needFor(s, f, now);

    if (avail === 0) {
      const auto =
        win.allowed && !blocked && (!s.settings.autoOnlyIfStockedToday || s.stockedToday[f.id] === t.date);
      if (proposal) cancel(s, ctx, proposal, auto ? 'Se agotó: pasó a reposición automática' : 'Se agotó');
      if (auto && need > 0) {
        const r = newRequest(s, ctx, f.id, 'roja', 'pendiente', need);
        r.approvedBy = 'sistema';
        r.approvedAt = iso;
        audit(s, ctx, 'reposicion_automatica', `${f.name} agotado: se pidieron ${need}`, f.id);
      }
    } else if (avail <= f.min) {
      const postponed = (s.postponedUntil[f.id] ?? '') > iso;
      if (proposal) {
        if (need <= 0 || blocked || !win.allowed)
          cancel(s, ctx, proposal, need <= 0 ? 'Ya hay suficiente en camino' : blocked ? 'Sabor bloqueado' : win.reason!);
        else if (proposal.qtyRequested !== need) {
          proposal.qtyRequested = need;
          proposal.version++;
        }
      } else if (!blocked && !postponed && win.allowed && need > 0) {
        newRequest(s, ctx, f.id, 'amarilla', 'propuesta', need);
        audit(s, ctx, 'alerta_amarilla', `${f.name} bajo (${avail}): se proponen ${need}`, f.id);
      }
    } else if (proposal) {
      cancel(s, ctx, proposal, 'El inventario subió por encima del mínimo');
    }
  }
  s.lastEvaluatedAt = iso;
}

function prune(s: State, now: Date) {
  const ago = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
  // El documento guarda solo lo reciente; el historial completo queda en la base de datos (Fase 2).
  const d14 = ago(14);
  s.movements = s.movements.filter((m) => m.at >= ago(4));
  s.audit = s.audit.filter((a) => a.at >= ago(7));
  s.saleLog = s.saleLog.filter((x) => x.at >= ago(56));
  s.requests = s.requests.filter((r) => !(r.status === 'cerrada' || r.status === 'cancelada') || (r.closedAt ?? r.createdAt) >= d14);
  for (const [k, v] of Object.entries(s.saleLines)) if (v.at < ago(3)) delete s.saleLines[k];
  for (const [k, v] of Object.entries(s.processedEvents)) if (v < ago(7)) delete s.processedEvents[k];
  s.waste = s.waste.filter((w) => w.at >= ago(90));
  s.unmet = s.unmet.filter((u) => u.at >= ago(90));
  s.substitutions = s.substitutions.filter((x) => x.at >= ago(90));
  s.blocks = s.blocks.filter((b) => b.active || (b.endedAt ?? b.start) >= ago(30));
}

/** Aplica un comando de forma atómica y reevalúa las reglas. Nunca muta `prev`. */
export function dispatch(prev: State, cmd: Command, ctx: Ctx): { state: State; result: Result } {
  const s: State = structuredClone(prev);
  let result: Result;
  try {
    result = run(s, cmd, ctx);
  } catch (e) {
    return { state: prev, result: err((e as Error).message, 'invalid') };
  }
  if (!result.ok) return { state: prev, result };
  const before = s.requests.length;
  evaluate(s, ctx.now);
  if (cmd.type === 'reactivate' && result.ok) {
    const f = flavorById(s, cmd.flavorId)!;
    const created = s.requests.slice(before).filter((r) => r.flavorId === f.id);
    const st = flavorStatus(s, f, ctx.now);
    if (created.some((r) => r.kind === 'roja'))
      result = { ok: true, info: `Rojo: se pidió reposición automática de ${created.find((r) => r.kind === 'roja')!.qtyRequested}` };
    else if (st.proposal) result = { ok: true, info: `Amarillo: aprueba la reposición de ${st.proposal.qtyRequested}` };
    else if (!st.window.allowed) result = { ok: true, info: `No se repone ahora: ${st.window.reason}` };
    else if (st.light === 'verde') result = { ok: true, info: 'Verde: no necesita reposición' };
    else if (st.light === 'rojo' && !st.stockedToday && s.settings.autoOnlyIfStockedToday)
      result = { ok: true, info: 'Este sabor no se ha puesto en vitrina hoy; no se repone automático' };
    else result = { ok: true, info: 'Ya hay suficiente producción en camino' };
  }
  prune(s, ctx.now);
  return { state: s, result };
}
