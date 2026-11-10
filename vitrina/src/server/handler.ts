// Lógica del servidor (Fase 2). Corre en la Edge Function de Supabase.
// Cada acción: valida la sesión, valida el rol, aplica el comando con la hora del SERVIDOR
// y guarda con control de versión (si otro equipo guardó primero, se reintenta sobre lo nuevo).
import { dispatch, type Command, type Result } from '../domain/engine';
import { initialState } from '../domain/seed';
import type { AuditEntry, Movement, Role, State } from '../domain/types';

export type MemberRole = Exclude<Role, never>;
export interface Member {
  user_id: string;
  store_id: string;
  role: MemberRole;
  display_name: string;
}
export interface StoreRow {
  state: State;
  version: number;
  test_offset_ms: number;
}

export interface Db {
  getUser(authHeader: string | null): Promise<{ id: string; email?: string } | null>;
  getMember(storeId: string, userId: string): Promise<Member | null>;
  listMembers(storeId: string): Promise<Member[]>;
  upsertMember(m: Member): Promise<void>;
  deleteMember(storeId: string, userId: string): Promise<void>;
  listProfiles(): Promise<{ id: string; nombre: string | null; rol: string | null; email?: string }[]>;
  createAuthUser(email: string, password: string, name: string): Promise<{ id: string } | { error: string }>;
  loadStore(storeId: string): Promise<StoreRow | null>;
  insertStore(storeId: string, state: State): Promise<boolean>; // false si ya existía
  casStore(storeId: string, expectedVersion: number, state: State): Promise<boolean>; // false si la versión cambió
  setTestOffset(storeId: string, ms: number): Promise<void>;
  appendHistory(storeId: string, version: number, entry: {
    user_id: string;
    command: unknown;
    ok: boolean;
    result: unknown;
    movements: Movement[];
    audit: AuditEntry[];
  }): Promise<void>;
  ping(storeId: string, version: number): Promise<void>;
  now(): number;
}

export const STORES: Record<string, { name: string; test: boolean }> = {
  bayamon: { name: 'Bayamón', test: false },
  'bayamon-prueba': { name: 'Bayamón · PRUEBA', test: true },
};

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}
const reply = (status: number, body: Record<string, unknown>): Reply => ({ status, body });

const ROLES: MemberRole[] = ['vitrina', 'freidora', 'ambos', 'admin'];

function withMembers(s: State, members: Member[]): State {
  return {
    ...s,
    users: members.map((m) => ({ id: m.user_id, name: m.display_name, role: m.role, pin: '', active: true })),
  };
}

function freshStore(storeId: string): State {
  const s = initialState();
  s.storeId = storeId;
  s.storeName = STORES[storeId].name;
  return s;
}

/** Igualdad del documento sin contar la marca de la última evaluación. */
function sameState(a: State, b: State) {
  return JSON.stringify({ ...a, lastEvaluatedAt: 0 }) === JSON.stringify({ ...b, lastEvaluatedAt: 0 });
}

async function loadOrCreate(db: Db, storeId: string): Promise<StoreRow> {
  let row = await db.loadStore(storeId);
  if (!row) {
    await db.insertStore(storeId, freshStore(storeId));
    row = await db.loadStore(storeId);
  }
  return row!;
}

