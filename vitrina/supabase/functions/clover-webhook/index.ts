// Edge Function "clover-webhook" — recibe las órdenes de Clover y descuenta la vitrina.
// IMPORTANTE: al crearla en Supabase, desactiva "Verify JWT" (Clover no manda el JWT de Supabase;
// la seguridad es el código secreto en X-Clover-Auth).
// Variables (Edge Functions → Secrets):
//   CLOVER_WEBHOOK_CODE  código que Clover manda en X-Clover-Auth
//   CLOVER_API_TOKEN     token de solo lectura de órdenes
//   CLOVER_MERCHANTS     {"REKD5Z4C7KA71":"bayamon"}
//   CLOVER_API_BASE      opcional, por defecto https://api.clover.com
//   CLOVER_DIRECT_BUTTONS opcional, "false" para apagar los botones directos (por defecto activos)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen con Supabase.
// @ts-nocheck — se ejecuta en Deno.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import type { Db } from '../../../src/server/handler';
import { handleCloverWebhook, parseMerchants } from '../../../src/server/webhook';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const must = <T,>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

// Solo lo que usa el webhook; el resto de Db no aplica aquí.
const db = {
  async listMembers(storeId) {
    return must(await admin.from('vitrina_members').select('*').eq('store_id', storeId).order('created_at'));
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
      await admin.from('vitrina_store').update({ state, version: expected + 1, updated_at: new Date().toISOString() })
        .eq('store_id', storeId).eq('version', expected).select('version'),
    );
    return rows.length === 1;
  },
  async appendHistory(storeId, version, e) {
    must(await admin.from('vitrina_history').insert({ store_id: storeId, version, ...e }));
  },
  async ping(storeId, version) {
    must(await admin.from('vitrina_ping').upsert({ store_id: storeId, version, at: new Date().toISOString() }));
  },
  now: () => Date.now(),
} as Db;

const API = (Deno.env.get('CLOVER_API_BASE') ?? 'https://api.clover.com').replace(/\/$/, '');

async function fetchOrder(merchantId: string, orderId: string) {
  const url = `${API}/v3/merchants/${encodeURIComponent(merchantId)}/orders/${encodeURIComponent(orderId)}?expand=lineItems.modifications`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${Deno.env.get('CLOVER_API_TOKEN')}`, Accept: 'application/json' } });
  if (res.status === 404) return null; // la orden ya no existe (borrada)
  if (!res.ok) throw new Error(`Clover respondió ${res.status}`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  try {
    const body = await req.json().catch(() => null);
    const r = await handleCloverWebhook(
      db,
      {
        webhookCode: Deno.env.get('CLOVER_WEBHOOK_CODE') ?? '',
        merchants: parseMerchants(Deno.env.get('CLOVER_MERCHANTS')),
        directButtons: Deno.env.get('CLOVER_DIRECT_BUTTONS') !== 'false',
      },
      { authCode: req.headers.get('X-Clover-Auth'), body },
      fetchOrder,
    );
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
