import { describe, expect, it } from 'vitest';
import catalog from '../../src/lib/clover-bayamon-flavors.json';
import { initialState } from '../src/domain/seed';
import type { Db, StoreRow } from '../src/server/handler';
import { handleCloverWebhook, parseMerchants, safeEqual, type CloverWebhookConfig } from '../src/server/webhook';
import type { CloverOrder } from '../src/integrations/clover';

const carne = catalog.flavors.find((f) => f.name === 'Carne')!;
const M = catalog.merchantId;
const cfg: CloverWebhookConfig = { webhookCode: 'secreto', merchants: { [M]: 'bayamon' }, directButtons: true };

function fakeDb() {
  const stores: Record<string, StoreRow> = {};
  const history: unknown[] = [];
  const db = {
    async listMembers() { return []; },
    async loadStore(s: string) { return stores[s] ? structuredClone(stores[s]) : null; },
    async insertStore(s: string, state: StoreRow['state']) { if (stores[s]) return false; stores[s] = { state, version: 0, test_offset_ms: 0 }; return true; },
    async casStore(s: string, v: number, state: StoreRow['state']) { if (stores[s].version !== v) return false; stores[s] = { ...stores[s], state, version: v + 1 }; return true; },
    async appendHistory(_s: string, _v: number, e: unknown) { history.push(e); },
    async ping() {},
    now: () => new Date('2026-11-12T15:00:00Z').getTime(),
  } as unknown as Db;
  return { db, stores, history };
}

const body = (...u: { objectId: string; type: string; ts: number }[]) => ({ merchants: { [M]: u } });
const order = (id: string, ...lines: [string, string][]): CloverOrder => ({
  id,
  lineItems: { elements: lines.map(([lid, itemId]) => ({ id: lid, name: 'x', item: { id: itemId } })) },
});

describe('webhook de Clover', () => {
  it('rechaza sin código o con código incorrecto', async () => {
    const { db } = fakeDb();
    const f = async () => null;
    expect((await handleCloverWebhook(db, cfg, { authCode: null, body: body() }, f)).status).toBe(401);
    expect((await handleCloverWebhook(db, cfg, { authCode: 'malo', body: body() }, f)).status).toBe(401);
    expect((await handleCloverWebhook(db, { ...cfg, webhookCode: '' }, { authCode: '', body: body() }, f)).status).toBe(503);
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  it('responde 200 al código de verificación de Clover', async () => {
    const { db } = fakeDb();
    expect((await handleCloverWebhook(db, cfg, { authCode: null, body: { verificationCode: 'abc-123' } }, async () => null)).status).toBe(200);
  });

  it('descuenta vitrina, no descuenta al momento y es idempotente', async () => {
    const { db, stores, history } = fakeDb();
    const o = order('O1', ['L1', carne.regularId!], ['L2', carne.madeToOrderId]);
    const fetchOrder = async () => o;
    const req = { authCode: 'secreto', body: body({ objectId: 'O:O1', type: 'CREATE', ts: 1 }) };
    const first = await handleCloverWebhook(db, cfg, req, fetchOrder);
    expect(first.status).toBe(200);
    expect(first.body.applied).toBe(2);
    const v = stores.bayamon.version;
    expect(stores.bayamon.state.saleLines['L1'].origin).toBe('VITRINA');
    expect(stores.bayamon.state.saleLines['L2'].origin).toBe('AL_MOMENTO');
    const dec = stores.bayamon.state.movements.filter((m) => m.reason === 'venta' || (m as { kind?: string }).kind === 'venta');
    expect(history.length).toBe(1);
    // Mismo evento otra vez (Clover reintenta): no cambia nada.
    const again = await handleCloverWebhook(db, cfg, req, fetchOrder);
    expect(again.status).toBe(200);
    expect(stores.bayamon.version).toBe(v);
    expect(dec.length).toBe(stores.bayamon.state.movements.filter((m) => m.reason === 'venta' || (m as { kind?: string }).kind === 'venta').length);
  });

  it('una orden borrada devuelve la línea eliminada', async () => {
    const { db, stores } = fakeDb();
    const o = order('O2', ['L9', carne.regularId!]);
    await handleCloverWebhook(db, cfg, { authCode: 'secreto', body: body({ objectId: 'O:O2', type: 'CREATE', ts: 1 }) }, async () => o);
    const r = await handleCloverWebhook(db, cfg, { authCode: 'secreto', body: body({ objectId: 'O:O2', type: 'DELETE', ts: 2 }) }, async () => null);
    expect(r.status).toBe(200);
    expect(stores.bayamon.state.saleLines['L9'].status).toBe('eliminada');
  });

  it('ignora comercios sin mapa y si falla la lectura de Clover pide reintento', async () => {
    const { db } = fakeDb();
    const otro = { merchants: { OTRO: [{ objectId: 'O:X', type: 'CREATE', ts: 1 }] } };
    const r1 = await handleCloverWebhook(db, cfg, { authCode: 'secreto', body: otro }, async () => { throw new Error('no debe llamarse'); });
    expect(r1.body.events).toBe(0);
    const r2 = await handleCloverWebhook(db, cfg, { authCode: 'secreto', body: body({ objectId: 'O:O3', type: 'CREATE', ts: 1 }) }, async () => { throw new Error('Clover respondió 500'); });
    expect(r2.status).toBe(502);
  });

  it('parseMerchants tolera basura', () => {
    expect(parseMerchants(undefined)).toEqual({});
    expect(parseMerchants('no json')).toEqual({});
    expect(parseMerchants('{"A":"bayamon"}')).toEqual({ A: 'bayamon' });
  });
});
