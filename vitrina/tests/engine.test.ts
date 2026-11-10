import { describe, expect, it } from 'vitest';
import { dispatch, flavorStatus, flavorById, type Command } from '../src/domain/engine';
import { initialState } from '../src/domain/seed';
import { suggestions } from '../src/domain/recommend';
import type { State } from '../src/domain/types';
import { interpretOrder, originFromModifiers, parseWebhook, deletedOrderCommands, type CloverOrder } from '../src/integrations/clover';
import { replenishmentTicket } from '../src/integrations/freshkds';
import { prTime } from '../src/domain/time';

// Lunes 9 nov 2026 en Puerto Rico (UTC-4)
const at = (hhmm: string, date = '2026-11-09') => new Date(`${date}T${hhmm}:00-04:00`);

function d(s: State, cmd: Command, user: string, time: string, date?: string) {
  const r = dispatch(s, cmd, { now: at(time, date), userId: user });
  if (!r.result.ok) throw new Error(`${cmd.type}: ${r.result.error}`);
  return r.state;
}
function dTry(s: State, cmd: Command, user: string, time: string, date?: string) {
  return dispatch(s, cmd, { now: at(time, date), userId: user });
}
const inv = (s: State, id: string) => s.inventory[id];
const open = (s: State, id: string, status: string) => s.requests.filter((r) => r.flavorId === id && r.status === status);

/** Freidora produce y vitrina recibe todo. */
function stock(s: State, flavorId: string, qty: number, time = '06:00', date?: string) {
  s = d(s, { type: 'initialProduction', items: [{ flavorId, qty }] }, 'freidora', time, date);
  const r = s.requests.filter((x) => x.flavorId === flavorId && x.status === 'lista').at(-1)!;
  return d(s, { type: 'receive', requestId: r.id, qty, close: true }, 'vitrina', time, date);
}
let lineSeq = 0;
function sell(s: State, flavorId: string, qty: number, origin: 'VITRINA' | 'AL_MOMENTO', time: string) {
  for (let i = 0; i < qty; i++) {
    const id = `L${++lineSeq}`;
    s = d(s, { type: 'saleLine', eventId: `e-${id}`, lineId: id, orderId: `O${id}`, flavorId, qty: 1, origin, status: 'activa', source: 'simulador' }, 'sistema', time);
  }
  return s;
}

describe('Hora de Puerto Rico', () => {
  it('usa America/Puerto_Rico sin importar la zona del dispositivo', () => {
    const t = prTime(new Date('2026-11-09T17:00:00Z'));
    expect(t).toEqual({ date: '2026-11-09', weekday: 1, minutes: 13 * 60 });
  });
});

