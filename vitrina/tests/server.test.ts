import { describe, expect, it } from 'vitest';
import { handle, type Db, type Member, type StoreRow } from '../src/server/handler';
import type { State } from '../src/domain/types';

function fakeDb(start = new Date('2026-11-09T11:00:00Z')) {
  const users: Record<string, { id: string }> = { 'tok-danny': { id: 'U-danny' }, 'tok-vit': { id: 'U-vit' }, 'tok-fre': { id: 'U-fre' }, 'tok-x': { id: 'U-x' } };
  const members: Member[] = [
    { user_id: 'U-danny', store_id: 'bayamon', role: 'admin', display_name: 'Danny' },
    { user_id: 'U-danny', store_id: 'bayamon-prueba', role: 'admin', display_name: 'Danny' },
    { user_id: 'U-vit', store_id: 'bayamon', role: 'vitrina', display_name: 'Vitrina Bayamón' },
    { user_id: 'U-fre', store_id: 'bayamon', role: 'freidora', display_name: 'Freidora Bayamón' },
  ];
  const stores: Record<string, StoreRow> = {};
  const history: { storeId: string; version: number; ok: boolean; movements: number }[] = [];
  let clock = start.getTime();
  let interleave: (() => void) | null = null; // simula otro equipo guardando entre la lectura y la escritura
  const db: Db = {
    async getUser(h) { return h ? users[h.replace('Bearer ', '')] ?? null : null; },
    async getMember(s, u) { return members.find((m) => m.store_id === s && m.user_id === u) ?? null; },
    async listMembers(s) { return members.filter((m) => m.store_id === s); },
    async upsertMember(m) { const i = members.findIndex((x) => x.store_id === m.store_id && x.user_id === m.user_id); if (i >= 0) members[i] = m; else members.push(m); },
    async deleteMember(s, u) { const i = members.findIndex((x) => x.store_id === s && x.user_id === u); if (i >= 0) members.splice(i, 1); },
    async listProfiles() { return [{ id: 'U-danny', nombre: 'Danny', rol: 'admin' }]; },
    async createAuthUser(email) { const id = `U-${email}`; users[`tok-${email}`] = { id }; return { id }; },
    async loadStore(s) { const r = stores[s]; if (r && interleave) { const f = interleave; interleave = null; f(); } return r ? structuredClone(stores[s]) : null; },
    async insertStore(s, state) { if (stores[s]) return false; stores[s] = { state, version: 0, test_offset_ms: 0 }; return true; },
    async casStore(s, v, state) { if (stores[s].version !== v) return false; stores[s] = { ...stores[s], state, version: v + 1 }; return true; },
    async setTestOffset(s, ms) { stores[s].test_offset_ms = ms; },
    async appendHistory(storeId, version, e) { history.push({ storeId, version, ok: e.ok, movements: e.movements.length }); },
    async ping() {},
    now: () => clock,
  };
  return { db, stores, history, members, tick: (ms: number) => (clock += ms), setInterleave: (f: () => void) => (interleave = f) };
}

const cmd = (db: Db, tok: string, c: unknown, storeId = 'bayamon') => handle(db, `Bearer ${tok}`, { action: 'command', storeId, cmd: c });

