import type { ReactNode } from 'react';
import type { Command, Light, Result } from '../domain/engine';
import type { RequestKind, State } from '../domain/types';
import { fmtTimeOf } from '../domain/time';

const { createContext, useContext, useEffect } = React;

export interface ActCtx {
  userId: string;
  act: (cmd: Command, okMsg?: string) => Promise<Result>;
  toast: (msg: string, kind?: 'ok' | 'error' | 'info') => void;
}
export const Act = createContext<ActCtx>(null as unknown as ActCtx);
export const useAct = () => useContext(Act);

export const fname = (s: State, id: string) => s.flavors.find((f) => f.id === id)?.name ?? id;
export const timeOf = (iso?: string) => (iso ? fmtTimeOf(iso) : '');

export const KIND: Record<RequestKind, { label: string; cls: string }> = {
  roja: { label: 'Automática · agotado', cls: 'k-roja' },
  amarilla: { label: 'Aprobada por vitrina', cls: 'k-amarilla' },
  sugerencia: { label: 'Sugerencia aprobada', cls: 'k-sug' },
  sustitucion: { label: 'Sustitución', cls: 'k-sus' },
  excepcion: { label: 'Excepción autorizada', cls: 'k-exc' },
  inicial: { label: 'Producción inicial', cls: 'k-ini' },
};

export function KindBadge({ kind }: { kind: RequestKind }) {
  return <span className={`kind ${KIND[kind].cls}`}>{KIND[kind].label}</span>;
}

export const LIGHT: Record<Light, { label: string; icon: string }> = {
  verde: { label: 'Bien', icon: '✓' },
  amarillo: { label: 'Bajo', icon: '!' },
  rojo: { label: 'Agotado', icon: '×' },
};

export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Cerrar">
            Cerrar
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, id }: { value: number; onChange: (n: number) => void; min?: number; max?: number; id?: string }) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));
  return (
    <div className="stepper">
      <button className="step" onClick={() => set(value - 1)} aria-label="Menos" disabled={value <= min}>
        −
      </button>
      <input
        id={id}
        className="step-val"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10);
          set(n);
        }}
      />
      <button className="step" onClick={() => set(value + 1)} aria-label="Más" disabled={value >= max}>
        +
      </button>
    </div>
  );
}

export function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} className={`chip${value === o ? ' on' : ''}`} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