describe('Casos obligatorios del documento', () => {
  it('Caso 1: Carne 8, Clover vende 3 de vitrina → 5', () => {
    let s = stock(initialState(), 'carne', 8);
    const order: CloverOrder = {
      id: 'ORD1',
      lineItems: { elements: [1, 2, 3].map((i) => ({ id: `li${i}`, name: 'Carne', modifications: { elements: [{ name: 'VITRINA - NO HACER' }] } })) },
    };
    for (const c of interpretOrder(s, order, 'evt1').commands) s = d(s, c, 'sistema', '07:00');
    expect(inv(s, 'carne')).toBe(5);
  });

  it('Caso 2: 2 Carne al momento → vitrina sin cambios', () => {
    let s = stock(initialState(), 'carne', 8);
    s = sell(s, 'carne', 2, 'AL_MOMENTO', '07:00');
    expect(inv(s, 'carne')).toBe(8);
  });

  it('Caso 3: Pollo llega a 0, objetivo 8, sin producción → automática de 8', () => {
    let s = stock(initialState(), 'pollo', 8);
    s = sell(s, 'pollo', 8, 'VITRINA', '08:00');
    expect(inv(s, 'pollo')).toBe(0);
    const red = open(s, 'pollo', 'pendiente');
    expect(red).toHaveLength(1);
    expect(red[0].kind).toBe('roja');
    expect(red[0].qtyRequested).toBe(8);
    expect(open(s, 'pollo', 'propuesta')).toHaveLength(0); // la amarilla se convirtió
  });

  it('Caso 4: Pollo en 0 con 5 preparando → solo 3 adicionales', () => {
    let s = stock(initialState(), 'pollo', 8);
    s = sell(s, 'pollo', 4, 'VITRINA', '08:00'); // queda 4 → amarilla
    const prop = open(s, 'pollo', 'propuesta')[0];
    s = d(s, { type: 'approve', requestId: prop.id, qty: 5 }, 'vitrina', '08:01');
    s = d(s, { type: 'start', requestId: prop.id }, 'freidora', '08:02');
    s = sell(s, 'pollo', 4, 'VITRINA', '08:10');
    const red = s.requests.filter((r) => r.flavorId === 'pollo' && r.kind === 'roja');
    expect(red).toHaveLength(1);
    expect(red[0].qtyRequested).toBe(3);
  });

  it('Caso 5: Carne 3 con mínimo 4 → amarilla, sin producción automática', () => {
    const s = stock(initialState(), 'carne', 3);
    expect(flavorStatus(s, flavorById(s, 'carne')!, at('06:00')).light).toBe('amarillo');
    expect(open(s, 'carne', 'propuesta')).toHaveLength(1);
    expect(open(s, 'carne', 'pendiente')).toHaveLength(0);
  });

  it('Caso 6: Carne bloqueado llega a 0 → rojo visible, sin solicitud', () => {
    let s = stock(initialState(), 'carne', 8);
    s = d(s, { type: 'block', flavorId: 'carne', minutes: 30, reason: 'No hay masa' }, 'vitrina', '07:00');
    s = sell(s, 'carne', 8, 'VITRINA', '07:10');
    expect(flavorStatus(s, flavorById(s, 'carne')!, at('07:10')).light).toBe('rojo');
    expect(s.requests.filter((r) => r.flavorId === 'carne' && r.kind !== 'inicial')).toHaveLength(0);
  });

  it('Caso 7: Reactivar Carne sin producción → reevalúa y crea la solicitud', () => {
    let s = stock(initialState(), 'carne', 8);
    s = d(s, { type: 'block', flavorId: 'carne', minutes: 30, reason: 'x' }, 'vitrina', '07:00');
    s = sell(s, 'carne', 8, 'VITRINA', '07:10');
    const r = dispatch(s, { type: 'reactivate', flavorId: 'carne' }, { now: at('07:15'), userId: 'vitrina' });
    expect(r.result.ok && r.result.info).toMatch(/automática de 8/);
    expect(open(r.state, 'carne', 'pendiente')[0].qtyRequested).toBe(8);
  });

  it('Caso 8: Freidora produce 12, vitrina recibe 11 → +11 y diferencia registrada', () => {
    let s = d(initialState(), { type: 'initialProduction', items: [{ flavorId: 'carne', qty: 12 }] }, 'freidora', '05:30');
    const r = s.requests[0];
    expect(inv(s, 'carne')).toBe(0); // producir no aumenta inventario
    s = d(s, { type: 'receive', requestId: r.id, qty: 11, close: true }, 'vitrina', '05:45');
    expect(inv(s, 'carne')).toBe(11);
    const closed = s.requests.find((x) => x.id === r.id)!;
    expect(closed.difference).toBe(1);
    expect(closed.receptions[0]).toMatchObject({ qty: 11, by: 'vitrina' });
    expect(s.audit.some((a) => a.action === 'diferencia_recepcion')).toBe(true);
  });

  it('Caso 9: el mismo evento de Clover llega dos veces → se procesa una vez', () => {
    let s = stock(initialState(), 'carne', 8);
    const order: CloverOrder = { id: 'O9', lineItems: { elements: [{ id: 'x1', name: 'Carne', modifications: { elements: [{ name: 'VITRINA - NO HACER' }] } }] } };
    for (const c of interpretOrder(s, order, 'evt9').commands) s = d(s, c, 'sistema', '07:00');
    for (const c of interpretOrder(s, order, 'evt9').commands) s = d(s, c, 'sistema', '07:00');
    // Un UPDATE distinto con la misma línea tampoco descuenta de nuevo
    for (const c of interpretOrder(s, order, 'evt9b').commands) s = d(s, c, 'sistema', '07:01');
    expect(inv(s, 'carne')).toBe(7);
  });

  it('Caso 10: dos empleados aprueban la misma solicitud → una sola aprobación', () => {
    const s = stock(initialState(), 'carne', 3);
    const prop = open(s, 'carne', 'propuesta')[0];
    const first = dispatch(s, { type: 'approve', requestId: prop.id, expectedVersion: prop.version }, { now: at('06:05'), userId: 'vitrina' });
    expect(first.result.ok).toBe(true);
    const second = dispatch(first.state, { type: 'approve', requestId: prop.id, expectedVersion: prop.version }, { now: at('06:05'), userId: 'danny' });
    expect(second.result.ok).toBe(false);
    expect(!second.result.ok && second.result.code).toBe('conflict');
    expect(open(second.state, 'carne', 'pendiente')).toHaveLength(1);
  });

  it('Caso 11: Revoltillo después de las 10:00 → sin reposición automática', () => {
    let s = stock(initialState(), 'revoltillo', 6, '07:00');
    s = sell(s, 'revoltillo', 6, 'VITRINA', '10:15');
    expect(s.requests.filter((r) => r.flavorId === 'revoltillo' && r.kind === 'roja')).toHaveLength(0);
    expect(dTry(s, { type: 'approveSuggestion', flavorId: 'revoltillo', qty: 3 }, 'freidora', '10:20').result.ok).toBe(false);
    // antes de las 10:00 sí
    let s2 = stock(initialState(), 'revoltillo', 6, '07:00');
    s2 = sell(s2, 'revoltillo', 6, 'VITRINA', '09:30');
    expect(open(s2, 'revoltillo', 'pendiente')).toHaveLength(1);
  });

  it('Caso 12: lunes 1:00 p. m. → no hay reposición normal sin autorización', () => {
    let s = stock(initialState(), 'carne', 8);
    s = sell(s, 'carne', 8, 'VITRINA', '13:00');
    expect(s.requests.filter((r) => r.kind === 'roja')).toHaveLength(0);
    expect(dTry(s, { type: 'authorizeException', flavorId: 'carne', qty: 4, reason: 'x' }, 'vitrina', '13:01').result.ok).toBe(false);
    s = d(s, { type: 'authorizeException', flavorId: 'carne', qty: 4, reason: 'Pedido grande' }, 'danny', '13:01');
    expect(open(s, 'carne', 'pendiente')[0]).toMatchObject({ kind: 'excepcion', authorizedBy: 'danny' });
    // viernes 1:00 p. m. sí se permite (límite 1:30 p. m.)
    const fri = stock(initialState(), 'carne', 8, '06:00', '2026-11-13');
    const fri2 = d(fri, { type: 'adjust', flavorId: 'carne', qty: 0, reason: 'conteo' }, 'danny', '13:00', '2026-11-13');
    expect(fri2.requests.filter((r) => r.kind === 'roja')).toHaveLength(1);
    // viernes 1:40 p. m. ya no
    const fri3 = d(fri, { type: 'adjust', flavorId: 'carne', qty: 0, reason: 'conteo' }, 'danny', '13:40', '2026-11-13');
    expect(fri3.requests.filter((r) => r.kind === 'roja')).toHaveLength(0);
  });

  it('Caso 13 y 14: sugerencias solo con cero inventario y sin producción suficiente en camino', () => {
    let s = initialState();
    // Historial: Pizza se vende ~4 entre 9:00 y 9:45 los días anteriores
    for (const day of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']) {
      for (let i = 0; i < 4; i++) s.saleLog.push({ at: at(`09:${10 + i * 5}`, day).toISOString(), flavorId: 'pizza', qty: 1, origin: 'VITRINA', source: 'demo' });
    }
    s = d(s, { type: 'adjust', flavorId: 'pizza', qty: 2, reason: 'conteo' }, 'danny', '09:00');
    expect(suggestions(s, at('09:00')).find((x) => x.flavorId === 'pizza')).toBeUndefined(); // tiene 2
    s = d(s, { type: 'waste', flavorId: 'pizza', qty: 2, reason: 'quemado' }, 'vitrina', '09:00');
    // Al llegar a 0 la regla roja ya pide reposición (estaba en vitrina hoy) → no se sugiere más
    expect(open(s, 'pizza', 'pendiente')).toHaveLength(1);
    expect(suggestions(s, at('09:00')).find((x) => x.flavorId === 'pizza')).toBeUndefined();
    // Sin la solicitud automática, sí aparece
    const req = open(s, 'pizza', 'pendiente')[0];
    s = d(s, { type: 'cancelRequest', requestId: req.id, reason: 'prueba' }, 'danny', '09:00');
    s = d(s, { type: 'reactivate', flavorId: 'pizza' }, 'danny', '09:00');
    s.requests = s.requests.filter((r) => !(r.flavorId === 'pizza' && r.status === 'pendiente'));
    const sug = suggestions(s, at('09:00')).find((x) => x.flavorId === 'pizza');
    expect(sug).toBeDefined();
    expect(sug!.qty).toBeGreaterThan(0);
    expect(sug!.usesSimulatedData).toBe(true);
    // Caso 14: con 5 listas esperando recepción ya no se sugiere
    s = d(s, { type: 'initialProduction', items: [{ flavorId: 'pizza', qty: 5 }] }, 'freidora', '09:01');
    expect(suggestions(s, at('09:01')).find((x) => x.flavorId === 'pizza')).toBeUndefined();
  });

  it('Caso 15: sustituir Carne Queso por Pollo → solicitud de Pollo, Carne Queso intacto', () => {
    let s = stock(initialState(), 'carne-queso-americano', 2);
    expect(open(s, 'carne-queso-americano', 'propuesta')).toHaveLength(1);
    s = d(s, { type: 'substitute', fromFlavorId: 'carne-queso-americano', toFlavorId: 'pollo', qty: 4, reason: 'Se vende más Pollo', originalAction: 'bloquear', minutes: null }, 'vitrina', '07:00');
    expect(inv(s, 'carne-queso-americano')).toBe(2);
    expect(open(s, 'carne-queso-americano', 'propuesta')).toHaveLength(0);
    expect(open(s, 'pollo', 'pendiente')[0]).toMatchObject({ kind: 'sustitucion', qtyRequested: 4 });
    expect(s.substitutions).toHaveLength(1);
    // Una segunda sustitución hacia Pollo se suma, no duplica
    s = d(s, { type: 'reactivate', flavorId: 'carne-queso-americano' }, 'vitrina', '07:01');
    s = d(s, { type: 'substitute', fromFlavorId: 'carne-queso-americano', toFlavorId: 'pollo', qty: 2, reason: '', originalAction: 'posponer', minutes: 15 }, 'vitrina', '07:02');
    expect(open(s, 'pollo', 'pendiente')).toHaveLength(1);
    expect(open(s, 'pollo', 'pendiente')[0].qtyRequested).toBe(6);
  });

  it('Caso 16: venta y recepción al mismo tiempo → total correcto en cualquier orden', () => {
    let base = stock(initialState(), 'carne', 5);
    base = d(base, { type: 'initialProduction', items: [{ flavorId: 'carne', qty: 6 }] }, 'freidora', '07:00');
    const req = base.requests.filter((r) => r.status === 'lista').at(-1)!;
    const sale: Command = { type: 'saleLine', eventId: 'e16', lineId: 'l16', orderId: 'o16', flavorId: 'carne', qty: 1, origin: 'VITRINA', status: 'activa', source: 'clover' };
    const rec: Command = { type: 'receive', requestId: req.id, qty: 6, close: true };
    const a = d(d(base, sale, 'sistema', '07:05'), rec, 'vitrina', '07:05');
    const b = d(d(base, rec, 'vitrina', '07:05'), sale, 'sistema', '07:05');
    expect(inv(a, 'carne')).toBe(10);
    expect(inv(b, 'carne')).toBe(10);
  });
});

