// Receptor del webhook de Clover (Prioridad 4). Corre en la Edge Function "clover-webhook".
// Flujo: Clover avisa {objectId,type,ts} -> se valida X-Clover-Auth -> se lee la orden completa por REST
// (solo lectura) -> interpretOrder -> comandos saleLine idempotentes -> se guardan con control de versión.
import { dispatch } from '../domain/engine';
import { deletedOrderCommands, interpretOrder, parseWebhook, type CloverOrder, type WebhookOrderEvent } from '../integrations/clover';
import { loadOrCreate, reply, withMembers, type Db, type Reply } from './handler';

export interface CloverWebhookConfig {
  /** Código que Clover manda en X-Clover-Auth (el mismo que se verifica al registrar la app). */
  webhookCode: string;
  /** merchantId de Clover -> storeId de Vitrina. Ej.: {"REKD5Z4C7KA71":"bayamon"} */
  merchants: Record<string, string>;
  /** Botones directos (sin Despacho) activos en caja. Si es false, las líneas sin Despacho no descuentan. */
  directButtons: boolean;
}

export type FetchOrder = (merchantId: string, orderId: string) => Promise<CloverOrder | null>;

/** Comparación de tiempo constante para no filtrar el código por diferencia de tiempos. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function parseMerchants(raw: string | undefined): Record<string, string> {
  try {
    const v = JSON.parse(raw ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export async function handleCloverWebhook(
  db: Db,
  cfg: CloverWebhookConfig,
  req: { authCode: string | null; body: unknown },
  fetchOrder: FetchOrder,
): Promise<Reply> {
  const verification = (req.body as { verificationCode?: unknown } | null)?.verificationCode;
  // Clover manda este código una sola vez al registrar el webhook; se ve en los logs de la función.
  if (typeof verification === 'string') {
    console.log(`Clover verificationCode: ${verification}`);
    return reply(200, { ok: true });
  }
  if (!cfg.webhookCode) return reply(503, { error: 'Webhook sin configurar' });
  if (!req.authCode || !safeEqual(req.authCode, cfg.webhookCode)) return reply(401, { error: 'No autorizado' });

  const events = parseWebhook(req.body).filter((e) => cfg.merchants[e.merchantId]);
  const byStore = new Map<string, WebhookOrderEvent[]>();
  for (const e of events) byStore.set(cfg.merchants[e.merchantId], [...(byStore.get(cfg.merchants[e.merchantId]) ?? []), e]);

  const summary = { events: events.length, applied: 0, ignored: 0, warnings: [] as string[], failed: [] as string[] };
  for (const [storeId, list] of byStore) {
    // La orden se lee una sola vez por evento, fuera del reintento de guardado.
    const orders = new Map<string, CloverOrder | null>();
    for (const e of list) {
      if (e.type === 'DELETE') continue;
      try {
        orders.set(e.eventId, await fetchOrder(e.merchantId, e.orderId));
      } catch (err) {
        summary.failed.push(`${e.orderId}: ${(err as Error).message}`);
      }
    }
    const pending = list.filter((e) => e.type === 'DELETE' || orders.get(e.eventId));
    if (!pending.length) continue;
    const members = await db.listMembers(storeId);
    let saved = false;
    for (let attempt = 0; attempt < 6 && !saved; attempt++) {
      const row = await loadOrCreate(db, storeId);
      const now = new Date(db.now());
      let state = withMembers(row.state, members);
      const commands: unknown[] = [];
      const warnings: string[] = [];
      let ignored = 0;
      for (const e of pending) {
        const ctx = { merchantId: e.merchantId, channel: 'register' as const, registerUsesDirectButtons: cfg.directButtons };
        const cmds =
          e.type === 'DELETE'
            ? deletedOrderCommands(state, e.orderId, e.eventId)
            : (() => {
                const it = interpretOrder(state, orders.get(e.eventId)!, e.eventId, ctx);
                warnings.push(...it.warnings);
                ignored += it.ignored.length;
                return it.commands;
              })();
        for (const c of cmds) {
          if (c.eventId && state.processedEvents[c.eventId]) continue; // reintento de Clover: ya aplicado
          const r = dispatch(state, c, { now, userId: 'sistema' });
          if (r.result.ok) {
            state = r.state;
            commands.push(c);
          }
        }
      }
      if (!commands.length) {
        summary.ignored += ignored;
        summary.warnings.push(...warnings);
        saved = true;
        break;
      }
      if (!(await db.casStore(storeId, row.version, state))) continue; // otro guardado primero: reintentar
      const v = row.version + 1;
      const oldM = new Set(withMembers(row.state, members).movements.map((m) => m.id));
      const oldA = new Set(withMembers(row.state, members).audit.map((a) => a.id));
      await db.appendHistory(storeId, v, {
        user_id: null,
        command: { type: 'cloverWebhook', events: pending.map((e) => e.eventId), commands },
        ok: true,
        result: { applied: commands.length, warnings },
        movements: state.movements.filter((m) => !oldM.has(m.id)),
        audit: state.audit.filter((a) => !oldA.has(a.id)),
      });
      await db.ping(storeId, v);
      summary.applied += commands.length;
      summary.ignored += ignored;
      summary.warnings.push(...warnings);
      saved = true;
    }
    if (!saved) summary.failed.push(`${storeId}: mucha actividad simultánea; Clover reintentará`);
  }
  // Un fallo devuelve 5xx para que Clover reintente (los eventos son idempotentes).
  return reply(summary.failed.length ? 502 : 200, { ok: !summary.failed.length, ...summary });
}
