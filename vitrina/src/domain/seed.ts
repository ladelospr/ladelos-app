import type { Flavor, Schedule, Settings, State, User } from './types';

// Sabores tomados del inventario real de Clover de LADELOS BAYAMÓN (nov. 2026).
// Mínimos y objetivos: solo los 6 del documento tienen valores propuestos por el negocio;
// el resto usa 2 / 4 provisional hasta que Administración los apruebe.
const PROPOSED: Record<string, { min: number; target: number; until?: string }> = {
  Carne: { min: 4, target: 8 },
  Pollo: { min: 4, target: 8 },
  'Pollo Queso Americano': { min: 3, target: 6 },
  'Pollo Queso Mozzarella': { min: 3, target: 6 },
  'Jamón Queso': { min: 3, target: 6 },
  Pizza: { min: 3, target: 6 },
  Revoltillo: { min: 3, target: 6, until: '10:00' },
};

// Se preparan solo al momento (documento, sección 14). Nombre en la app -> nombre en Clover.
const AL_MOMENTO: Record<string, string> = {
  Queso: 'Queso',
  'Pollo Brócoli': 'Pollo Brócoli',
  'Brócoli Cebolla': 'Brócoli & Cebolla',
  'Brócoli Cebolla Queso': 'Brócoli, Cebolla & Queso',
  'Queso Cebolla': 'Queso & Cebolla',
  'Guayaba Queso': 'Guayaba Queso',
  Nutella: 'Nutella',
  'Apple Pie': 'Apple Pie',
};

const VITRINA_NAMES = [
  'Carne', 'Pollo', 'Pollo Queso Americano', 'Pollo Queso Mozzarella', 'Jamón Queso', 'Pizza', 'Revoltillo',
  'Carne Queso Americano', 'Carne Queso Mozzarella', 'Pizza Pepperoni', 'Pizza Chorizo', 'Tripleta',
  'Revoltillo Deluxe', 'Pollo Picante', 'Pollo Bacon Ranch', 'Pastelón Pollo', 'Pastelón Carne', 'Lasaña',
  'Cubano', 'Cheeseburger', 'Bistec', 'Carne Ahumada', 'Carbonara', 'Pechuga Rellena', 'Pastrami',
  'Meat Lover', 'Monte Cristo', 'BBQ Pork', 'Chicken Deluxe', 'Philly Cheesesteak', 'Cuajito',
  'Brócoli & Queso', 'Churrasco Queso', 'Churrasco, Amarillos y Queso', 'Camarón',
  'Camarón, Churrasco y Queso', 'Carbonara Camarón', 'Mofongo Camarones', 'Pulpo', 'Spicy Crab',
];

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function seedFlavors(): Flavor[] {
  const out: Flavor[] = [];
  VITRINA_NAMES.forEach((name, i) => {
    const p = PROPOSED[name];
    out.push({
      id: slug(name),
      name,
      cloverNames: [name],
      active: true,
      vitrinaEligible: true,
      min: p ? p.min : 2,
      targets: [{ from: '05:00', target: p ? p.target : 4 }],
      replenishUntil: p?.until,
      adminRestricted: false,
      provisional: !p,
      order: i,
    });
  });
  Object.entries(AL_MOMENTO).forEach(([name, clover], i) => {
    out.push({
      id: slug(name),
      name,
      cloverNames: [clover],
      active: true,
      vitrinaEligible: false,
      min: 0,
      targets: [{ from: '05:00', target: 0 }],
      adminRestricted: false,
      provisional: false,
      order: 100 + i,
    });
  });
  return out;
}

export function seedSchedule(): Schedule {
  const wk = (cutoff: string) => ({ open: '06:00', close: '15:00', staffStart: '05:00', replenishCutoff: cutoff });
  return {
    days: [
      null, // domingo cerrado
      wk('12:30'),
      wk('12:30'),
      wk('12:30'),
      wk('12:30'),
      wk('13:30'),
      { open: '08:00', close: '15:00', staffStart: '05:00', replenishCutoff: '13:30' },
    ],
  };
}

export function seedSettings(): Settings {
  return {
    autoOnlyIfStockedToday: true,
    demandWindowMin: 45,
    weights: { slot: 0.35, weekday: 0.25, today: 0.2, trend: 0.1, unmet: 0.1 },
    unmetDedupSeconds: 20,
    postponeDefaultMin: 15,
  };
}

export function seedUsers(): User[] {
  return [
    { id: 'danny', name: 'Danny', role: 'admin', pin: '1234', active: true },
    { id: 'soha', name: 'Soha', role: 'admin', pin: '1234', active: true },
    { id: 'vitrina', name: 'Vitrina', role: 'vitrina', pin: '', active: true },
    { id: 'freidora', name: 'Freidora', role: 'freidora', pin: '', active: true },
  ];
}

export function initialState(): State {
  const flavors = seedFlavors();
  const inventory: Record<string, number> = {};
  for (const f of flavors) inventory[f.id] = 0;
  return {
    schema: 1,
    storeId: 'bayamon',
    storeName: 'Bayamón',
    seq: 1,
    flavors,
    inventory,
    stockedToday: {},
    postponedUntil: {},
    requests: [],
    blocks: [],
    substitutions: [],
    waste: [],
    unmet: [],
    saleLines: {},
    saleLog: [],
    processedEvents: {},
    movements: [],
    audit: [],
    users: seedUsers(),
    schedule: seedSchedule(),
    settings: seedSettings(),
  };
}
