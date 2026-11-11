// Preparación para la Fase 3 (Clover). NO está conectado todavía.
// Verificado en docs.clover.com/docs/webhooks: el webhook solo trae {objectId, type, ts};
// hay que buscar la orden completa por REST (GET /v3/merchants/{mId}/orders/{orderId}?expand=lineItems.modifications)
// desde un servidor, con la app de Clover instalada y el encabezado X-Clover-Auth validado.
import bayamonFlavors from '../../../src/lib/clover-bayamon-flavors.json';
import type { Command } from '../domain/engine';
import type { Flavor, SaleOrigin, State } from '../domain/types';

export interface CloverModification {
  name: string;
}
export interface CloverLineItem {
  id: string;
  name: string;
  item?: { id: string };
  refunded?: boolean;
  unitQty?: number;
  modifications?: { elements?: CloverModification[] };
}
export interface CloverOrder {
  id: string;
  state?: string;
  lineItems?: { elements?: CloverLineItem[] };
}

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‐-―−]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "VITRINA - NO HACER" (guion) y "AL MOMENTO – COCINA" (raya) se reconocen igual. */
export function originFromModifiers(mods: CloverModification[] | undefined): SaleOrigin {
  const names = (mods ?? []).map((m) => normalize(m.name));
  const vit = names.some((n) => n.includes('vitrina'));
  const mom = names.some((n) => n.includes('al momento'));
  if (vit && !mom) return 'VITRINA';
  if (mom && !vit) return 'AL_MOMENTO';
  return 'DESCONOCIDO';
}

export function matchFlavor(flavors: Flavor[], line: CloverLineItem): Flavor | undefined {
  const n = normalize(line.name);
  return flavors.find((f) => f.cloverNames.some((c) => normalize(c) === n));
}

export interface CloverOrderContext {
  merchantId: string;
  channel?: 'register' | 'uber_eats' | 'doordash';
  // Activar por tienda solo después de validar la transición de caja.
  registerUsesDirectButtons?: boolean;
  // IDs de delivery validados contra órdenes reales de este comercio y canal.
  deliveryFlavorIds?: ReadonlyMap<string, string>;
}

const bayamonItems = new Map<string, { name: string; madeToOrder: boolean }>(bayamonFlavors.flavors.flatMap((flavor) => [
  [flavor.madeToOrderId, { name: flavor.name, madeToOrder: true }] as const,
  ...(flavor.regularId ? [[flavor.regularId, { name: flavor.name, madeToOrder: false }] as const] : []),
]));

function findOrderFlavor(flavors: Flavor[], line: CloverLineItem, context?: CloverOrderContext) {
  const id = line.item?.id;
  const delivery = context?.channel === 'uber_eats' || context?.channel === 'doordash';
  const deliveryFlavorId = delivery && id ? context.deliveryFlavorIds?.get(id) : undefined;
  const mapped = id && context?.merchantId === bayamonFlavors.merchantId ? bayamonItems.get(id) : undefined;
  // Los nombres de postres de Clover incluyen un prefijo que el catálogo de Vitrina no usa.
  const name = mapped?.name.replace(/^Pastelillo /, '') ?? line.name;
  const flavor = deliveryFlavorId
    ? flavors.find((f) => f.id === deliveryFlavorId)
    : matchFlavor(flavors, { ...line, name });
  if (!flavor) return undefined;

  const legacyOrigin = originFromModifiers(line.modifications?.elements);
  let origin: SaleOrigin = legacyOrigin;
  if (delivery || mapped?.madeToOrder || !flavor.vitrinaEligible) {
    origin = 'AL_MOMENTO';
  } else if (legacyOrigin === 'DESCONOCIDO' && !line.modifications?.elements?.some(
    (m) => /vitrina|al momento/.test(normalize(m.name)),
  ) && mapped && context?.channel === 'register' && context.registerUsesDirectButtons) {
    origin = 'VITRINA';
  }
  return { flavor, origin };
}

export interface Interpretation {
  commands: Extract<Command, { type: 'saleLine' }>[];
  ignored: { lineId: string; name: string; reason: string }[];
  warnings: string[];
}

/**
 * Convierte una orden de Clover en comandos de venta idempotentes.
 * - Cada línea cuenta como 1 unidad (POR VERIFICAR con órdenes reales: si Clover usa unitQty en estos artículos).
 * - Líneas que ya no aparecen en la orden se marcan como eliminadas (devuelven a vitrina).
 * - Líneas reembolsadas no regresan a vitrina.
 */
export function interpretOrder(state: State, order: CloverOrder, eventId: string, context?: CloverOrderContext): Interpretation {
  const out: Interpretation = { commands: [], ignored: [], warnings: [] };
  const lines = order.lineItems?.elements;
  if (!lines) return out;
  const seen = new Set<string>();
  for (const li of lines) {
    seen.add(li.id);
    const match = findOrderFlavor(state.flavors, li, context);
    if (!match) {
      out.ignored.push({ lineId: li.id, name: li.name, reason: 'No es un sabor del catálogo' });
      continue;
    }
    if (li.unitQty !== undefined && li.unitQty !== 1000)
      out.warnings.push(`La línea ${li.id} (${li.name}) trae unitQty=${li.unitQty}; se contó como 1. Verificar.`);
    out.commands.push({
      type: 'saleLine',
      eventId: `${eventId}:${li.id}`,
      lineId: li.id,
      orderId: order.id,
      flavorId: match.flavor.id,
      qty: 1,
      origin: match.origin,
      status: li.refunded ? 'reembolsada' : 'activa',
      source: 'clover',
    });
  }
  for (const sl of Object.values(state.saleLines))
    if (sl.orderId === order.id && !seen.has(sl.lineId) && sl.status === 'activa')
      out.commands.push({
        type: 'saleLine',
        eventId: `${eventId}:${sl.lineId}:del`,
        lineId: sl.lineId,
        orderId: order.id,
        flavorId: sl.flavorId,
        qty: sl.qty,
        origin: sl.origin,
        status: 'eliminada',
        source: 'clover',
      });
  return out;
}

/** Orden borrada en Clover (webhook DELETE): todas sus líneas activas se marcan eliminadas. */
export function deletedOrderCommands(state: State, orderId: string, eventId: string) {
  return interpretOrder(state, { id: orderId, lineItems: { elements: [] } }, eventId).commands;
}

export interface WebhookOrderEvent {
  merchantId: string;
  orderId: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  ts: number;
  eventId: string;
}

/** Extrae los eventos de órdenes ("O:") del cuerpo del webhook de Clover. */
export function parseWebhook(body: unknown): WebhookOrderEvent[] {
  const out: WebhookOrderEvent[] = [];
  const merchants = (body as { merchants?: Record<string, unknown> })?.merchants;
  if (!merchants || typeof merchants !== 'object') return out;
  for (const [merchantId, v] of Object.entries(merchants)) {
    const list = Array.isArray(v) ? v : (v as { update?: unknown[] })?.update ?? [];
    for (const u of list as { objectId?: string; type?: string; ts?: number }[]) {
      if (!u.objectId?.startsWith('O:')) continue;
      const type = u.type as WebhookOrderEvent['type'];
      if (!['CREATE', 'UPDATE', 'DELETE'].includes(type)) continue;
      const orderId = u.objectId.slice(2);
      out.push({ merchantId, orderId, type, ts: u.ts ?? 0, eventId: `${merchantId}:${orderId}:${type}:${u.ts}` });
    }
  }
  return out;
}
