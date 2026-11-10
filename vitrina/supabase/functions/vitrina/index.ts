// Edge Function "vitrina" — LADELOS Control de Vitrina (Fase 2).
// Se instala en Supabase → Edge Functions. Usa las variables que Supabase ya trae:
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (la llave de servicio nunca sale del servidor).
// @ts-nocheck — se ejecuta en Deno, no en el compilador del proyecto.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { handle, type Db } from '../../../src/server/handler';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const must = <T,>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

const db: Db = {
  async getUser(h) {
    if (!h) return null;
    const { data, error } = await admin.auth.getUser(h.replace(/^Bearer\s+/i, ''));
    return error || !data.user ? null : { id: data.user.id, email: data.user.email };
  },
  async getMember(storeId, userId) {
    return must(await admin.from('vitrina_members').select('*').eq('store_id', storeId).eq('user_id', userId).maybeSingle());
  },
  async listMembers(storeId) {
    return must(await admin.from('vitrina_members').select('*').eq('store_id', storeId).order('created_at'));
  },
  async upsertMember(m) {
    must(await admin.from('vitrina_members').upsert(m, { onConflict: 'store_id,user_id' }));
  },
  async deleteMember(storeId, userId) {
    must(await admin.from('vitrina_members').delete().eq('store_id', storeId).eq('user_id', userId));
  },
  async listProfiles() {
    const profiles = must(await admin.from('profiles').select('id,nombre,rol').order('nombre'));
    const { data } = await admin.auth.admin.listUsers({ perPage: 500 });
    const email = new Map((data?.users ?? []).map((u) => [u.id, u.email]));
    return profiles.map((p) => ({ ...p, email: email.get(p.id) }));
  },
  async createAuthUser(email, password, name) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre: name } });
    if (error || !data.user) return { error: error?.message?.includes('already') ? 'Ya existe una cuenta con ese correo' : error?.message ?? 'No se pudo crear la cuenta' };
    await admin.from('profiles').update({ nombre: name }).eq('id', data.user.id);
    return { id: data.user.id };
  },
  async loadStore(storeId) {
    return must(await admin.from('vitrina_store').select('state,version,test_offset_ms').eq('store_id', storeId).maybeSingle());
  },
  async insertStore(storeId, state) {
    const { error } = await admin.from('vitrina_store').insert({ store_id: storeId, state, version: 0 });
    if (error && error.code !== '23505') throw new Error(error.message);
    return !error;
  },
  async casStore(storeId, expected, state) {
    const rows = must(
      await admin
        .from('vitrina_store')
        .update({ state, version: expected + 1, updated_at: new Date().toISOString() })
        .eq('store_id', storeId)
        .eq('version', expected)
        .select('version'),
    );
    return rows.length === 1;
  },
  async setTestOffset(storeId, ms) {
    must(await admin.from('vitrina_store').update({ test_offset_ms: ms }).eq('store_id', storeId));
  },
  async appendHistory(storeId, version, e) {
    must(await admin.from('vitrina_history').insert({ store_id: storeId, version, ...e }));
  },
  async ping(storeId, version) {
    must(await admin.from('vitrina_ping').upsert({ store_id: storeId, version, at: new Date().toISOString() }));
  },
  now: () => Date.now(),
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: CORS });
  try {
    const body = await req.json();
    const r = await handle(db, req.headers.get('Authorization'), body);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error del servidor. Intenta otra vez.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
