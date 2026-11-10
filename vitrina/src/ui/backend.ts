// Contrato común entre el modo local (Fase 1, un solo equipo) y el modo conectado (Fase 2, Supabase).
import type { State, Role } from '../domain/types';

export interface SyncInfo {
  status: 'ok' | 'saving' | 'offline' | 'error';
  message: string;
  lastSaved: Date | null;
}

export interface Me {
  user_id: string;
  role: Role;
  display_name: string;
}

export interface StoreInfo {
  id: string;
  name: string;
  test: boolean;
}

export interface Snapshot {
  phase: 'loading' | 'login' | 'noaccess' | 'ready' | 'error';
  error?: string;
  state: State;
  offsetMs: number; // diferencia de hora simulada (solo pruebas)
  sync: SyncInfo;
  me: Me | null;
  store: StoreInfo | null;
  stores: StoreInfo[];
}

export interface MemberRow {
  user_id: string;
  store_id: string;
  role: Role;
  display_name: string;
}
export interface ProfileRow {
  id: string;
  nombre: string | null;
  rol: string | null;
  email?: string;
}