describe('Sugerencias por demanda no satisfecha', () => {
  it('un cliente que preguntó por un sabor agotado genera sugerencia del lote mínimo', () => {
    let s = initialState();
    expect(suggestions(s, at('07:00'))).toHaveLength(0);
    s = d(s, { type: 'unmet', flavorId: 'pollo-queso-americano' }, 'vitrina', '07:00');
    const sug = suggestions(s, at('07:01'));
    expect(sug[0]).toMatchObject({ flavorId: 'pollo-queso-americano', qty: 3, quality: 'sin historial' });
    // después de la hora límite no se sugiere
    expect(suggestions(s, at('12:45'))).toHaveLength(0);
  });
});

describe('Límites, negativos y errores', () => {
  it('no permite desperdicio mayor al inventario ni ajustes negativos o sin motivo', () => {
    const s = stock(initialState(), 'carne', 3);
    expect(dTry(s, { type: 'waste', flavorId: 'carne', qty: 4, reason: 'x' }, 'vitrina', '07:00').result.ok).toBe(false);
    expect(dTry(s, { type: 'waste', flavorId: 'carne', qty: 1, reason: ' ' }, 'vitrina', '07:00').result.ok).toBe(false);
    expect(dTry(s, { type: 'adjust', flavorId: 'carne', qty: -1, reason: 'x' }, 'danny', '07:00').result.ok).toBe(false);
    expect(dTry(s, { type: 'adjust', flavorId: 'carne', qty: 5, reason: '' }, 'danny', '07:00').result.ok).toBe(false);
    expect(dTry(s, { type: 'adjust', flavorId: 'carne', qty: 5, reason: 'conteo' }, 'vitrina', '07:00').result.ok).toBe(false); // permisos
  });

  it('no permite recibir más de lo producido; la recepción parcial deja el resto como "listo"', () => {
    let s = d(initialState(), { type: 'initialProduction', items: [{ flavorId: 'pollo', qty: 10 }] }, 'freidora', '05:30');
    const r = s.requests[0];
    expect(dTry(s, { type: 'receive', requestId: r.id, qty: 11, close: true }, 'vitrina', '05:40').result.ok).toBe(false);
    s = d(s, { type: 'receive', requestId: r.id, qty: 6, close: false }, 'vitrina', '05:40');
    expect(inv(s, 'pollo')).toBe(6);
    expect(flavorStatus(s, flavorById(s, 'pollo')!, at('05:40')).committed.ready).toBe(4);
    s = d(s, { type: 'receive', requestId: r.id, qty: 4, close: false }, 'vitrina', '05:50');
    expect(s.requests.find((x) => x.id === r.id)!).toMatchObject({ status: 'cerrada', difference: 0 });
  });

  it('venta de vitrina sin inventario no deja negativo y queda registrada para revisar', () => {
    let s = stock(initialState(), 'carne', 1);
    s = d(s, { type: 'saleLine', eventId: 'a', lineId: 'a', orderId: 'o', flavorId: 'carne', qty: 3, origin: 'VITRINA', status: 'activa', source: 'clover' }, 'sistema', '07:00');
    expect(inv(s, 'carne')).toBe(0);
    expect(s.audit.some((a) => a.action === 'venta_sin_inventario')).toBe(true);
  });

  it('línea eliminada devuelve a vitrina; reembolso no devuelve', () => {
    let s = stock(initialState(), 'carne', 8);
    const order: CloverOrder = {
      id: 'OX',
      lineItems: { elements: [
        { id: 'a', name: 'Carne', modifications: { elements: [{ name: 'VITRINA - NO HACER' }] } },
        { id: 'b', name: 'Carne', modifications: { elements: [{ name: 'VITRINA - NO HACER' }] } },
      ] },
    };
    for (const c of interpretOrder(s, order, 'e1').commands) s = d(s, c, 'sistema', '07:00');
    expect(inv(s, 'carne')).toBe(6);
    // la cajera borra la línea "b" antes de cobrar
    const edited: CloverOrder = { id: 'OX', lineItems: { elements: [order.lineItems!.elements![0]] } };
    for (const c of interpretOrder(s, edited, 'e2').commands) s = d(s, c, 'sistema', '07:01');
    expect(inv(s, 'carne')).toBe(7);
    // reembolso de "a": no regresa
    const refunded: CloverOrder = { id: 'OX', lineItems: { elements: [{ ...order.lineItems!.elements![0], refunded: true }] } };
    for (const c of interpretOrder(s, refunded, 'e3').commands) s = d(s, c, 'sistema', '07:30');
    expect(inv(s, 'carne')).toBe(7);
    // orden borrada completa
    for (const c of deletedOrderCommands(s, 'OX', 'e4')) s = d(s, c, 'sistema', '07:31');
    expect(inv(s, 'carne')).toBe(7);
  });

  it('venta sin origen (sin modificador) no descuenta y se registra', () => {
    let s = stock(initialState(), 'carne', 8);
    const order: CloverOrder = { id: 'O', lineItems: { elements: [{ id: 'z', name: 'Carne' }] } };
    for (const c of interpretOrder(s, order, 'e').commands) s = d(s, c, 'sistema', '07:00');
    expect(inv(s, 'carne')).toBe(8);
    expect(s.audit.some((a) => a.action === 'venta_sin_origen')).toBe(true);
  });

  it('cliente preguntó: evita duplicados accidentales y solo aplica a agotados', () => {
    let s = initialState();
    s = d(s, { type: 'unmet', flavorId: 'pizza' }, 'vitrina', '09:00');
    const dup = dTry(s, { type: 'unmet', flavorId: 'pizza' }, 'vitrina', '09:00');
    expect(!dup.result.ok && dup.result.code).toBe('duplicate');
    s = d(s, { type: 'unmet', flavorId: 'pizza', confirmDuplicate: true }, 'vitrina', '09:00');
    expect(s.unmet).toHaveLength(2);
    const st = stock(initialState(), 'carne', 8);
    expect(dTry(st, { type: 'unmet', flavorId: 'carne' }, 'vitrina', '07:00').result.ok).toBe(false);
    expect(dTry(st, { type: 'unmet', flavorId: 'queso' }, 'vitrina', '07:00').result.ok).toBe(false); // al momento
  });

  it('cancelar una automática bloquea 30 min para que no se vuelva a crear sola', () => {
    let s = stock(initialState(), 'carne', 8);
    s = sell(s, 'carne', 8, 'VITRINA', '08:00');
    const red = open(s, 'carne', 'pendiente')[0];
    s = d(s, { type: 'cancelRequest', requestId: red.id, reason: 'No hay masa' }, 'freidora', '08:01');
    expect(open(s, 'carne', 'pendiente')).toHaveLength(0);
    s = d(s, { type: 'tick' }, 'sistema', '08:20');
    expect(open(s, 'carne', 'pendiente')).toHaveLength(0);
    s = d(s, { type: 'tick' }, 'sistema', '08:32'); // expiró el bloqueo → se reevalúa
    expect(open(s, 'carne', 'pendiente')).toHaveLength(1);
    expect(s.audit.some((a) => a.action === 'bloqueo_expirado')).toBe(true);
  });

  it('permisos por rol', () => {
    const s = stock(initialState(), 'carne', 3);
    const prop = open(s, 'carne', 'propuesta')[0];
    expect(dTry(s, { type: 'approve', requestId: prop.id }, 'freidora', '06:05').result.ok).toBe(false);
    expect(dTry(s, { type: 'start', requestId: prop.id }, 'vitrina', '06:05').result.ok).toBe(false);
    expect(dTry(s, { type: 'closeDay', leftover: 'conservar' }, 'vitrina', '15:00').result.ok).toBe(false);
  });

  it('no crea solicitudes duplicadas al reevaluar muchas veces', () => {
    let s = stock(initialState(), 'pollo', 8);
    s = sell(s, 'pollo', 8, 'VITRINA', '08:00');
    for (let i = 1; i < 20; i++) s = d(s, { type: 'tick' }, 'sistema', `08:${String(i).padStart(2, '0')}`);
    expect(s.requests.filter((r) => r.kind === 'roja')).toHaveLength(1);
  });

  it('el objetivo puede cambiar según la hora', () => {
    let s = initialState();
    const carne = { ...flavorById(s, 'carne')!, targets: [{ from: '05:00', target: 10 }, { from: '12:00', target: 4 }] };
    s = d(s, { type: 'updateFlavor', flavor: carne }, 'danny', '05:00');
    s = stock(s, 'carne', 1, '06:00');
    s = sell(s, 'carne', 1, 'VITRINA', '08:00');
    expect(open(s, 'carne', 'pendiente')[0].qtyRequested).toBe(10);
    let n = stock(d(initialState(), { type: 'updateFlavor', flavor: carne }, 'danny', '05:00'), 'carne', 1, '06:00');
    n = sell(n, 'carne', 1, 'VITRINA', '12:05');
    expect(open(n, 'carne', 'pendiente')[0].qtyRequested).toBe(4);
  });

  it('la regla de "solo sabores puestos hoy" evita pedir los 40 sabores al abrir', () => {
    const s = d(initialState(), { type: 'tick' }, 'sistema', '06:00');
    expect(s.requests).toHaveLength(0);
    const off = initialState();
    off.settings.autoOnlyIfStockedToday = false;
    const s2 = d(off, { type: 'tick' }, 'sistema', '06:00');
    expect(s2.requests.filter((r) => r.kind === 'roja').length).toBeGreaterThan(30);
  });

  it('domingo cerrado y cambio de horario', () => {
    let s = initialState();
    s.settings.autoOnlyIfStockedToday = false;
    expect(d(s, { type: 'tick' }, 'sistema', '09:00', '2026-11-08').requests).toHaveLength(0);
    const sched = structuredClone(s.schedule);
    sched.days[1]!.replenishCutoff = '14:00';
    s = d(s, { type: 'updateSchedule', schedule: sched }, 'danny', '05:00');
    s = d(s, { type: 'tick' }, 'sistema', '13:00');
    expect(s.requests.filter((r) => r.kind === 'roja').length).toBeGreaterThan(0);
  });

  it('un error a mitad de un comando no cambia nada (atómico)', () => {
    const s = stock(initialState(), 'carne', 2);
    const r = dTry(s, { type: 'initialProduction', items: [{ flavorId: 'carne', qty: 3 }, { flavorId: 'queso', qty: 2 }] }, 'freidora', '07:00');
    expect(r.result.ok).toBe(false);
    expect(r.state).toBe(s);
  });
});

