export type Role = 'vitrina' | 'freidora' | 'ambos' | 'admin'; // ambos = vitrina y freidora en el mismo equipo

export interface User {
  id: string;
  name: string;
  role: Role;
  pin: string; // Fase 1: PIN local solo para separar pantallas; no es seguridad real (ver README).
  active: boolean;
}

export interface TargetSlot {
  from: string; // HH:MM hora de PR desde la cual aplica este objetivo
  target: number;
}

export interface Flavor {
  id: string;
  name: string;
  cloverNames: string[]; // nombres exactos del artículo en Clover
  active: boolean;
  vitrinaEligible: boolean; // false = se prepara solo al momento
  min: number; // alerta amarilla cuando disponible <= min
  targets: TargetSlot[]; // objetivo según la hora
  replenishUntil?: string; // HH:MM límite propio del sabor (p. ej. Revoltillo 10:00). Tiene prioridad.
  adminRestricted: boolean; // restricción administrativa: no reponer
  provisional: boolean; // valores de mínimo/objetivo aún no aprobados por el negocio
  order: number;
}

export interface DaySchedule {
  open: string; // apertura al público
  close: string; // cierre
  staffStart: string; // inicio del personal
  replenishCutoff: string; // no crear reposiciones normales después de esta hora
}

export interface Schedule {
  days: (DaySchedule | null)[]; // índice 0 = domingo; null = cerrado
}

export interface Settings {
  autoOnlyIfStockedToday: boolean; // la reposición roja solo aplica a sabores que se pusieron en vitrina hoy
  demandWindowMin: number; // ventana de demanda para sugerencias (min)
  weights: { slot: number; weekday: number; today: number; trend: number; unmet: number };
  unmetDedupSeconds: number;
  postponeDefaultMin: number;
}

export type RequestKind = 'amarilla' | 'roja' | 'inicial' | 'sugerencia' | 'sustitucion' | 'excepcion';
export type RequestStatus = 'propuesta' | 'pendiente' | 'preparando' | 'lista' | 'cerrada' | 'cancelada';

export interface Reception {
  qty: number;
  by: string;
  at: string;
}

export interface ReplenishRequest {
  id: string;
  flavorId: string;
  kind: RequestKind;
  status: RequestStatus;
  qtyRequested: number;
  qtyProduced: number | null;
  qtyReceived: number;
  receptions: Reception[];
  difference: number | null; // producido - recibido al cerrar
  businessDate: string;
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  startedBy?: string;
  startedAt?: string;
  readyBy?: string;
  readyAt?: string;
  closedAt?: string;
  closedBy?: string;
  cancelReason?: string;
  authorizedBy?: string;
  note?: string;
  version: number;
}

export interface Block {
  id: string;
  flavorId: string;
  reason: string;
  by: string;
  start: string;
  until: string; // instante de expiración
  untilClose: boolean;
  active: boolean;
  endedAt?: string;
  endedBy?: string;
  endedHow?: 'expirado' | 'reactivado';
}

export interface Substitution {
  id: string;
  fromFlavorId: string;
  toFlavorId: string;
  qty: number;
  reason: string;
  originalAction: 'bloquear' | 'posponer';
  requestId: string;
  by: string;
  at: string;
}

export interface Waste {
  id: string;
  flavorId: string;
  qty: number;
  reason: string;
  by: string;
  at: string;
}

export interface UnmetDemand {
  id: string;
  flavorId: string;
  by: string;
  at: string;
}

export type SaleOrigin = 'VITRINA' | 'AL_MOMENTO' | 'DESCONOCIDO';
export type SaleLineStatus = 'activa' | 'eliminada' | 'reembolsada';

export interface SaleLine {
  lineId: string;
  orderId: string;
  flavorId: string;
  qty: number;
  origin: SaleOrigin;
  status: SaleLineStatus;
  appliedQty: number; // unidades de vitrina contabilizadas para esta línea
  decremented: number; // unidades realmente descontadas (puede ser menor si no había inventario)
  at: string;
  source: 'clover' | 'simulador';
}

export interface SaleLog {
  at: string;
  flavorId: string;
  qty: number;
  origin: SaleOrigin;
  source: 'clover' | 'simulador' | 'demo';
}

export type MovementType = 'venta' | 'reverso_venta' | 'recepcion' | 'desperdicio' | 'ajuste' | 'cierre_dia';

export interface Movement {
  id: string;
  at: string;
  flavorId: string;
  type: MovementType;
  delta: number;
  before: number;
  after: number;
  by: string;
  reason?: string;
  source: string;
  ref?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  by: string;
  action: string;
  detail: string;
  flavorId?: string;
}

export interface State {
  schema: 1;
  storeId: string;
  storeName: string;
  seq: number;
  flavors: Flavor[];
  inventory: Record<string, number>;
  stockedToday: Record<string, string>; // flavorId -> fecha de negocio en que se recibió producto
  postponedUntil: Record<string, string>;
  requests: ReplenishRequest[];
  blocks: Block[];
  substitutions: Substitution[];
  waste: Waste[];
  unmet: UnmetDemand[];
  saleLines: Record<string, SaleLine>;
  saleLog: SaleLog[];
  processedEvents: Record<string, string>;
  movements: Movement[];
  audit: AuditEntry[];
  users: User[];
  schedule: Schedule;
  settings: Settings;
  lastEvaluatedAt?: string;
}
