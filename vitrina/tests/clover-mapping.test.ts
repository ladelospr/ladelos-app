import { describe, expect, it } from 'vitest';
import catalog from '../../src/lib/clover-bayamon-flavors.json';
import { initialState } from '../src/domain/seed';
import { interpretOrder, type CloverLineItem, type CloverOrderContext } from '../src/integrations/clover';

const carne = catalog.flavors.find((flavor) => flavor.name === 'Carne')!;
const context: CloverOrderContext = { merchantId: catalog.merchantId, channel: 'register' };
const line = (id: string, itemId: string, name = 'Carne'): CloverLineItem => ({ id, name, item: { id: itemId } });
const interpret = (lines: CloverLineItem[], options = context) =>
  interpretOrder(initialState(), { id: 'order', lineItems: { elements: lines } }, 'event', options);

describe('mapeo de Clover Bayamón', () => {
  it('clasifica la orden mixta por ID y mantiene un solo sabor', () => {
    const { commands } = interpret([
      line('one', carne.regularId!),
      line('two', carne.regularId!),
      line('three', carne.madeToOrderId, 'Carne al momento'),
    ], { ...context, registerUsesDirectButtons: true });
    expect(commands.map(({ flavorId, origin, qty }) => [flavorId, origin, qty])).toEqual([
      ['carne', 'VITRINA', 1], ['carne', 'VITRINA', 1], ['carne', 'AL_MOMENTO', 1],
    ]);
  });

  it('conserva el despacho histórico y no descuenta una línea ambigua durante el piloto', () => {
    const regular = line('one', carne.regularId!);
    const legacy = { ...regular, id: 'two', modifications: { elements: [{ name: 'AL MOMENTO – COCINA' }] } };
    expect(interpret([regular, legacy]).commands.map((command) => command.origin))
      .toEqual(['DESCONOCIDO', 'AL_MOMENTO']);
    expect(interpret([regular], { ...context, merchantId: 'otro', registerUsesDirectButtons: true }).commands[0]?.origin)
      .toBe('DESCONOCIDO');
  });

  it('reconoce los postres y da prioridad al canal de delivery', () => {
    const postre = catalog.flavors.find((flavor) => flavor.name === 'Pastelillo Guayaba Queso')!;
    expect(interpret([line('postre', postre.madeToOrderId, postre.name)]).commands[0])
      .toMatchObject({ flavorId: 'guayaba-queso', origin: 'AL_MOMENTO' });
    const external = { ...line('delivery', 'delivery-id', 'Nombre externo'), modifications: { elements: [{ name: 'VITRINA - NO HACER' }] } };
    for (const channel of ['uber_eats', 'doordash'] as const) {
      expect(interpret([external], { ...context, channel, deliveryFlavorIds: new Map([['delivery-id', 'carne']]) }).commands[0])
        .toMatchObject({ flavorId: 'carne', origin: 'AL_MOMENTO' });
    }
  });
});
