// Hora de Puerto Rico (America/Puerto_Rico, UTC-4 todo el año, sin horario de verano).
// Todas las reglas de horario se evalúan con estas funciones, nunca con la hora local del dispositivo.
export const TZ = 'America/Puerto_Rico';

export interface PRTime {
  date: string; // YYYY-MM-DD (fecha de negocio en PR)
  weekday: number; // 0 = domingo ... 6 = sábado
  minutes: number; // minutos desde medianoche en PR
}

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  weekday: 'short',
});
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function prTime(d: Date): PRTime {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  const hour = Number(p.hour) % 24;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: WD[p.weekday],
    minutes: hour * 60 + Number(p.minute),
  };
}

export function hm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fmtHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Instante (Date) del mismo día de PR que `now` a los minutos indicados. */
export function instantAtPRMinutes(now: Date, targetMin: number): Date {
  const t = prTime(now);
  const base = now.getTime() - (now.getUTCSeconds() * 1000 + now.getUTCMilliseconds());
  return new Date(base + (targetMin - t.minutes) * 60000);
}

export function fmtTimeOf(iso: string): string {
  return fmtHM(prTime(new Date(iso)).minutes);
}

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
