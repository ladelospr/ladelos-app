// Fase 2: la app conectada a Supabase. El servidor (Edge Function "vitrina") es la única fuente de verdad:
// cada acción se envía, el servidor la valida y la guarda, y todos los equipos reciben el cambio en vivo.
// No hay cola sin conexión: si no hay internet, la acción NO se guarda y la pantalla lo dice.
import type { Command, Result } from '../domain/engine';
import { initialState } from '../domain/seed';
import type { State } from '../domain/types';
import type { Me, MemberRow, ProfileRow, Snapshot, StoreInfo, SyncInfo } from './backend';

declare const __SB_URL__: string;
declare const __SB_ANON__: string;
declare const supabase: { createClient: (url: string, key: string, opts?: unknown) => any };

export const mode: 'local' | 'remote' = 'remote';
const STORE_KEY = 'ladelos-vitrina:v2:store';
const FN = `${__SB_URL__}/functions/v1/vitrina`;
const sb = supabase.createClient(__SB_URL__, __SB_ANON__);

let state: State = initialState();
let version = -1;
let skew = 0;
let testOffset = 0;
let me: Me | null = null;
let store: StoreInfo | null = null;
let stores: StoreInfo[] = [];
let phase: Snapshot['phase'] = 'loading';
let error: string | undefined;
let storeId = readStore();
let channel: any = null;
let live = false;
const sync: SyncInfo = { status: 'ok', message: 'Conectando…', lastSaved: null };

function readStore() {
  try {
    return localStorage.getItem(STORE_KEY) || 'bayamon';
  } catch {
    return 'bayamon';
  }
}

const listeners = new Set<() => void>();
let snapshot: Snapshot = build();
function build(): Snapshot {
  return { phase, error, state, offsetMs: testOffset, sync: { ...sync }, me, store, stores };
}
function emit() {
  snapshot = build();
  listeners.forEach((l) => l());
}

async function token(): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

async function call(action: string, extra: Record<string, unknown> = {}): Promise<{ status: number; body: any }> {
  const t = await token();
  if (!t) return { status: 401, body: { error: 'Tu sesión terminó. Entra de nuevo.' } };
  let res: Response;
  try {
    res = await fetch(FN, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, apikey: __SB_ANON__, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, storeId, ...extra }),
    });
  } catch {
    return { status: 0, body: { error: 'Sin conexión: no se guardó. Revisa el internet e intenta otra vez.' } };
  }
  let body: any = {};
  try {
    body = await res.json();
  } catch {
    /* respuesta vacía */
  }
  return { status: res.status, body };
}

function setSync(status: SyncInfo['status'], message: string) {
  sync.status = status;
  sync.message = message;
  if (status === 'ok') sync.lastSaved = new Date();
}

function accept(body: any) {
  if (body.state) state = body.state;
  if (typeof body.version === 'number') version = body.version;
  if (typeof body.serverNow === 'number') skew = body.serverNow - Date.now();
}

export async function load() {
  const r = await call('load');
  if (r.status === 401) {
    phase = 'login';
    return emit();
  }
  if (r.status === 403) {
    phase = 'noaccess';
    error = r.body.error;
    return emit();
  }
  if (r.status !== 200) {
    if (phase === 'ready') {
      setSync('offline', r.body.error ?? 'No se pudo actualizar');
      return emit();
    }
    phase = 'error';
    error = r.body.error ?? 'No se pudo conectar con el servidor';
    return emit();
  }
  accept(r.body);
  me = r.body.me;
  store = r.body.store;
  stores = r.body.stores;
  testOffset = r.body.testOffsetMs ?? 0;
  phase = 'ready';
  error = undefined;
  setSync(live ? 'ok' : sync.status === 'offline' ? 'offline' : 'ok', live ? 'En vivo' : 'Conectado');
  subscribe();
  emit();
}

let reloadTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleReload() {
  if (reloadTimer) return;
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    void load();
  }, 250);
}

