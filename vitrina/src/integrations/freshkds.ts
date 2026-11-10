// Preparación para la Fase 4 (Fresh KDS). NO está conectado.
// Verificado en la documentación de Fresh KDS APIs (fresh-technology.github.io):
// POST /integrators/kds-orders con encabezados x-integration-token, x-location-id, x-device-ids.
// Requiere acceso de integrador aprobado por Fresh (partnerships@freshtechnology.com).
// `mode` solo acepta For Here, ToGo, Pickup, DriveThru, Delivery, Curbside; no hay campo de color documentado.
import type { ReplenishRequest, State } from '../domain/types';

export interface FreshOrder {
  id: string;
  name: string;
  time: string;
  mode: 'For Here';
  specialInstructions: string;
  priority: boolean;
  items: { lineId: string; name: string; qty: number; mods: { name: string }[] }[];
}

export function replenishmentTicket(state: State, requests: ReplenishRequest[], now: Date): FreshOrder {
  const kindLabel: Record<string, string> = {
    roja: 'AUTOMÁTICA',
    amarilla: 'APROBADA',
    sugerencia: 'SUGERENCIA',
    sustitucion: 'SUSTITUCIÓN',
    excepcion: 'EXCEPCIÓN',
    inicial: 'INICIAL',
  };
  return {
    id: `vitrina-${requests.map((r) => r.id).join('-')}`,
    name: 'VITRINA — REPOSICIÓN',
    time: now.toISOString(),
    mode: 'For Here',
    specialInstructions: 'No es orden de cliente. Producción para la vitrina.',
    priority: requests.some((r) => r.kind === 'roja'),
    items: requests.map((r) => ({
      lineId: r.id,
      name: `Preparar ${r.qtyRequested} ${state.flavors.find((f) => f.id === r.flavorId)?.name ?? r.flavorId}`,
      qty: r.qtyRequested,
      mods: [{ name: kindLabel[r.kind] ?? r.kind }],
    })),
  };
}
