// Fase 1: persistencia LOCAL en este navegador (localStorage).
// Varias pestañas del mismo equipo se mantienen al día; equipos distintos NO se sincronizan (Fase 2).
import { dispatch, type Command, type Result } from '../domain/engine';
import { initialState } from '../domain/seed';
import type { State } from '../domain/types';
import type { MemberRow, ProfileRow, Snapshot } from './backend';

export const mode: 'local' | 'remote' = 'local';

const KEY = 'ladelos-vitrina:v1:bayamon';
const OFFSET_KEY = 'ladelos-vitrina:v1:offset';

function migrate(raw: State): State {
  const base = initialState();
  return { ...base, ...raw, settings: { ...base.settings, ...raw.settings } };
}

function read(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.schema === 1 ? migrate(s) : null;
  } catch {
    return null;
  }
}

let state: State = read() ?? initialState();
let offsetMs = 0;
try {
  offsetMs = Number(localStorage.getItem(OFFSET_KEY) || 0) || 0;
} catch {
  /* sin almacenamiento */
}

export const sync = {
  status: 'ok' as 'ok' | 'saving' | 'offline' | 'error',
  message: 'Guardado en este equipo',
  lastSaved: null as Date | null,
};

const listeners = new Set<() => void>();
const build = (): Snapshot => ({ phase: 'ready', state, offsetMs, sync: { ...sync }, me: null, store: { id: 'local', name: state.storeName, test: false }, stores: [] });
let snapshot = build();
function emit() {
  snapshot = build();
  listeners.forEach((l) => l());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    sync.status = 'ok';
    sync.message = 'Guardado en este equipo';
    sync.lastSaved = new Date();
  } catch {
    sync.status = 'error';
    sync.message = 'No se pudo guardar en este equipo. Lo que hagas ahora se puede perder.';
  }
}

export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

export async function run(cmd: Command, userId: string): Promise<Result> {
  return runSync(cmd, userId);
}

function runSync(cmd: Command, userId: string): Result {
  const latest = read(); // otra pestaña pudo haber cambiado algo
  if (latest) state = latest;
  const r = dispatch(state, cmd, { now: now(), userId });
  if (r.result.ok) {
    state = r.state;
    persist();
  }
  emit();
  return r.result;
}

/** Reemplaza el estado completo (importar, datos de prueba, reiniciar). */
export async function replaceState(s: State, _confirm?: string): Promise<Result> {
  state = s;
  persist();
  emit();
  return { ok: true };
}

export function getState() {
  return state;
}

export async function setSimulatedTime(target: Date | null): Promise<Result> {
  offsetMs = target ? target.getTime() - Date.now() : 0;
  try {
    if (offsetMs) localStorage.setItem(OFFSET_KEY, String(offsetMs));
    else localStorage.removeItem(OFFSET_KEY);
  } catch {
    /* sin almacenamiento */
  }
  runSync({ type: 'tick' }, 'sistema');
  return { ok: true };
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
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      const s = read();
      if (s) {
        state = s;
        emit();
      }
    }
  });
  setInterval(() => runSync({ type: 'tick' }, 'sistema'), 15000);
  if (!localStorage.getItem?.(KEY)) persist();
}

// Funciones del modo conectado (no aplican en el modo local)
const na = async (): Promise<Result> => ({ ok: false, error: 'Disponible solo en la versión conectada' });
export const signIn = async (_e: string, _p: string): Promise<string | null> => 'Disponible solo en la versión conectada';
export const signOut = async () => {};
export const switchStore = async (_id: string) => {};
export const listMembers = async (): Promise<{ members: MemberRow[]; profiles: ProfileRow[] } | { error: string }> => ({ error: 'Disponible solo en la versión conectada' });
export const setMember = (_u: string, _r: string | null, _n: string) => na();
export const createUser = (_e: string, _p: string, _n: string, _r: string) => na();
