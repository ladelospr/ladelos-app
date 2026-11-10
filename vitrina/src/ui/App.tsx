import type { FormEvent, ReactNode } from 'react';
import type { Command, Result } from '../domain/engine';
import type { Role } from '../domain/types';
import { WEEKDAYS, fmtHM, prTime } from '../domain/time';
import { Admin } from './Admin';
import { Act } from './components';
import { Freidora } from './Freidora';
import { enableSound, sounds } from './sound';
import { mode, now as clock, run, signIn, signOut, switchStore, useApp } from './store';
import { Vitrina } from './Vitrina';

const { useState, useEffect, useRef, useCallback } = React;

type Tab = 'vitrina' | 'freidora' | 'admin';
const TAB_KEY = 'ladelos-vitrina:v1:tab';

function readLS(k: string, d: string) {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
}
function writeLS(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento */
  }
}

const TABS_FOR: Record<Role, Tab[]> = {
  vitrina: ['vitrina'],
  freidora: ['freidora'],
  ambos: ['vitrina', 'freidora'],
  admin: ['vitrina', 'freidora', 'admin'],
};

export function App() {
  const snap = useApp();
  if (snap.phase === 'loading') return <Splash text="Conectando…" />;
  if (snap.phase === 'login') return <AccountLogin />;
  if (snap.phase === 'noaccess') return <Splash text={snap.error ?? 'Sin acceso'} action={<button className="btn" onClick={() => signOut()}>Entrar con otra cuenta</button>} />;
  if (snap.phase === 'error') return <Splash text={snap.error ?? 'Error'} action={<button className="btn primary" onClick={() => location.reload()}>Intentar otra vez</button>} />;
  return <Main />;
}

function Splash({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="splash">
      <span className="wordmark big">
        LADELOS<span className="dot">.</span>
      </span>
      <p>{text}</p>
      {action}
    </div>
  );
}

function AccountLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(await signIn(email, pw));
    setBusy(false);
  };
  return (
    <div className="splash">
      <span className="wordmark big">
        LADELOS<span className="dot">.</span>
      </span>
      <form className="panel login" onSubmit={go}>
        <h3>Control de Vitrina</h3>
        <p className="muted">Entra con tu cuenta de ladelos-app.</p>
        <label className="lbl" htmlFor="em">
          Correo
        </label>
        <input id="em" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="lbl" htmlFor="pw">
          Contraseña
        </label>
        <input id="pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="bad">{err}</p>}
        <button className="btn primary big" type="submit" disabled={busy || !email || !pw}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

function Main() {
  const { state: s, offsetMs, sync, me, store, stores } = useApp();
  const remote = mode === 'remote';
  const allowed: Tab[] = remote && me ? TABS_FOR[me.role] : ['vitrina', 'freidora', 'admin'];
  const [tabRaw, setTabRaw] = useState<Tab>(() => (readLS(TAB_KEY, 'vitrina') as Tab) || 'vitrina');
  const tab: Tab = allowed.includes(tabRaw) ? tabRaw : allowed[0];
  const [admin, setAdmin] = useState<string | null>(null); // solo modo local (PIN)
  const [station, setStation] = useState<Record<'vitrina' | 'freidora', string>>(() => ({
    vitrina: readLS('ladelos-vitrina:v1:u-vitrina', 'vitrina'),
    freidora: readLS('ladelos-vitrina:v1:u-freidora', 'freidora'),
  }));
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const [sound, setSound] = useState(false);
  const [mute, setMute] = useState(false);
  const [, force] = useState(0);
  const busy = useRef(false);
  const now = clock();

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);

  const setTab = (t: Tab) => {
    setTabRaw(t);
    writeLS(TAB_KEY, t);
  };

  const toast = useCallback((msg: string, kind: 'ok' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  const userId = remote ? me!.user_id : admin ?? (tab === 'freidora' ? station.freidora : station.vitrina);
  const act = useCallback(
    async (cmd: Command, okMsg?: string): Promise<Result> => {
      // Evita que un doble toque envíe la misma acción dos veces mientras el servidor responde.
      if (busy.current && cmd.type !== 'saleLine') return { ok: false, error: 'Espera, se está guardando lo anterior' };
      busy.current = true;
      try {
        const r = await run(cmd, userId);
        if (!r.ok) {
          if (r.code !== 'duplicate') toast(r.error, 'error');
        } else if (r.info) toast(r.info, 'info');
        else if (okMsg) toast(okMsg, 'ok');
        return r;
      } finally {
        busy.current = false;
      }
    },
    [userId, toast],
  );

  // Alertas sonoras sin repetir: solo suenan cuando aparece algo nuevo.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(s.requests.filter((r) => ['propuesta', 'pendiente', 'lista'].includes(r.status)).map((r) => `${r.id}:${r.status}`));
    if (seen.current && sound) {
      const fresh = s.requests.filter((r) => ids.has(`${r.id}:${r.status}`) && !seen.current!.has(`${r.id}:${r.status}`));
      const urgent = fresh.some((r) => r.status === 'pendiente' && r.kind === 'roja');
      const forFreidora = fresh.some((r) => r.status === 'pendiente');
      const forVitrina = fresh.some((r) => r.status === 'propuesta' || r.status === 'lista');
      if (urgent && tab !== 'vitrina') sounds.urgent();
      else if (!mute && ((tab === 'freidora' && forFreidora) || (tab === 'vitrina' && forVitrina))) sounds.soft();
    }
    seen.current = ids;
  }, [s.requests, sound, mute, tab]);

  const t = prTime(now);
  const toReceive = s.requests.filter((r) => r.status === 'lista').length;
  const toApprove = s.requests.filter((r) => r.status === 'propuesta').length;
  const pending = s.requests.filter((r) => r.status === 'pendiente');
  const reds = pending.filter((r) => r.kind === 'roja').length;
  const stationRole: 'vitrina' | 'freidora' = tab === 'freidora' ? 'freidora' : 'vitrina';
  const syncLabel = remote
    ? { ok: sync.message, saving: 'Guardando…', offline: 'Sin conexión', error: 'Error' }[sync.status]
    : sync.status === 'ok'
      ? 'Solo este equipo'
      : 'Error al guardar';

  return (
    <Act.Provider value={{ userId, act, toast }}>
      <header className={`top${store?.test ? ' test' : ''}`}>
        <div className="brand">
          <span className="wordmark">
            LADELOS<span className="dot">.</span>
          </span>
          <span className="sub">Control de Vitrina · {store?.name ?? s.storeName}</span>
        </div>
        <nav className="tabs" aria-label="Estaciones">
          {allowed.includes('vitrina') && (
            <button className={`tab${tab === 'vitrina' ? ' on' : ''}`} onClick={() => setTab('vitrina')}>
              Vitrina {toReceive + toApprove > 0 && <span className="badge">{toReceive + toApprove}</span>}
            </button>
          )}
          {allowed.includes('freidora') && (
            <button className={`tab${tab === 'freidora' ? ' on' : ''}`} onClick={() => setTab('freidora')}>
              Freidora {pending.length > 0 && <span className={`badge${reds ? ' red' : ''}`}>{pending.length}</span>}
            </button>
          )}
          {allowed.includes('admin') && (
            <button className={`tab${tab === 'admin' ? ' on' : ''}`} onClick={() => setTab('admin')}>
              Administración
            </button>
          )}
        </nav>
        <div className="meta">
          <span className="clock" title="Hora de Puerto Rico">
            {WEEKDAYS[t.weekday].slice(0, 3)} {fmtHM(t.minutes)}
          </span>
          <span className={`sync ${sync.status}`} title={remote ? 'Todos los equipos ven lo mismo. Si dice Sin conexión, lo que toques no se guarda.' : 'Fase 1: los datos se guardan en este equipo y no se comparten con otros equipos.'}>
            {syncLabel}
          </span>
          {!sound ? (
            <button className="btn sm" onClick={() => setSound(enableSound())}>
              Activar sonido
            </button>
          ) : (
            <button className="btn sm ghost" onClick={() => setMute(!mute)} title="Las alertas urgentes de freidora siempre suenan">
              {mute ? 'Solo urgentes' : 'Sonido activo'}
            </button>
          )}
        </div>
      </header>

      {store?.test && <div className="simbar">Tienda de PRUEBA: nada de lo que hagas aquí afecta el inventario real de Bayamón.</div>}
      {offsetMs !== 0 && (
        <div className="simbar">
          Hora simulada: la app cree que son las {fmtHM(t.minutes)} del {WEEKDAYS[t.weekday].toLowerCase()}. Cámbiala en Administración → Pruebas.
        </div>
      )}
      {(sync.status === 'error' || sync.status === 'offline') && <div className="errbar">{sync.message}</div>}

      <main className="main">
        <div className="who">
          {remote ? (
            <>
              {stores.length > 1 && (
                <select id="store-sel" className="input sm wide-sel" value={store?.id} onChange={(e) => switchStore(e.target.value)}>
                  {stores.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              )}
              <span>
                <b>{me?.display_name}</b>
              </span>
              <button className="btn sm ghost" onClick={() => signOut()}>
                Salir
              </button>
            </>
          ) : admin ? (
            <>
              <span>
                Administración: <b>{s.users.find((u) => u.id === admin)?.name}</b>
              </span>
              <button className="btn sm ghost" onClick={() => setAdmin(null)}>
                Salir
              </button>
            </>
          ) : (
            tab !== 'admin' && (
              <>
                <label htmlFor="who-sel">Usando:</label>
                <select
                  id="who-sel"
                  className="input sm"
                  value={station[stationRole]}
                  onChange={(e) => {
                    setStation({ ...station, [stationRole]: e.target.value });
                    writeLS(`ladelos-vitrina:v1:u-${stationRole}`, e.target.value);
                  }}
                >
                  {s.users.filter((u) => u.active && u.role === stationRole).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </>
            )
          )}
        </div>
        {tab === 'vitrina' && <Vitrina s={s} now={now} />}
        {tab === 'freidora' && <Freidora s={s} now={now} />}
        {tab === 'admin' && (remote || admin ? <Admin s={s} now={now} offsetMs={offsetMs} /> : <PinLogin onOk={setAdmin} />)}
      </main>

      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.kind}`}>
            {x.msg}
          </div>
        ))}
      </div>
    </Act.Provider>
  );
}

function PinLogin({ onOk }: { onOk: (id: string) => void }) {
  const { state: s } = useApp();
  const admins = s.users.filter((u) => u.active && u.role === 'admin');
  const [id, setId] = useState(admins[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);
  const go = (e?: FormEvent) => {
    e?.preventDefault();
    const u = admins.find((x) => x.id === id);
    if (u && u.pin === pin) onOk(u.id);
    else setBad(true);
  };
  return (
    <form className="panel login" onSubmit={go}>
      <h3>Administración</h3>
      <div className="row">
        {admins.map((u) => (
          <button type="button" key={u.id} className={`chip${id === u.id ? ' on' : ''}`} onClick={() => setId(u.id)}>
            {u.name}
          </button>
        ))}
      </div>
      <label className="lbl" htmlFor="pin">
        PIN
      </label>
      <input id="pin" className="input pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => { setPin(e.target.value); setBad(false); }} />
      {bad && <p className="bad">PIN incorrecto.</p>}
      <button className="btn primary big" type="submit">
        Entrar
      </button>
      <p className="muted small">PIN inicial de Danny y Soha: 1234. Cámbialo en Usuarios.</p>
    </form>
  );
}
