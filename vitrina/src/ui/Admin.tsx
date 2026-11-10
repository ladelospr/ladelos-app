import { dispatch, flavorStatus, nameOf, type Command } from '../domain/engine';
import { initialState } from '../domain/seed';
import { WEEKDAYS, fmtTimeOf, hm, instantAtPRMinutes, prTime } from '../domain/time';
import type { DaySchedule, Flavor, Role, State, User } from '../domain/types';
import { replenishmentTicket } from '../integrations/freshkds';
import { Empty, KindBadge, Stepper, fname, timeOf, useAct } from './components';
import type { MemberRow, ProfileRow } from './backend';
import { createUser, getState, listMembers, mode, now, replaceState, setMember, setSimulatedTime, useApp } from './store';

const { useState, useRef } = React;

type Tab = 'hoy' | 'inventario' | 'sabores' | 'horario' | 'usuarios' | 'historial' | 'integraciones' | 'pruebas' | 'datos';
const TABS: [Tab, string][] = [
  ['hoy', 'Resumen de hoy'],
  ['inventario', 'Ajustes y excepciones'],
  ['sabores', 'Sabores'],
  ['horario', 'Horario y reglas'],
  ['usuarios', 'Usuarios'],
  ['historial', 'Historial'],
  ['integraciones', 'Clover y Fresh KDS'],
  ['pruebas', 'Pruebas'],
  ['datos', 'Cierre y datos'],
];