export async function handle(db: Db, authHeader: string | null, body: Record<string, unknown>): Promise<Reply> {
  const user = await db.getUser(authHeader);
  if (!user) return reply(401, { error: 'Tu sesión terminó. Entra de nuevo.' });
  const storeId = String(body.storeId ?? '');
  const store = STORES[storeId];
  if (!store) return reply(400, { error: 'Tienda no válida' });
  const me = await db.getMember(storeId, user.id);
  if (!me) return reply(403, { error: 'Tu cuenta no tiene acceso a Control de Vitrina en esta tienda. Pídele acceso a Danny o Soha.' });
  const isAdmin = me.role === 'admin';
  const action = String(body.action ?? '');

  switch (action) {
    case 'load': {
      const row = await loadOrCreate(db, storeId);
      const members = await db.listMembers(storeId);
      return reply(200, {
        state: withMembers(row.state, members),
        version: row.version,
        me,
        store: { id: storeId, ...store },
        stores: isAdmin ? Object.entries(STORES).map(([id, v]) => ({ id, ...v })) : [{ id: storeId, ...store }],
        serverNow: db.now(),
        testOffsetMs: store.test ? row.test_offset_ms : 0,
      });
    }

    case 'command': {
      const cmd = body.cmd as Command;
      if (!cmd || typeof cmd !== 'object' || typeof cmd.type !== 'string') return reply(400, { error: 'Comando inválido' });
      if (cmd.type === 'updateUser') return reply(400, { error: 'Los usuarios se manejan en Administración → Usuarios.' });
      if (cmd.type === 'saleLine' && (cmd.source !== 'simulador' || !store.test))
        return reply(403, { error: 'Las ventas simuladas solo se permiten en la tienda de prueba. Las reales llegarán de Clover.' });
      const members = await db.listMembers(storeId);
      for (let attempt = 0; attempt < 6; attempt++) {
        const row = await loadOrCreate(db, storeId);
        const now = new Date(db.now() + (store.test ? row.test_offset_ms : 0));
        const base = withMembers(row.state, members);
        const r = dispatch(base, cmd, { now, userId: cmd.type === 'saleLine' ? 'sistema' : user.id });
        if (!r.result.ok) {
          await db.appendHistory(storeId, row.version, { user_id: user.id, command: cmd, ok: false, result: r.result, movements: [], audit: [] });
          return reply(200, { result: r.result, state: base, version: row.version, serverNow: db.now() });
        }
        if (cmd.type === 'tick' && sameState(base, r.state)) return reply(200, { result: r.result, state: base, version: row.version, serverNow: db.now() });
        const ok = await db.casStore(storeId, row.version, r.state);
        if (!ok) continue; // otro equipo guardó primero: se reintenta sobre lo más reciente
        const v = row.version + 1;
        const oldM = new Set(base.movements.map((m) => m.id));
        const oldA = new Set(base.audit.map((a) => a.id));
        await db.appendHistory(storeId, v, {
          user_id: user.id,
          command: cmd,
          ok: true,
          result: r.result,
          movements: r.state.movements.filter((m) => !oldM.has(m.id)),
          audit: r.state.audit.filter((a) => !oldA.has(a.id)),
        });
        await db.ping(storeId, v);
        return reply(200, { result: r.result, state: r.state, version: v, serverNow: db.now() });
      }
      return reply(409, { error: 'Hay mucha actividad al mismo tiempo. Intenta otra vez.' });
    }

    case 'members': {
      if (!isAdmin) return reply(403, { error: 'Solo Administración' });
      const [members, profiles] = await Promise.all([db.listMembers(storeId), db.listProfiles()]);
      return reply(200, { members, profiles });
    }

    case 'setMember': {
      if (!isAdmin) return reply(403, { error: 'Solo Administración' });
      const userId = String(body.userId ?? '');
      const role = body.role as MemberRole | null;
      if (!userId) return reply(400, { error: 'Falta el usuario' });
      if (userId === user.id && role !== 'admin') return reply(400, { error: 'No puedes quitarte el acceso de Administración a ti mismo.' });
      if (role === null) await db.deleteMember(storeId, userId);
      else {
        if (!ROLES.includes(role)) return reply(400, { error: 'Rol inválido' });
        const name = String(body.name ?? '').trim() || 'Sin nombre';
        await db.upsertMember({ user_id: userId, store_id: storeId, role, display_name: name });
      }
      return reply(200, { ok: true });
    }

    case 'createUser': {
      if (!isAdmin) return reply(403, { error: 'Solo Administración' });
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const name = String(body.name ?? '').trim();
      const role = body.role as MemberRole;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply(400, { error: 'Correo inválido' });
      if (password.length < 8) return reply(400, { error: 'La contraseña necesita al menos 8 caracteres' });
      if (!name) return reply(400, { error: 'Falta el nombre' });
      if (!ROLES.includes(role)) return reply(400, { error: 'Rol inválido' });
      const created = await db.createAuthUser(email, password, name);
      if ('error' in created) return reply(400, { error: created.error });
      await db.upsertMember({ user_id: created.id, store_id: storeId, role, display_name: name });
      return reply(200, { ok: true, userId: created.id });
    }

    case 'replace': {
      if (!isAdmin) return reply(403, { error: 'Solo Administración' });
      if (!store.test && body.confirm !== 'REEMPLAZAR') return reply(400, { error: 'Para la tienda real escribe REEMPLAZAR para confirmar.' });
      const st = body.state as State;
      if (!st || st.schema !== 1 || !Array.isArray(st.flavors)) return reply(400, { error: 'Datos inválidos' });
      const row = await loadOrCreate(db, storeId);
      const next = { ...st, storeId, storeName: store.name };
      if (!(await db.casStore(storeId, row.version, next))) return reply(409, { error: 'Alguien cambió algo al mismo tiempo. Intenta otra vez.' });
      await db.appendHistory(storeId, row.version + 1, { user_id: user.id, command: { type: 'replace' }, ok: true, result: null, movements: [], audit: [] });
      await db.ping(storeId, row.version + 1);
      return reply(200, { ok: true, version: row.version + 1 });
    }

    case 'setTestTime': {
      if (!isAdmin) return reply(403, { error: 'Solo Administración' });
      if (!store.test) return reply(400, { error: 'La hora simulada solo existe en la tienda de prueba.' });
      const ms = Number(body.offsetMs ?? 0);
      if (!Number.isFinite(ms) || Math.abs(ms) > 8 * 86400000) return reply(400, { error: 'Hora inválida' });
      await db.setTestOffset(storeId, Math.round(ms));
      const row = await loadOrCreate(db, storeId);
      await db.ping(storeId, row.version);
      return reply(200, { ok: true });
    }
  }
  return reply(400, { error: 'Acción desconocida' });
}

export type { Result };
