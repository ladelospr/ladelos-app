import { flavorStatus, type FlavorStatus } from '../domain/engine';
import type { ReplenishRequest, State } from '../domain/types';
import { prTime } from '../domain/time';
import { Chips, Empty, KindBadge, LIGHT, Sheet, Stepper, fname, timeOf, useAct } from './components';

const { useState } = React;

const WASTE_REASONS = ['Quemado', 'Se cayó', 'Mucho tiempo en vitrina', 'Calidad'];
const BLOCK_REASONS = ['No hay masa / relleno', 'Ya no se vende a esta hora', 'Freidora ocupada', 'Otro'];

export function Vitrina({ s, now }: { s: State; now: Date }) {
  const { act } = useAct();
  const [sheet, setSheet] = useState<
    | { t: 'flavor'; id: string }
    | { t: 'receive'; req: ReplenishRequest }
    | { t: 'sub'; fromId: string }
    | null
  >(null);
  const [showOthers, setShowOthers] = useState(false);

  const statuses = s.flavors
    .filter((f) => f.active && f.vitrinaEligible)
    .sort((a, b) => a.order - b.order)
    .map((f) => flavorStatus(s, f, now));
  const inPlay = statuses.filter((x) => x.stockedToday || x.available > 0 || x.committed.total > 0 || x.proposal);
  const others = statuses.filter((x) => !inPlay.includes(x));
  const toReceive = s.requests.filter((r) => r.status === 'lista');
  const proposals = s.requests.filter((r) => r.status === 'propuesta');
  const inTransit = s.requests.filter((r) => r.status === 'pendiente' || r.status === 'preparando');

  return (
    <div className="view">
      <div className="cols">
        <div className="col-main">
          {toReceive.length > 0 && (
            <section className="panel attn-blue">
              <h3>
                Recibir de freidora <span className="count">{toReceive.length}</span>
              </h3>
              <div className="cards">
                {toReceive.map((r) => {
                  const left = (r.qtyProduced ?? 0) - r.qtyReceived;
                  return (
                    <div className="card" key={r.id}>
                      <div className="card-top">
                        <strong className="fl">{fname(s, r.flavorId)}</strong>
                        <KindBadge kind={r.kind} />
                      </div>
                      <p className="muted">
                        Freidora dice: {left} {r.qtyReceived > 0 ? `(faltan de ${r.qtyProduced})` : ''} · {timeOf(r.readyAt)}
                      </p>
                      <div className="row">
                        <button className="btn primary big" onClick={() => act({ type: 'receive', requestId: r.id, qty: left, close: true }, `Recibiste ${left} ${fname(s, r.flavorId)}`)}>
                          ✓ Recibí {left}
                        </button>
                        <button className="btn" onClick={() => setSheet({ t: 'receive', req: r })}>
                          Otra cantidad
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {proposals.length > 0 && (
            <section className="panel attn-yellow">
              <h3>
                Aprobar reposición <span className="count">{proposals.length}</span>
              </h3>
              <div className="cards">
                {proposals.map((r) => (
                  <Proposal key={r.id} s={s} r={r} onSub={() => setSheet({ t: 'sub', fromId: r.flavorId })} />
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <h3>En vitrina hoy</h3>
              <span className="legend">
                <span className="lg verde">✓ Bien</span>
                <span className="lg amarillo">! Bajo</span>
                <span className="lg rojo">× Agotado</span>
              </span>
            </div>
            {inPlay.length === 0 ? (
              <Empty>Todavía no se ha recibido producción hoy. Cuando freidora marque la producción inicial como lista, aparecerá arriba para recibirla.</Empty>
            ) : (
              <div className="tiles">
                {inPlay.map((x) => (
                  <Tile key={x.flavor.id} x={x} onClick={() => setSheet({ t: 'flavor', id: x.flavor.id })} />
                ))}
              </div>
            )}
            <button className="btn ghost wide" onClick={() => setShowOthers(!showOthers)}>
              {showOthers ? 'Ocultar' : 'Ver'} sabores que no se han puesto hoy ({others.length})
            </button>
            {showOthers && (
              <div className="tiles small">
                {others.map((x) => (
                  <Tile key={x.flavor.id} x={x} onClick={() => setSheet({ t: 'flavor', id: x.flavor.id })} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="col-side">
          <section className="panel">
            <h3>En camino desde freidora</h3>
            {inTransit.length === 0 ? (
              <Empty>Nada pendiente.</Empty>
            ) : (
              <ul className="list">
                {inTransit.map((r) => (
                  <li key={r.id}>
                    <span className="fl">
                      {r.qtyRequested} {fname(s, r.flavorId)}
                    </span>
                    <span className={`st st-${r.status}`}>{r.status === 'pendiente' ? 'Pendiente' : 'Preparando'}</span>
                    <KindBadge kind={r.kind} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {sheet?.t === 'flavor' && <FlavorSheet s={s} now={now} id={sheet.id} onClose={() => setSheet(null)} onSub={() => setSheet({ t: 'sub', fromId: sheet.id })} />}
      {sheet?.t === 'receive' && <ReceiveSheet s={s} r={sheet.req} onClose={() => setSheet(null)} />}
      {sheet?.t === 'sub' && <SubstituteSheet s={s} now={now} fromId={sheet.fromId} onClose={() => setSheet(null)} />}
    </div>
  );
}

function Tile({ x, onClick }: { x: FlavorStatus; onClick: () => void }) {
  const L = LIGHT[x.light];
  return (
    <button className={`tile ${x.light}${!x.stockedToday && x.available === 0 ? ' dim' : ''}`} onClick={onClick}>
      <span className="tile-name">{x.flavor.name}</span>
      <span className="tile-num">{x.available}</span>
      <span className="tile-state">
        <b aria-hidden="true">{L.icon}</b> {L.label}
      </span>
      <span className="tile-tags">
        {x.block && <span className="tag lock">No reponer · {timeOf(x.block.until)}</span>}
        {x.postponedUntil && <span className="tag">Pospuesto · {timeOf(x.postponedUntil)}</span>}
        {x.committed.total > 0 && <span className="tag go">En camino {x.committed.total}</span>}
      </span>
    </button>
  );
}

function Proposal({ s, r, onSub }: { s: State; r: ReplenishRequest; onSub: () => void }) {
  const { act } = useAct();
  const [qty, setQty] = useState(r.qtyRequested);
  const avail = s.inventory[r.flavorId] ?? 0;
  return (
    <div className="card">
      <div className="card-top">
        <strong className="fl">{fname(s, r.flavorId)}</strong>
        <span className="pill amarillo">! Quedan {avail}</span>
      </div>
      <div className="row">
        <span className="muted">Pedir</span>
        <Stepper value={qty} onChange={setQty} min={1} />
        <button className="btn warn big" onClick={() => act({ type: 'approve', requestId: r.id, qty, expectedVersion: r.version }, `Enviado a freidora: ${qty} ${fname(s, r.flavorId)}`)}>
          Aprobar
        </button>
      </div>
      <div className="row">
        <button className="btn" onClick={() => act({ type: 'postpone', flavorId: r.flavorId, minutes: s.settings.postponeDefaultMin }, `Pospuesto ${s.settings.postponeDefaultMin} min`)}>
          Posponer {s.settings.postponeDefaultMin} min
        </button>
        <button className="btn" onClick={() => act({ type: 'block', flavorId: r.flavorId, minutes: null, reason: 'Desde aprobación' }, 'No se repondrá hasta el cierre')}>
          No reponer
        </button>
        <button className="btn" onClick={onSub}>
          Sustituir
        </button>
      </div>
    </div>
  );
}

function FlavorSheet({ s, now, id, onClose, onSub }: { s: State; now: Date; id: string; onClose: () => void; onSub: () => void }) {
  const { act, toast } = useAct();
  const x = flavorStatus(s, s.flavors.find((f) => f.id === id)!, now);
  const [mode, setMode] = useState<'main' | 'waste' | 'block'>('main');
  const [wq, setWq] = useState(1);
  const [reason, setReason] = useState('');
  const asked = s.unmet.filter((u) => u.flavorId === id && prTime(new Date(u.at)).date === prTime(now).date).length;

  const ask = async () => {
    const r = await act({ type: 'unmet', flavorId: id });
    if (r.ok) toast(`Anotado: un cliente preguntó por ${x.flavor.name}`, 'ok');
    else if (r.code === 'duplicate') {
      toast(`${r.error} Toca "Fue otro cliente" si es así.`, 'info');
    }
  };

  return (
    <Sheet title={x.flavor.name} onClose={onClose}>
      <div className="facts">
        <div>
          <span className="fact-n">{x.available}</span>
          <span>en vitrina</span>
        </div>
        <div>
          <span className="fact-n">{x.committed.pending}</span>
          <span>pendiente</span>
        </div>
        <div>
          <span className="fact-n">{x.committed.preparing}</span>
          <span>preparando</span>
        </div>
        <div>
          <span className="fact-n">{x.committed.ready}</span>
          <span>listo sin recibir</span>
        </div>
      </div>
      <p className="muted">
        Mínimo {x.flavor.min} · objetivo ahora {x.target}
        {!x.window.allowed && ` · ${x.window.reason}`}
        {x.block && ` · No reponer hasta ${timeOf(x.block.until)} (${x.block.reason})`}
      </p>

      {mode === 'main' && (
        <div className="actions">
          {x.available === 0 && (
            <div className="row">
              <button className="btn primary big" onClick={ask}>
                Cliente preguntó por este sabor
              </button>
              <button className="btn" onClick={() => act({ type: 'unmet', flavorId: id, confirmDuplicate: true }, 'Anotado otro cliente')}>
                Fue otro cliente
              </button>
              {asked > 0 && <span className="muted">{asked} hoy</span>}
            </div>
          )}
          <div className="row">
            {x.available > 0 && (
              <button className="btn" onClick={() => setMode('waste')}>
                Registrar desperdicio
              </button>
            )}
            {x.block || x.postponedUntil ? (
              <button className="btn primary" onClick={() => act({ type: 'reactivate', flavorId: id })}>
                Reactivar reposición
              </button>
            ) : (
              <button className="btn" onClick={() => setMode('block')}>
                No reponer
              </button>
            )}
            <button className="btn" onClick={onSub}>
              Sustituir por otro sabor
            </button>
          </div>
        </div>
      )}

      {mode === 'waste' && (
        <div className="actions">
          <label className="lbl">¿Cuántos?</label>
          <Stepper value={wq} onChange={setWq} min={1} max={x.available} />
          <label className="lbl">Motivo</label>
          <Chips options={WASTE_REASONS} value={reason} onChange={setReason} />
          <div className="row">
            <button
              className="btn danger big"
              disabled={!reason}
              onClick={() => {
                act({ type: 'waste', flavorId: id, qty: wq, reason }, `Desperdicio: ${wq} ${x.flavor.name}`).then((r) => r.ok && setMode('main'));
              }}
            >
              Sacar {wq} de vitrina
            </button>
            <button className="btn ghost" onClick={() => setMode('main')}>
              Volver
            </button>
          </div>
        </div>
      )}

      {mode === 'block' && (
        <div className="actions">
          <label className="lbl">Motivo</label>
          <Chips options={BLOCK_REASONS} value={reason} onChange={setReason} />
          <label className="lbl">¿Por cuánto tiempo?</label>
          <div className="row">
            {[15, 30, 60].map((m) => (
              <button key={m} className="btn" disabled={!reason} onClick={() => act({ type: 'block', flavorId: id, minutes: m, reason }, `No reponer ${x.flavor.name} por ${m} min`).then((r) => r.ok && setMode('main'))}>
                {m} min
              </button>
            ))}
            <button className="btn" disabled={!reason} onClick={() => act({ type: 'block', flavorId: id, minutes: null, reason }, `No reponer ${x.flavor.name} hasta el cierre`).then((r) => r.ok && setMode('main'))}>
              Hasta el cierre
            </button>
          </div>
          <button className="btn ghost" onClick={() => setMode('main')}>
            Volver
          </button>
        </div>
      )}
    </Sheet>
  );
}

function ReceiveSheet({ s, r, onClose }: { s: State; r: ReplenishRequest; onClose: () => void }) {
  const { act } = useAct();
  const left = (r.qtyProduced ?? 0) - r.qtyReceived;
  const [q, setQ] = useState(left);
  const go = (close: boolean) => {
    act({ type: 'receive', requestId: r.id, qty: q, close }, `Recibiste ${q} ${fname(s, r.flavorId)}`).then((res) => res.ok && onClose());
  };
  return (
    <Sheet title={`Recibir ${fname(s, r.flavorId)}`} onClose={onClose}>
      <p>
        Freidora indicó <b>{left}</b>. ¿Cuántos recibiste físicamente?
      </p>
      <Stepper value={q} onChange={setQ} min={0} max={left} />
      <div className="actions">
        <button className="btn primary big" onClick={() => go(true)}>
          Recibí {q} y cierro {q < left ? `(faltan ${left - q})` : ''}
        </button>
        {q < left && q > 0 && (
          <button className="btn" onClick={() => go(false)}>
            Recibí {q}; el resto viene después
          </button>
        )}
      </div>
      {q < left && <p className="muted">Si cierras, la diferencia de {left - q} queda registrada.</p>}
    </Sheet>
  );
}

function SubstituteSheet({ s, now, fromId, onClose }: { s: State; now: Date; fromId: string; onClose: () => void }) {
  const { act } = useAct();
  const [to, setTo] = useState('');
  const [qty, setQty] = useState(4);
  const [how, setHow] = useState<'bloquear' | 'posponer'>('bloquear');
  const options = s.flavors.filter((f) => f.active && f.vitrinaEligible && f.id !== fromId).sort((a, b) => a.order - b.order);
  return (
    <Sheet title={`Sustituir ${fname(s, fromId)}`} onClose={onClose} wide>
      <label className="lbl">¿Qué sabor se prepara en su lugar?</label>
      <div className="pick">
        {options.map((f) => {
          const st = flavorStatus(s, f, now);
          return (
            <button key={f.id} className={`pick-i ${st.light}${to === f.id ? ' on' : ''}`} onClick={() => setTo(f.id)} disabled={!st.window.allowed || !!st.block}>
              {f.name} <small>{st.available}</small>
            </button>
          );
        })}
      </div>
      <div className="row">
        <span className="lbl">Cantidad</span>
        <Stepper value={qty} onChange={setQty} min={1} />
      </div>
      <div className="row">
        <span className="lbl">{fname(s, fromId)}:</span>
        <Chips options={['No reponer hasta el cierre', `Posponer ${s.settings.postponeDefaultMin} min`]} value={how === 'bloquear' ? 'No reponer hasta el cierre' : `Posponer ${s.settings.postponeDefaultMin} min`} onChange={(v) => setHow(v.startsWith('No') ? 'bloquear' : 'posponer')} />
      </div>
      <button
        className="btn primary big"
        disabled={!to}
        onClick={async () => {
          const r = await act(
            { type: 'substitute', fromFlavorId: fromId, toFlavorId: to, qty, reason: `Se prefiere ${fname(s, to)}`, originalAction: how, minutes: how === 'bloquear' ? null : s.settings.postponeDefaultMin },
            `Pedido ${qty} ${fname(s, to)} en lugar de ${fname(s, fromId)}`,
          );
          if (r.ok) onClose();
        }}
      >
        Pedir {qty} {to ? fname(s, to) : '…'}
      </button>
    </Sheet>
  );
}