describe('Servidor (Edge Function)', () => {
  it('sin sesión o sin acceso a la tienda se rechaza', async () => {
    const { db } = fakeDb();
    expect((await handle(db, null, { action: 'load', storeId: 'bayamon' })).status).toBe(401);
    expect((await handle(db, 'Bearer tok-x', { action: 'load', storeId: 'bayamon' })).status).toBe(403);
    expect((await handle(db, 'Bearer tok-vit', { action: 'load', storeId: 'bayamon-prueba' })).status).toBe(403);
  });

  it('crea la tienda al primer uso y devuelve los miembros como usuarios', async () => {
    const { db } = fakeDb();
    const r = await handle(db, 'Bearer tok-vit', { action: 'load', storeId: 'bayamon' });
    expect(r.status).toBe(200);
    const s = r.body.state as State;
    expect(s.users.map((u) => u.name)).toEqual(['Danny', 'Vitrina Bayamón', 'Freidora Bayamón']);
    expect(r.body.version).toBe(0);
  });

  it('aplica comandos con el rol de la cuenta y la hora del servidor', async () => {
    const { db, stores, history } = fakeDb(); // lunes 7:00 a. m. en PR
    await handle(db, 'Bearer tok-fre', { action: 'load', storeId: 'bayamon' });
    let r = await cmd(db, 'tok-fre', { type: 'initialProduction', items: [{ flavorId: 'carne', qty: 12 }] });
    expect((r.body.result as { ok: boolean }).ok).toBe(true);
    const reqId = stores.bayamon.state.requests[0].id;
    r = await cmd(db, 'tok-fre', { type: 'receive', requestId: reqId, qty: 12, close: true });
    expect((r.body.result as { ok: boolean; code?: string }).code).toBe('forbidden'); // freidora no recibe
    r = await cmd(db, 'tok-vit', { type: 'receive', requestId: reqId, qty: 11, close: true });
    expect(stores.bayamon.state.inventory.carne).toBe(11);
    expect(stores.bayamon.state.requests[0].createdAt).toBe('2026-11-09T11:00:00.000Z');
    expect(history.filter((h) => h.ok).map((h) => h.version)).toEqual([1, 2]);
    expect(history.at(-1)!.movements).toBe(1);
  });

  it('si otro equipo guarda al mismo tiempo, se reintenta y no se pierde nada', async () => {
    const f = fakeDb();
    await handle(f.db, 'Bearer tok-fre', { action: 'load', storeId: 'bayamon' });
    await cmd(f.db, 'tok-fre', { type: 'initialProduction', items: [{ flavorId: 'carne', qty: 12 }, { flavorId: 'pollo', qty: 8 }] });
    const [rc, rp] = f.stores.bayamon.state.requests.map((r) => r.id);
    // mientras vitrina recibe Carne, "otro equipo" recibe Pollo
    f.setInterleave(() => {
      void cmd(f.db, 'tok-vit', { type: 'receive', requestId: rp, qty: 8, close: true });
    });
    await cmd(f.db, 'tok-vit', { type: 'receive', requestId: rc, qty: 12, close: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(f.stores.bayamon.state.inventory.carne).toBe(12);
    expect(f.stores.bayamon.state.inventory.pollo).toBe(8);
  });

  it('dos aprobaciones de la misma solicitud: una sola efectiva', async () => {
    const f = fakeDb();
    await handle(f.db, 'Bearer tok-fre', { action: 'load', storeId: 'bayamon' });
    await cmd(f.db, 'tok-fre', { type: 'initialProduction', items: [{ flavorId: 'carne', qty: 3 }] });
    await cmd(f.db, 'tok-vit', { type: 'receive', requestId: f.stores.bayamon.state.requests[0].id, qty: 3, close: true });
    const prop = f.stores.bayamon.state.requests.find((r) => r.status === 'propuesta')!;
    const a = await cmd(f.db, 'tok-vit', { type: 'approve', requestId: prop.id, expectedVersion: prop.version });
    const b = await cmd(f.db, 'tok-danny', { type: 'approve', requestId: prop.id, expectedVersion: prop.version });
    expect((a.body.result as { ok: boolean }).ok).toBe(true);
    expect((b.body.result as { ok: boolean; code: string }).code).toBe('conflict');
    expect(f.stores.bayamon.state.requests.filter((r) => r.flavorId === 'carne' && r.status === 'pendiente')).toHaveLength(1);
  });

  it('ventas simuladas y hora simulada solo en la tienda de prueba', async () => {
    const f = fakeDb();
    const sale = { type: 'saleLine', eventId: 'e', lineId: 'l', orderId: 'o', flavorId: 'carne', qty: 1, origin: 'VITRINA', status: 'activa', source: 'simulador' };
    expect((await cmd(f.db, 'tok-danny', sale)).status).toBe(403);
    expect((await handle(f.db, 'Bearer tok-danny', { action: 'setTestTime', storeId: 'bayamon', offsetMs: 1000 })).status).toBe(400);
    await handle(f.db, 'Bearer tok-danny', { action: 'load', storeId: 'bayamon-prueba' });
    expect((await handle(f.db, 'Bearer tok-danny', { action: 'setTestTime', storeId: 'bayamon-prueba', offsetMs: -3600000 })).status).toBe(200);
    expect((await cmd(f.db, 'tok-danny', sale, 'bayamon-prueba')).status).toBe(200);
    await cmd(f.db, 'tok-danny', { type: 'initialProduction', items: [{ flavorId: 'pollo', qty: 2 }] }, 'bayamon-prueba');
    expect(f.stores['bayamon-prueba'].state.requests[0].createdAt).toBe('2026-11-09T10:00:00.000Z');
  });

  it('el tick sin cambios no reescribe la tienda', async () => {
    const f = fakeDb();
    await handle(f.db, 'Bearer tok-vit', { action: 'load', storeId: 'bayamon' });
    await cmd(f.db, 'tok-vit', { type: 'tick' });
    await cmd(f.db, 'tok-vit', { type: 'tick' });
    f.tick(60000);
    await cmd(f.db, 'tok-vit', { type: 'tick' });
    expect(f.stores.bayamon.version).toBe(0);
  });

  it('administración de miembros: solo admin, y no puede quitarse a sí mismo', async () => {
    const f = fakeDb();
    expect((await handle(f.db, 'Bearer tok-vit', { action: 'members', storeId: 'bayamon' })).status).toBe(403);
    expect((await handle(f.db, 'Bearer tok-danny', { action: 'setMember', storeId: 'bayamon', userId: 'U-danny', role: null })).status).toBe(400);
    const c = await handle(f.db, 'Bearer tok-danny', { action: 'createUser', storeId: 'bayamon', email: 'tablet@ladelos.com', password: 'corto', name: 'Tablet', role: 'ambos' });
    expect(c.status).toBe(400);
    const ok = await handle(f.db, 'Bearer tok-danny', { action: 'createUser', storeId: 'bayamon', email: 'tablet@ladelos.com', password: 'una-clave-larga', name: 'Tablet cocina', role: 'ambos' });
    expect(ok.status).toBe(200);
    expect(f.members.find((m) => m.display_name === 'Tablet cocina')?.role).toBe('ambos');
  });

  it('no se puede reemplazar la tienda real sin confirmar', async () => {
    const f = fakeDb();
    const load = await handle(f.db, 'Bearer tok-danny', { action: 'load', storeId: 'bayamon' });
    const st = load.body.state;
    expect((await handle(f.db, 'Bearer tok-danny', { action: 'replace', storeId: 'bayamon', state: st })).status).toBe(400);
    expect((await handle(f.db, 'Bearer tok-danny', { action: 'replace', storeId: 'bayamon', state: st, confirm: 'REEMPLAZAR' })).status).toBe(200);
  });
});