describe('Integraciones (preparación)', () => {
  it('reconoce los modificadores con guion o raya', () => {
    expect(originFromModifiers([{ name: 'VITRINA - NO HACER' }])).toBe('VITRINA');
    expect(originFromModifiers([{ name: 'VITRINA – NO HACER' }])).toBe('VITRINA');
    expect(originFromModifiers([{ name: 'AL MOMENTO – COCINA' }])).toBe('AL_MOMENTO');
    expect(originFromModifiers([])).toBe('DESCONOCIDO');
  });

  it('lee eventos de órdenes del webhook de Clover', () => {
    const ev = parseWebhook({ appId: 'A', merchants: { REKD5Z4C7KA71: [{ objectId: 'O:GHIVJT2ABCRSC', type: 'CREATE', ts: 1537970958000 }, { objectId: 'I:X', type: 'UPDATE', ts: 1 }] } });
    expect(ev).toEqual([{ merchantId: 'REKD5Z4C7KA71', orderId: 'GHIVJT2ABCRSC', type: 'CREATE', ts: 1537970958000, eventId: 'REKD5Z4C7KA71:GHIVJT2ABCRSC:CREATE:1537970958000' }]);
  });

  it('arma el ticket VITRINA — REPOSICIÓN para Fresh KDS', () => {
    let s = stock(initialState(), 'pollo', 8);
    s = sell(s, 'pollo', 8, 'VITRINA', '08:00');
    const t = replenishmentTicket(s, open(s, 'pollo', 'pendiente'), at('08:00'));
    expect(t.name).toBe('VITRINA — REPOSICIÓN');
    expect(t.items[0].name).toBe('Preparar 8 Pollo');
    expect(t.priority).toBe(true);
  });
});