export function Admin({ s, now, offsetMs }: { s: State; now: Date; offsetMs: number }) {
  const [tab, setTab] = useState<Tab>('hoy');
  return (
    <div className="view admin">
      <nav className="subtabs" aria-label="Administración">
        {TABS.map(([k, l]) => (
          <button key={k} className={`subtab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </nav>
      <div className="admin-body">
        {tab === 'hoy' && <Today s={s} now={now} />}
        {tab === 'inventario' && <Inventory s={s} now={now} />}
        {tab === 'sabores' && <Flavors s={s} />}
        {tab === 'horario' && <ScheduleTab s={s} />}
        {tab === 'usuarios' && (mode === 'remote' ? <RemoteUsers /> : <Users s={s} />)}
        {tab === 'historial' && <History s={s} />}
        {tab === 'integraciones' && <Integrations s={s} now={now} />}
        {tab === 'pruebas' && <Testing s={s} now={now} offsetMs={offsetMs} />}
        {tab === 'datos' && <DataTab s={s} />}
      </div>
    </div>
  );
}

const isToday = (iso: string | undefined, now: Date) => !!iso && prTime(new Date(iso)).date === prTime(now).date;

function Today({ s, now }: { s: State; now: Date }) {
  const req = s.requests.filter((r) => r.businessDate === prTime(now).date);
  const produced = req.reduce((a, r) => a + (r.qtyProduced ?? 0), 0);
  const received = req.reduce((a, r) => a + r.qtyReceived, 0);
  const diffs = req.filter((r) => r.difference);
  const waste = s.waste.filter((w) => isToday(w.at, now));
  const unmet = s.unmet.filter((u) => isToday(u.at, now));
  const blocks = s.blocks.filter((b) => isToday(b.start, now));
  const subs = s.substitutions.filter((x) => isToday(x.at, now));
  const flags = s.audit.filter((a) => isToday(a.at, now) && (a.action === 'venta_sin_origen' || a.action === 'venta_sin_inventario'));
  const unmetBy: Record<string, number> = {};
  unmet.forEach((u) => (unmetBy[u.flavorId] = (unmetBy[u.flavorId] ?? 0) + 1));
  return (
    <div className="grid2">
      <section className="panel">
        <h3>Producción</h3>
        <div className="facts">
          <div>
            <span className="fact-n">{produced}</span>
            <span>producidos</span>
          </div>
          <div>
            <span className="fact-n">{received}</span>
            <span>recibidos en vitrina</span>
          </div>
          <div>
            <span className="fact-n">{waste.reduce((a, w) => a + w.qty, 0)}</span>
            <span>desperdicio</span>
          </div>
          <div>
            <span className="fact-n">{unmet.length}</span>
            <span>clientes sin su sabor</span>
          </div>
        </div>
      </section>
      <section className="panel">
        <h3>Diferencias en recepción</h3>
        {diffs.length === 0 ? <Empty>Sin diferencias hoy.</Empty> : (
          <ul className="list">
            {diffs.map((r) => (
              <li key={r.id}>
                <span className="fl">{fname(s, r.flavorId)}</span> producidos {r.qtyProduced}, recibidos {r.qtyReceived} <b className="bad">({r.difference})</b> · {nameOf(s, r.closedBy ?? '')} {timeOf(r.closedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h3>Para revisar</h3>
        {flags.length === 0 ? <Empty>Nada raro en las ventas.</Empty> : (
          <ul className="list">
            {flags.map((a) => (
              <li key={a.id}>
                {timeOf(a.at)} · {a.detail}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h3>Clientes que preguntaron por un sabor agotado</h3>
        {Object.keys(unmetBy).length === 0 ? <Empty>Nadie hoy.</Empty> : (
          <ul className="list">
            {Object.entries(unmetBy).sort((a, b) => b[1] - a[1]).map(([id, n]) => (
              <li key={id}>
                <span className="fl">{fname(s, id)}</span> {n}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h3>Bloqueos de hoy</h3>
        {blocks.length === 0 ? <Empty>Ninguno.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Sabor</th><th>Motivo</th><th>Quién</th><th>Desde</th><th>Hasta</th><th>Estado</th></tr></thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id}>
                  <td>{fname(s, b.flavorId)}</td><td>{b.reason}</td><td>{nameOf(s, b.by)}</td><td>{timeOf(b.start)}</td><td>{b.untilClose ? 'Cierre' : timeOf(b.until)}</td><td>{b.active ? 'Activo' : b.endedHow === 'reactivado' ? `Reactivado ${timeOf(b.endedAt)}` : 'Expiró'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="panel">
        <h3>Sustituciones y desperdicio</h3>
        {subs.length + waste.length === 0 ? <Empty>Nada registrado.</Empty> : (
          <ul className="list">
            {subs.map((x) => (
              <li key={x.id}>{timeOf(x.at)} · {fname(s, x.fromFlavorId)} → {x.qty} {fname(s, x.toFlavorId)} ({nameOf(s, x.by)})</li>
            ))}
            {waste.map((w) => (
              <li key={w.id}>{timeOf(w.at)} · Desperdicio {w.qty} {fname(s, w.flavorId)} — {w.reason} ({nameOf(s, w.by)})</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Inventory({ s, now }: { s: State; now: Date }) {
  const { act } = useAct();
  const flavors = s.flavors.filter((f) => f.active && f.vitrinaEligible).sort((a, b) => a.order - b.order);
  const [fid, setFid] = useState(flavors[0]?.id ?? '');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  const [eq, setEq] = useState(4);
  const [ereason, setEreason] = useState('');
  const st = fid ? flavorStatus(s, s.flavors.find((f) => f.id === fid)!, now) : null;
  return (
    <div className="grid2">
      <section className="panel">
        <h3>Ajustar inventario de vitrina</h3>
        <p className="muted">Para corregir un conteo. Queda en el historial con tu nombre y el motivo.</p>
        <select id="adj-flavor" className="input" value={fid} onChange={(e) => { setFid(e.target.value); setQty(s.inventory[e.target.value] ?? 0); }}>
          {flavors.map((f) => <option key={f.id} value={f.id}>{f.name} (hay {s.inventory[f.id] ?? 0})</option>)}
        </select>
        <div className="row"><span className="lbl">Cantidad real</span><Stepper value={qty} onChange={setQty} /></div>
        <input id="adj-reason" className="input" placeholder="Motivo (obligatorio)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn primary" onClick={() => act({ type: 'adjust', flavorId: fid, qty, reason }, 'Inventario ajustado').then((r) => r.ok && setReason(''))}>Guardar ajuste</button>
      </section>
      <section className="panel">
        <h3>Autorizar producción fuera de regla</h3>
        <p className="muted">Pide a freidora aunque haya pasado la hora límite, el sabor esté bloqueado o no esté agotado.</p>
        {st && <p className="muted">{st.flavor.name}: hay {st.available}, en camino {st.committed.total}{!st.window.allowed && ` · ${st.window.reason}`}</p>}
        <div className="row"><span className="lbl">Cantidad</span><Stepper value={eq} onChange={setEq} min={1} /></div>
        <input id="exc-reason" className="input" placeholder="Motivo (obligatorio)" value={ereason} onChange={(e) => setEreason(e.target.value)} />
        <button className="btn warn" onClick={() => act({ type: 'authorizeException', flavorId: fid, qty: eq, reason: ereason }, `Autorizado: ${eq} ${fname(s, fid)}`).then((r) => r.ok && setEreason(''))}>Autorizar {eq} {fname(s, fid)}</button>
      </section>
      <section className="panel full">
        <h3>Solicitudes abiertas</h3>
        <table className="tbl">
          <thead><tr><th>Sabor</th><th>Tipo</th><th>Estado</th><th className="num">Cant.</th><th>Creada</th><th></th></tr></thead>
          <tbody>
            {s.requests.filter((r) => ['propuesta', 'pendiente', 'preparando', 'lista'].includes(r.status)).map((r) => (
              <tr key={r.id}>
                <td>{fname(s, r.flavorId)}</td><td><KindBadge kind={r.kind} /></td><td>{r.status}</td><td className="num">{r.status === 'lista' ? (r.qtyProduced ?? 0) - r.qtyReceived : r.qtyRequested}</td><td>{timeOf(r.createdAt)}</td>
                <td><button className="btn ghost sm" onClick={() => act({ type: 'cancelRequest', requestId: r.id, reason: 'Cancelada por Administración' }, 'Cancelada')}>Cancelar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const targetsText = (f: Flavor) => f.targets.map((t) => `${t.from}=${t.target}`).join(', ');
function parseTargets(txt: string) {
  return txt.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [from, n] = p.split('=').map((x) => x.trim());
    return { from: from.length === 4 ? `0${from}` : from, target: Number(n) };
  });
}

function Flavors({ s }: { s: State }) {
  const list = [...s.flavors].sort((a, b) => Number(b.vitrinaEligible) - Number(a.vitrinaEligible) || a.order - b.order);
  return (
    <section className="panel">
      <h3>Sabores</h3>
      <p className="muted">Objetivo por hora: "05:00=10, 12:00=4" quiere decir 10 desde las 5:00 y 4 desde las 12:00. Los marcados "provisional" todavía usan 2 / 4 de ejemplo.</p>
      <div className="scroll-x">
        <table className="tbl edit">
          <thead><tr><th>Sabor</th><th>Activo</th><th>Vitrina</th><th className="num">Mínimo</th><th>Objetivo por hora</th><th>No reponer después de</th><th>Restringido</th><th>Nombre en Clover</th><th></th></tr></thead>
          <tbody>{list.map((f) => <FlavorRow key={f.id} f={f} />)}</tbody>
        </table>
      </div>
    </section>
  );
}

function FlavorRow({ f }: { f: Flavor }) {
  const { act } = useAct();
  const [d, setD] = useState({ ...f, t: targetsText(f), c: f.cloverNames.join(' | ') });
  const dirty = d.t !== targetsText(f) || d.c !== f.cloverNames.join(' | ') || d.min !== f.min || d.active !== f.active || d.vitrinaEligible !== f.vitrinaEligible || (d.replenishUntil ?? '') !== (f.replenishUntil ?? '') || d.adminRestricted !== f.adminRestricted;
  const save = () => {
    const { t, c, ...rest } = d;
    act({ type: 'updateFlavor', flavor: { ...rest, targets: parseTargets(t), cloverNames: c.split('|').map((x) => x.trim()).filter(Boolean), replenishUntil: rest.replenishUntil || undefined } }, `${f.name} guardado`);
  };
  return (
    <tr className={f.vitrinaEligible ? '' : 'mute'}>
      <td>{f.name} {f.provisional && <span className="tag">provisional</span>}</td>
      <td><input type="checkbox" id={`a-${f.id}`} checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /></td>
      <td><input type="checkbox" id={`v-${f.id}`} checked={d.vitrinaEligible} onChange={(e) => setD({ ...d, vitrinaEligible: e.target.checked })} /></td>
      <td><input className="input sm num" id={`m-${f.id}`} inputMode="numeric" value={d.min} onChange={(e) => setD({ ...d, min: Number(e.target.value.replace(/\D/g, '') || 0) })} /></td>
      <td><input className="input" id={`t-${f.id}`} value={d.t} onChange={(e) => setD({ ...d, t: e.target.value })} /></td>
      <td><input className="input sm" id={`u-${f.id}`} placeholder="—" value={d.replenishUntil ?? ''} onChange={(e) => setD({ ...d, replenishUntil: e.target.value })} /></td>
      <td><input type="checkbox" id={`r-${f.id}`} checked={d.adminRestricted} onChange={(e) => setD({ ...d, adminRestricted: e.target.checked })} /></td>
      <td><input className="input" id={`c-${f.id}`} value={d.c} onChange={(e) => setD({ ...d, c: e.target.value })} /></td>
      <td><button className="btn sm primary" disabled={!dirty} onClick={save}>Guardar</button></td>
    </tr>
  );
}

function ScheduleTab({ s }: { s: State }) {
  const { act } = useAct();
  const [days, setDays] = useState(s.schedule.days.map((d) => (d ? { ...d } : null)));
  const [set, setSet] = useState({ ...s.settings, weights: { ...s.settings.weights } });
  const upd = (i: number, k: keyof DaySchedule, v: string) => setDays(days.map((d, j) => (j === i && d ? { ...d, [k]: v } : d)));
  return (
    <div className="grid2">
      <section className="panel">
        <h3>Horario (hora de Puerto Rico)</h3>
        <table className="tbl edit">
          <thead><tr><th>Día</th><th>Abierto</th><th>Personal</th><th>Apertura</th><th>Cierre</th><th>Límite de reposición</th></tr></thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={i}>
                <td>{WEEKDAYS[i]}</td>
                <td><input type="checkbox" id={`open-${i}`} checked={!!d} onChange={(e) => setDays(days.map((x, j) => (j === i ? (e.target.checked ? { open: '06:00', close: '15:00', staffStart: '05:00', replenishCutoff: '12:30' } : null) : x)))} /></td>
                {d ? (['staffStart', 'open', 'close', 'replenishCutoff'] as const).map((k) => (
                  <td key={k}><input className="input sm" id={`${k}-${i}`} value={d[k]} onChange={(e) => upd(i, k, e.target.value)} /></td>
                )) : <td colSpan={4} className="muted">Cerrado</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn primary" onClick={() => act({ type: 'updateSchedule', schedule: { days } }, 'Horario guardado')}>Guardar horario</button>
      </section>
      <section className="panel">
        <h3>Reglas</h3>
        <label className="check"><input type="checkbox" id="rule-stocked" checked={set.autoOnlyIfStockedToday} onChange={(e) => setSet({ ...set, autoOnlyIfStockedToday: e.target.checked })} /> La reposición automática (roja) solo aplica a sabores que se pusieron en vitrina hoy</label>
        <p className="muted small">Así, al abrir, no se piden automáticamente los 40 sabores que todavía están en cero.</p>
        <div className="row"><span className="lbl">Posponer (min)</span><Stepper value={set.postponeDefaultMin} onChange={(n) => setSet({ ...set, postponeDefaultMin: n })} min={5} /></div>
        <div className="row"><span className="lbl">Ventana de demanda para sugerencias (min)</span><Stepper value={set.demandWindowMin} onChange={(n) => setSet({ ...set, demandWindowMin: n })} min={15} max={120} /></div>
        <div className="row"><span className="lbl">"Cliente preguntó" repetido (seg)</span><Stepper value={set.unmetDedupSeconds} onChange={(n) => setSet({ ...set, unmetDedupSeconds: n })} min={0} /></div>
        <h4>Peso de cada factor en las sugerencias (%)</h4>
        {(['slot', 'weekday', 'today', 'trend', 'unmet'] as const).map((k) => (
          <div className="row" key={k}>
            <span className="lbl">{{ slot: 'Misma franja horaria', weekday: 'Mismo día de la semana', today: 'Ventas de hoy', trend: 'Tendencia reciente', unmet: 'Clientes que preguntaron' }[k]}</span>
            <Stepper value={Math.round(set.weights[k] * 100)} onChange={(n) => setSet({ ...set, weights: { ...set.weights, [k]: n / 100 } })} max={100} />
          </div>
        ))}
        <button className="btn primary" onClick={() => act({ type: 'updateSettings', settings: set }, 'Reglas guardadas')}>Guardar reglas</button>
      </section>
    </div>
  );
}

function Users({ s }: { s: State }) {
  const { act } = useAct();
  const [n, setN] = useState({ name: '', role: 'vitrina' as Role, pin: '' });
  return (
    <section className="panel">
      <h3>Usuarios</h3>
      <p className="muted">En esta fase el PIN solo separa la pantalla de Administración en este equipo. No es seguridad real: eso llega con la base de datos central (Fase 2).</p>
      <table className="tbl edit">
        <thead><tr><th>Nombre</th><th>Rol</th><th>PIN</th><th>Activo</th><th></th></tr></thead>
        <tbody>{s.users.map((u) => <UserRow key={u.id} u={u} />)}</tbody>
      </table>
      <h4>Añadir</h4>
      <div className="row">
        <input className="input" id="nu-name" placeholder="Nombre" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <select className="input" id="nu-role" value={n.role} onChange={(e) => setN({ ...n, role: e.target.value as Role })}>
          <option value="vitrina">Vitrina</option><option value="freidora">Freidora</option><option value="admin">Administración</option>
        </select>
        <input className="input sm" id="nu-pin" placeholder="PIN" inputMode="numeric" value={n.pin} onChange={(e) => setN({ ...n, pin: e.target.value })} />
        <button className="btn primary" onClick={() => act({ type: 'updateUser', user: { id: `u${Date.now()}`, ...n, active: true } }, `${n.name} añadido`).then((r) => r.ok && setN({ name: '', role: 'vitrina', pin: '' }))}>Añadir</button>
      </div>
    </section>
  );
}

function UserRow({ u }: { u: User }) {
  const { act } = useAct();
  const [d, setD] = useState(u);
  return (
    <tr>
      <td><input className="input" id={`un-${u.id}`} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></td>
      <td>{{ vitrina: 'Vitrina', freidora: 'Freidora', ambos: 'Vitrina y freidora', admin: 'Administración' }[u.role]}</td>
      <td><input className="input sm" id={`up-${u.id}`} inputMode="numeric" value={d.pin} onChange={(e) => setD({ ...d, pin: e.target.value })} /></td>
      <td><input type="checkbox" id={`ua-${u.id}`} checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /></td>
      <td><button className="btn sm" onClick={() => act({ type: 'updateUser', user: d }, 'Guardado')}>Guardar</button></td>
    </tr>
  );
}

function History({ s }: { s: State }) {
  const [f, setF] = useState('');
  const [kind, setKind] = useState<'mov' | 'audit'>('mov');
  const mov = s.movements.filter((m) => !f || m.flavorId === f).slice(-300).reverse();
  const aud = s.audit.filter((a) => !f || a.flavorId === f).slice(-300).reverse();
  const TYPE: Record<string, string> = { venta: 'Venta vitrina', reverso_venta: 'Venta eliminada', recepcion: 'Recepción', desperdicio: 'Desperdicio', ajuste: 'Ajuste', cierre_dia: 'Cierre' };
  return (
    <section className="panel">
      <div className="row">
        <select className="input" id="h-flavor" value={f} onChange={(e) => setF(e.target.value)}>
          <option value="">Todos los sabores</option>
          {s.flavors.filter((x) => x.vitrinaEligible).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <button className={`chip${kind === 'mov' ? ' on' : ''}`} onClick={() => setKind('mov')}>Movimientos de inventario</button>
        <button className={`chip${kind === 'audit' ? ' on' : ''}`} onClick={() => setKind('audit')}>Todas las acciones</button>
      </div>
      <div className="scroll-x">
        {kind === 'mov' ? (
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Hora</th><th>Sabor</th><th>Movimiento</th><th className="num">Cambio</th><th className="num">Antes</th><th className="num">Después</th><th>Quién</th><th>Origen</th><th>Motivo</th></tr></thead>
            <tbody>
              {mov.map((m) => (
                <tr key={m.id}><td>{prTime(new Date(m.at)).date}</td><td>{fmtTimeOf(m.at)}</td><td>{fname(s, m.flavorId)}</td><td>{TYPE[m.type]}</td><td className={`num ${m.delta < 0 ? 'bad' : 'good'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td><td className="num">{m.before}</td><td className="num">{m.after}</td><td>{nameOf(s, m.by)}</td><td>{m.source}</td><td>{m.reason ?? ''}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Hora</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead>
            <tbody>
              {aud.map((a) => (
                <tr key={a.id}><td>{prTime(new Date(a.at)).date}</td><td>{fmtTimeOf(a.at)}</td><td>{nameOf(s, a.by)}</td><td>{a.action.replace(/_/g, ' ')}</td><td>{a.detail}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Integrations({ s, now }: { s: State; now: Date }) {
  const pending = s.requests.filter((r) => r.status === 'pendiente');
  return (
    <div className="grid2">
      <section className="panel">
        <h3>Clover <span className="pill off">No conectado · Fase 3</span></h3>
        <p>Por ahora las ventas se prueban con el simulador (pestaña Pruebas). Lo que ya está listo en Clover y en la app:</p>
        <ul className="list plain">
          <li>En Clover Bayamón y Cataño, el grupo <b>Despacho</b> es obligatorio en los 49 pastelillos: <b>VITRINA - NO HACER</b> o <b>AL MOMENTO – COCINA</b>.</li>
          <li>La app ya sabe leer una orden de Clover: cada línea con VITRINA descuenta 1; AL MOMENTO no descuenta; una línea borrada devuelve; un reembolso no devuelve; un evento repetido no descuenta dos veces.</li>
        </ul>
        <p className="muted">Para conectarlo de verdad hace falta: una app de Clover (cuenta de desarrollador), permiso de leer órdenes, un servidor con dirección pública para el webhook (Clover solo envía el número de la orden; los detalles se buscan por la API) y una revisión diaria para recuperar órdenes que no llegaron. Antes de usarlo hay que confirmar con órdenes reales cómo Clover registra cantidades mayores de 1.</p>
      </section>
      <section className="panel">
        <h3>Fresh KDS <span className="pill off">No conectado · Fase 4</span></h3>
        <p>Fresh KDS tiene una API para integradores que permite enviar órdenes a las pantallas y avisa cuando una orden se marca como hecha. Requiere que Fresh apruebe el acceso (partnerships@freshtechnology.com).</p>
        <p className="muted">El tipo de orden solo puede ser For Here, ToGo, Pickup, DriveThru, Delivery o Curbside, y no hay color propio documentado. El ticket se distingue por su nombre y una nota. Así se vería hoy:</p>
        <pre className="code">{JSON.stringify(replenishmentTicket(s, pending, now), null, 2)}</pre>
        <p className="muted">Pantalla dividida en la TCL NXTPAPER 14: no está verificado que Fresh KDS siga sonando y actualizando en pantalla dividida. Hay que probarlo en la tablet.</p>
      </section>
    </div>
  );
}

let simSeq = 0;
function Testing({ s, now, offsetMs }: { s: State; now: Date; offsetMs: number }) {
  const { act, toast } = useAct();
  const { store } = useApp();
  const allowed = mode === 'local' || !!store?.test;
  const flavors = s.flavors.filter((f) => f.active).sort((a, b) => Number(b.vitrinaEligible) - Number(a.vitrinaEligible) || a.order - b.order);
  const [fid, setFid] = useState('carne');
  const [origin, setOrigin] = useState<'VITRINA' | 'AL_MOMENTO'>('VITRINA');
  const [qty, setQty] = useState(1);
  const [time, setTime] = useState('07:00');
  const [busy, setBusy] = useState(false);
  const last = useRef<Extract<Command, { type: 'saleLine' }> | null>(null);

  if (!allowed)
    return (
      <section className="panel">
        <h3>Pruebas</h3>
        <p>El simulador de ventas, la hora simulada y el escenario de prueba solo funcionan en la tienda de <b>PRUEBA</b>, para no tocar el inventario real.</p>
        <p className="muted">Cámbiate a "Bayamón · PRUEBA" en el selector de tienda, arriba a la derecha.</p>
      </section>
    );

  const sell = async () => {
    const ts = Date.now();
    let ok = 0;
    for (let i = 0; i < qty; i++) {
      const id = `sim-${ts}-${++simSeq}`;
      const cmd: Extract<Command, { type: 'saleLine' }> = { type: 'saleLine', eventId: id, lineId: id, orderId: `sim-${ts}`, flavorId: fid, qty: 1, origin, status: 'activa', source: 'simulador' };
      if ((await act(cmd)).ok) ok++;
      last.current = cmd;
    }
    toast(`Venta simulada: ${ok} ${fname(s, fid)} ${origin === 'VITRINA' ? 'de vitrina' : 'al momento'}`, 'ok');
  };
  const setTime2 = async (d: Date | null) => {
    const r = await setSimulatedTime(d);
    if (!r.ok) toast(r.error, 'error');
  };

  return (
    <div className="grid2">
      <section className="panel">
        <h3>Simular venta de Clover</h3>
        <select className="input" id="sim-flavor" value={fid} onChange={(e) => setFid(e.target.value)}>
          {flavors.map((f) => <option key={f.id} value={f.id}>{f.name} {f.vitrinaEligible ? `(hay ${s.inventory[f.id] ?? 0})` : '(al momento)'}</option>)}
        </select>
        <div className="row">
          <button className={`chip${origin === 'VITRINA' ? ' on' : ''}`} onClick={() => setOrigin('VITRINA')}>VITRINA - NO HACER</button>
          <button className={`chip${origin === 'AL_MOMENTO' ? ' on' : ''}`} onClick={() => setOrigin('AL_MOMENTO')}>AL MOMENTO – COCINA</button>
        </div>
        <div className="row"><span className="lbl">Líneas</span><Stepper value={qty} onChange={setQty} min={1} max={24} /></div>
        <div className="row">
          <button className="btn primary" onClick={sell}>Registrar venta</button>
          <button className="btn" disabled={!last.current} onClick={() => act(last.current!, 'Procesado')}>Reenviar el último evento</button>
          <button className="btn" disabled={!last.current} onClick={() => { const c = last.current!; act({ ...c, eventId: `${c.eventId}-del`, status: 'eliminada' }, 'Línea eliminada: regresa a vitrina'); }}>Quitar la última línea</button>
        </div>
        <p className="muted small">"Reenviar" prueba que un evento repetido de Clover no descuente dos veces.</p>
      </section>

      <section className="panel">
        <h3>Hora simulada</h3>
        <p className="muted">Para probar las reglas de horario fuera de horas. {mode === 'remote' ? 'Aplica a todos los equipos en la tienda de prueba.' : 'Afecta solo este equipo.'}</p>
        {offsetMs !== 0 && <p className="sim">Ahora la app cree que son las {fmtTimeOf(now.toISOString())} del {WEEKDAYS[prTime(now).weekday].toLowerCase()} {prTime(now).date}.</p>}
        <div className="row">
          {['06:00', '07:00', '09:30', '12:15', '12:45', '13:45'].map((t) => (
            <button key={t} className="chip" onClick={() => setTime2(instantAtPRMinutes(new Date(), hm(t)))}>Hoy {fmtTimeOf(instantAtPRMinutes(new Date(), hm(t)).toISOString())}</button>
          ))}
        </div>
        <div className="row">
          <input className="input sm" id="sim-time" value={time} onChange={(e) => setTime(e.target.value)} />
          <button className="btn" onClick={() => /^\d{1,2}:\d{2}$/.test(time) && setTime2(instantAtPRMinutes(new Date(), hm(time)))}>Usar esta hora</button>
          <button className="btn ghost" disabled={offsetMs === 0} onClick={() => setTime2(null)}>Volver a la hora real</button>
        </div>
        <p className="muted small">La hora simulada sigue corriendo como un reloj normal.</p>
      </section>

      <section className="panel full">
        <h3>Escenario de prueba</h3>
        <p className="muted">Borra la tienda de prueba y carga un día de ejemplo: 4 semanas de ventas inventadas (marcadas como simuladas) y producción inicial de 8 sabores lista para recibir. Pone la hora simulada en 7:00 a. m. Las sugerencias que salgan con estos datos no reflejan las ventas reales de Ladelos.</p>
        <button className="btn warn" disabled={busy} onClick={async () => { setBusy(true); const r = await loadDemo(); setBusy(false); toast(r.ok ? 'Escenario de prueba cargado' : r.error, r.ok ? 'ok' : 'error'); }}>{busy ? 'Cargando…' : 'Cargar escenario de prueba'}</button>
      </section>
    </div>
  );
}

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

async function loadDemo() {
  const real = new Date(now().getTime());
  let base = real;
  if (prTime(real).weekday === 0) base = new Date(real.getTime() + 86400000); // domingo cerrado → lunes
  const at7 = instantAtPRMinutes(base, 7 * 60);
  let s = initialState();
  s.users = getState().users;
  const freidora = s.users.find((u) => u.role === 'freidora' || u.role === 'ambos' || u.role === 'admin')?.id ?? 'freidora';
  const rand = rng(42);
  const pop: Record<string, number> = { carne: 3, pollo: 3, 'pollo-queso-americano': 1.6, 'pollo-queso-mozzarella': 1.2, 'jamon-queso': 1.4, pizza: 1.5, revoltillo: 1.3, 'carne-queso-americano': 1.1, tripleta: 0.8, 'pizza-pepperoni': 0.9, cubano: 0.6 };
  const hourly = [0, 0, 0, 0, 0, 0, 1.2, 1.6, 1.4, 1.0, 0.8, 1.2, 1.3, 0.7, 0.4]; // 0..14 h
  for (let d = 1; d <= 28; d++) {
    const day = new Date(at7.getTime() - d * 86400000);
    const t = prTime(day);
    if (t.weekday === 0) continue;
    for (const [fid, p] of Object.entries(pop)) {
      for (let h = 6; h < 15; h++) {
        if (fid === 'revoltillo' && h >= 10) continue;
        const lambda = p * hourly[h] * (t.weekday === 6 ? 1.3 : 1);
        const L = Math.exp(-lambda);
        let k = 0, q = 1;
        do { k++; q *= rand(); } while (q > L);
        for (let i = 0; i < k - 1; i++) {
          const m = h * 60 + Math.floor(rand() * 4) * 15;
          s.saleLog.push({ at: instantAtPRMinutes(day, m).toISOString(), flavorId: fid, qty: 1, origin: rand() < 0.75 ? 'VITRINA' : 'AL_MOMENTO', source: 'demo' });
        }
      }
    }
  }
  s.saleLog.sort((a, b) => a.at.localeCompare(b.at));
  const items = [['carne', 12], ['pollo', 10], ['pollo-queso-americano', 8], ['jamon-queso', 6], ['pizza', 6], ['revoltillo', 6], ['carne-queso-americano', 4], ['tripleta', 4]] as const;
  // la producción inicial la registró freidora a las 6:40
  s = applyAs(s, { type: 'initialProduction', items: items.map(([flavorId, qty]) => ({ flavorId, qty })) }, freidora, new Date(at7.getTime() - 20 * 60000));
  const r = await replaceState(s);
  if (!r.ok) return r;
  return setSimulatedTime(at7);
}

function applyAs(st: State, cmd: Command, userId: string, when: Date): State {
  const r = dispatch(st, cmd, { now: when, userId });
  return r.result.ok ? r.state : st;
}

function DataTab({ s }: { s: State }) {
  const { act, toast } = useAct();
  const { store } = useApp();
  const remote = mode === 'remote';
  const realStore = remote && !store?.test;
  const [txt, setTxt] = useState('');
  const [confirmTxt, setConfirmTxt] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const exportTxt = () => JSON.stringify(s);
  const restore = async () => {
    let v: State;
    try {
      v = JSON.parse(txt);
      if (v.schema !== 1) throw new Error();
    } catch {
      return toast('Ese texto no es una copia válida de la app', 'error');
    }
    const r = await replaceState(v, confirmTxt);
    toast(r.ok ? 'Datos restaurados' : r.error, r.ok ? 'ok' : 'error');
  };
  return (
    <div className="grid2">
      <section className="panel">
        <h3>Cierre del día</h3>
        <p className="muted">Cancela solicitudes que no se empezaron, quita bloqueos y deja la vitrina lista para mañana.</p>
        <div className="row">
          <button className="btn warn" onClick={() => act({ type: 'closeDay', leftover: 'desperdicio' }, 'Día cerrado. Sobrantes registrados como desperdicio.')}>Cerrar día: sobrantes a desperdicio</button>
          <button className="btn" onClick={() => act({ type: 'closeDay', leftover: 'conservar' }, 'Día cerrado. Sobrantes conservados.')}>Cerrar día: conservar sobrantes</button>
        </div>
      </section>
      <section className="panel">
        <h3>Copia de seguridad</h3>
        <p className="muted">{remote ? 'Los datos están en la base de datos de Ladelos y el historial completo también. Esto copia el estado actual de la tienda.' : 'Los datos viven en este equipo. Copia este texto y guárdalo para no perderlo, o para pasarlo a otro equipo.'}</p>
        <div className="row">
          <button className="btn" onClick={() => { navigator.clipboard.writeText(exportTxt()).then(() => toast('Copiado', 'ok'), () => { setTxt(exportTxt()); toast('Selecciona y copia el texto de abajo', 'info'); }); }}>Copiar datos</button>
          <button className="btn" onClick={() => setTxt(exportTxt())}>Mostrar datos</button>
        </div>
        <textarea className="input code" id="data-txt" rows={6} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Pega aquí una copia para restaurarla" />
        {realStore && <input className="input" id="data-confirm" placeholder="Escribe REEMPLAZAR para restaurar la tienda real" value={confirmTxt} onChange={(e) => setConfirmTxt(e.target.value)} />}
        <button className="btn warn" disabled={!txt || (realStore && confirmTxt !== 'REEMPLAZAR')} onClick={restore}>Restaurar desde el texto</button>
      </section>
      {!realStore && (
        <section className="panel">
          <h3>Empezar de cero</h3>
          {!confirmReset ? <button className="btn danger" onClick={() => setConfirmReset(true)}>Borrar todos los datos {remote ? 'de la tienda de prueba' : 'de este equipo'}</button> : (
            <div className="row">
              <span>Esto borra inventario, historial y configuración {remote ? 'de la tienda de prueba' : 'en este equipo'}.</span>
              <button className="btn danger" onClick={async () => { const st = initialState(); st.users = s.users; await replaceState(st); await setSimulatedTime(null); setConfirmReset(false); toast('Datos borrados', 'ok'); }}>Sí, borrar</button>
              <button className="btn ghost" onClick={() => setConfirmReset(false)}>No</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function RemoteUsers() {
  const { toast } = useAct();
  const { me } = useApp();
  const [data, setData] = useState<{ members: MemberRow[]; profiles: ProfileRow[] } | null>(null);
  const [n, setN] = useState({ name: '', email: '', pw: '', role: 'ambos' });
  const reload = async () => {
    const r = await listMembers();
    if ('error' in r) toast(r.error, 'error');
    else setData(r);
  };
  React.useEffect(() => { void reload(); }, []);
  if (!data) return <section className="panel"><p className="muted">Cargando usuarios…</p></section>;
  const byId = new Map(data.members.map((m) => [m.user_id, m]));
  const set = async (userId: string, role: string, name: string) => {
    const r = await setMember(userId, role === 'none' ? null : role, name);
    toast(r.ok ? 'Guardado' : r.error, r.ok ? 'ok' : 'error');
    if (r.ok) void reload();
  };
  return (
    <div className="grid2">
      <section className="panel full">
        <h3>Quién puede usar Control de Vitrina en esta tienda</h3>
        <p className="muted">Son las mismas cuentas de ladelos-app. Escoge qué ve cada una: Vitrina, Freidora, las dos (para una tablet compartida) o Administración.</p>
        <div className="scroll-x">
          <table className="tbl">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol en ladelos-app</th><th>Acceso a Control de Vitrina</th></tr></thead>
            <tbody>
              {data.profiles.map((p) => {
                const m = byId.get(p.id);
                return (
                  <tr key={p.id}>
                    <td>{m?.display_name ?? p.nombre ?? '—'}</td>
                    <td>{p.email ?? ''}</td>
                    <td>{p.rol ?? ''}</td>
                    <td>
                      <select className="input" id={`m-${p.id}`} value={m?.role ?? 'none'} disabled={p.id === me?.user_id} onChange={(e) => set(p.id, e.target.value, m?.display_name ?? p.nombre ?? p.email ?? 'Sin nombre')}>
                        <option value="none">Sin acceso</option>
                        <option value="vitrina">Vitrina</option>
                        <option value="freidora">Freidora</option>
                        <option value="ambos">Vitrina y freidora</option>
                        <option value="admin">Administración</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h3>Crear una cuenta para un equipo</h3>
        <p className="muted">Por ejemplo, una cuenta para la tablet de la cocina. Escribe tú la contraseña; la vas a necesitar para entrar en ese equipo.</p>
        <input className="input" id="nu-name" placeholder="Nombre (ej. Tablet cocina Bayamón)" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <input className="input" id="nu-email" type="email" placeholder="Correo (ej. tablet.bayamon@ladelos...)" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
        <input className="input" id="nu-pw" type="password" autoComplete="new-password" placeholder="Contraseña (mínimo 8)" value={n.pw} onChange={(e) => setN({ ...n, pw: e.target.value })} />
        <select className="input" id="nu-role" value={n.role} onChange={(e) => setN({ ...n, role: e.target.value })}>
          <option value="vitrina">Vitrina</option><option value="freidora">Freidora</option><option value="ambos">Vitrina y freidora</option><option value="admin">Administración</option>
        </select>
        <button className="btn primary" onClick={async () => { const r = await createUser(n.email, n.pw, n.name, n.role); toast(r.ok ? `Cuenta creada: ${n.name}` : r.error, r.ok ? 'ok' : 'error'); if (r.ok) { setN({ name: '', email: '', pw: '', role: 'ambos' }); void reload(); } }}>Crear cuenta</button>
        <p className="muted small">La cuenta también podrá entrar a ladelos-app con el rol básico (cocina). Cámbialo en la Configuración de ladelos-app si hace falta.</p>
      </section>
    </div>
  );
}