function subscribe() {
  if (channel?.topic === `realtime:vitrina-${storeId}`) return;
  if (channel) void sb.removeChannel(channel);
  channel = sb
    .channel(`vitrina-${storeId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vitrina_ping', filter: `store_id=eq.${storeId}` }, () => scheduleReload())
    .subscribe((status: string) => {
      live = status === 'SUBSCRIBED';
      if (phase === 'ready' && sync.status !== 'saving') {
        if (live) setSync('ok', 'En vivo');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSync('offline', 'Sin conexión en vivo; se actualiza cada minuto');
        emit();
      }
    });
}

export async function run(cmd: Command, _userId: string): Promise<Result> {
  const quiet = cmd.type === 'tick';
  if (!quiet) {
    setSync('saving', 'Guardando…');
    emit();
  }
  const r = await call('command', { cmd });
  if (r.status === 401) {
    phase = 'login';
    emit();
    return { ok: false, error: r.body.error };
  }
  if (r.status !== 200) {
    setSync(r.status === 0 ? 'offline' : 'error', r.body.error ?? 'No se guardó');
    emit();
    return { ok: false, error: r.body.error ?? 'No se guardó' };
  }
  accept(r.body);
  setSync('ok', live ? 'En vivo' : 'Conectado');
  emit();
  return r.body.result as Result;
}

export function now(): Date {
  return new Date(Date.now() + skew + testOffset);
}

export function getState() {
  return state;
}

export async function replaceState(s: State, confirm?: string): Promise<Result> {
  const r = await call('replace', { state: s, confirm });
  if (r.status !== 200) return { ok: false, error: r.body.error ?? 'No se pudo' };
  await load();
  return { ok: true };
}

export async function setSimulatedTime(target: Date | null): Promise<Result> {
  const offsetMs = target ? target.getTime() - (Date.now() + skew) : 0;
  const r = await call('setTestTime', { offsetMs });
  if (r.status !== 200) return { ok: false, error: r.body.error ?? 'No se pudo' };
  await load();
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error: e } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (e) return e.message?.includes('Invalid') ? 'Correo o contraseña incorrectos' : e.message;
  phase = 'loading';
  emit();
  await load();
  return null;
}

export async function signOut() {
  await sb.auth.signOut();
  if (channel) void sb.removeChannel(channel);
  channel = null;
  phase = 'login';
  me = null;
  emit();
}

export async function switchStore(id: string) {
  storeId = id;
  try {
    localStorage.setItem(STORE_KEY, id);
  } catch {
    /* sin almacenamiento */
  }
  phase = 'loading';
  emit();
  await load();
}

export async function listMembers(): Promise<{ members: MemberRow[]; profiles: ProfileRow[] } | { error: string }> {
  const r = await call('members');
  return r.status === 200 ? r.body : { error: r.body.error ?? 'No se pudo' };
}
export async function setMember(userId: string, role: string | null, name: string): Promise<Result> {
  const r = await call('setMember', { userId, role, name });
  if (r.status === 200) await load();
  return r.status === 200 ? { ok: true } : { ok: false, error: r.body.error ?? 'No se pudo' };
}
export async function createUser(email: string, password: string, name: string, role: string): Promise<Result> {
  const r = await call('createUser', { email, password, name, role });
  if (r.status === 200) await load();
  return r.status === 200 ? { ok: true } : { ok: false, error: r.body.error ?? 'No se pudo' };
}

export function useApp(): Snapshot {
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}

if (typeof window !== 'undefined') {
  sb.auth.onAuthStateChange((event: string) => {
    if (event === 'SIGNED_OUT') {
      phase = 'login';
      emit();
    }
  });
  void load();
  // Revisa reglas de tiempo (bloqueos que vencen, horario) y respaldo si el tiempo real se cae.
  setInterval(() => {
    if (phase !== 'ready') return;
    void run({ type: 'tick' }, '');
    if (!live) void load();
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && phase === 'ready') void load();
  });
}
