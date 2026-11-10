import { suggestions } from '../domain/recommend';
import { prTime } from '../domain/time';
import type { ReplenishRequest, State } from '../domain/types';
import { Empty, KindBadge, Sheet, Stepper, fname, timeOf, useAct } from './components';

const { useState } = React;

export function Freidora({ s, now }: { s: State; now: Date }) {
  const { act } = useAct();
  const [initial, setInitial] = useState(false);
  const [cancelReq, setCancelReq] = useState<ReplenishRequest | null>(null);
  const byTime = (a: ReplenishRequest, b: ReplenishRequest) => (a.kind === 'roja' ? -1 : 0) - (b.kind === 'roja' ? -1 : 0) || a.createdAt.localeCompare(b.createdAt);
  const pending = s.requests.filter((r) => r.status === 'pendiente').sort(byTime);
  const preparing = s.requests.filter((r) => r.status === 'preparando');
  const ready = s.requests.filter((r) => r.status === 'lista');
  const today = prTime(now).date;
  const doneToday = s.requests.filter((r) => r.status === 'cerrada' && r.businessDate === today);

  return (
    <div className="view">
      <div className="toolbar">
        <button className="btn primary big" onClick={() => setInitial(true)}>
          Producción inicial del día
        </button>
      </div>
      <div className="lanes">
        <section className="lane">
          <h3>
            Por hacer <span className="count">{pending.length}</span>
          </h3>
          {pending.length === 0 && <Empty>No hay solicitudes. Revisa las sugerencias.</Empty>}
          {pending.map((r) => (
            <div className={`card ${r.kind === 'roja' ? 'urgent' : ''}`} key={r.id}>
              <div className="card-top">
                <strong className="fl xl">
                  {r.qtyRequested} {fname(s, r.flavorId)}
                </strong>
              </div>
              <KindBadge kind={r.kind} />
              {r.note && <p className="muted">{r.note}</p>}
              <p className="muted">Pedido {timeOf(r.approvedAt ?? r.createdAt)} · vitrina tiene {s.inventory[r.flavorId] ?? 0}</p>
              <div className="row">
                <button className="btn primary big" onClick={() => act({ type: 'start', requestId: r.id }, `Preparando ${r.qtyRequested} ${fname(s, r.flavorId)}`)}>
                  Empezar
                </button>
                <button className="btn ghost" onClick={() => setCancelReq(r)}>
                  No se puede
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="lane">
          <h3>
            Preparando <span className="count">{preparing.length}</span>
          </h3>
          {preparing.length === 0 && <Empty>Nada en la freidora.</Empty>}
          {preparing.map((r) => (
            <ReadyCard key={r.id} s={s} r={r} />
          ))}
        </section>

        <section className="lane">
          <h3>
            Listos, esperando a vitrina <span className="count">{ready.length}</span>
          </h3>
          {ready.length === 0 && <Empty>Todo recibido.</Empty>}
          {ready.map((r) => (
            <div className="card calm" key={r.id}>
              <strong className="fl">
                {(r.qtyProduced ?? 0) - r.qtyReceived} {fname(s, r.flavorId)}
              </strong>
              <p className="muted">Listo {timeOf(r.readyAt)} · vitrina tiene que confirmar</p>
            </div>
          ))}
        </section>

        <section className="lane suggest">
          <Suggestions s={s} now={now} />
        </section>
      </div>

      <details className="panel history">
        <summary>Producción terminada hoy ({doneToday.length})</summary>
        <table className="tbl">
          <thead>
            <tr>
              <th>Sabor</th>
              <th>Tipo</th>
              <th className="num">Pedido</th>
              <th className="num">Producido</th>
              <th className="num">Recibido</th>
              <th className="num">Diferencia</th>
              <th>Hora</th>
            </tr>
          </thead>
          <tbody>
            {doneToday.map((r) => (
              <tr key={r.id}>
                <td>{fname(s, r.flavorId)}</td>
                <td>
                  <KindBadge kind={r.kind} />
                </td>
                <td className="num">{r.qtyRequested}</td>
                <td className="num">{r.qtyProduced}</td>
                <td className="num">{r.qtyReceived}</td>
                <td className={`num ${r.difference ? 'bad' : ''}`}>{r.difference}</td>
                <td>{timeOf(r.closedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {initial && <InitialSheet s={s} onClose={() => setInitial(false)} />}
      {cancelReq && <CancelSheet s={s} r={cancelReq} onClose={() => setCancelReq(null)} />}
    </div>
  );
}

function ReadyCard({ s, r }: { s: State; r: ReplenishRequest }) {
  const { act } = useAct();
  const [q, setQ] = useState(r.qtyRequested);
  return (
    <div className="card active">
      <strong className="fl xl">{fname(s, r.flavorId)}</strong>
      <KindBadge kind={r.kind} />
      <p className="muted">Empezó {timeOf(r.startedAt)} · pedido {r.qtyRequested}</p>
      <div className="row">
        <span className="lbl">Salieron</span>
        <Stepper value={q} onChange={setQ} min={1} />
      </div>
      <button className="btn ok big wide" onClick={() => act({ type: 'ready', requestId: r.id, qtyProduced: q }, `Listo: ${q} ${fname(s, r.flavorId)}. Vitrina tiene que recibirlos.`)}>
        Lista · {q}
      </button>
    </div>
  );
}

function Suggestions({ s, now }: { s: State; now: Date }) {
  const { act } = useAct();
  const list = suggestions(s, now);
  const [edit, setEdit] = useState<Record<string, number>>({});
  return (
    <>
      <h3>¿Qué conviene freír ahora?</h3>
      <p className="muted small">Solo sabores agotados en vitrina. Son estimados; nada se fríe sin que lo apruebes.</p>
      {list.length === 0 && <Empty>No hay sugerencias ahora. Aparecen cuando un sabor está agotado y hay ventas o clientes que lo pidieron.</Empty>}
      {list.map((x) => {
        const q = edit[x.flavorId] ?? x.qty;
        return (
          <div className="card sug" key={x.flavorId}>
            <div className="card-top">
              <strong className="fl">{x.name}</strong>
              <span className="pill">{x.quality === 'sin historial' ? 'Sin historial' : `Datos: ${x.quality}`}</span>
            </div>
            <ul className="why">
              {x.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {x.usesSimulatedData && <p className="sim">Usa datos simulados</p>}
            <div className="row">
              <Stepper value={q} onChange={(n) => setEdit({ ...edit, [x.flavorId]: n })} min={1} />
              <button className="btn primary" onClick={() => act({ type: 'approveSuggestion', flavorId: x.flavorId, qty: q }, `Aprobado: ${q} ${x.name}`)}>
                Aprobar
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function InitialSheet({ s, onClose }: { s: State; onClose: () => void }) {
  const { act } = useAct();
  const flavors = s.flavors.filter((f) => f.active && f.vitrinaEligible).sort((a, b) => a.order - b.order);
  const [q, setQ] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState(false);
  const items = Object.entries(q).filter(([, n]) => n > 0);
  const total = items.reduce((a, [, n]) => a + n, 0);
  return (
    <Sheet title="Producción inicial del día" onClose={onClose} wide>
      {!confirm ? (
        <>
          <p className="muted">Anota cuántos freíste de cada sabor. Vitrina confirma lo que recibe; el inventario sube cuando vitrina confirma.</p>
          <div className="init-grid">
            {flavors.map((f) => (
              <div className={`init-i${(q[f.id] ?? 0) > 0 ? ' on' : ''}`} key={f.id}>
                <span>{f.name}</span>
                <Stepper value={q[f.id] ?? 0} onChange={(n) => setQ({ ...q, [f.id]: n })} />
                <div className="quick">
                  {[6, 12].map((n) => (
                    <button key={n} className="chip" onClick={() => setQ({ ...q, [f.id]: (q[f.id] ?? 0) + n })}>
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="sticky-actions">
            <button className="btn primary big" disabled={total === 0} onClick={() => setConfirm(true)}>
              Revisar ({total} pastelillos)
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Vas a marcar como LISTA:</p>
          <ul className="list">
            {items.map(([id, n]) => (
              <li key={id}>
                <span className="fl">
                  {n} {fname(s, id)}
                </span>
              </li>
            ))}
          </ul>
          <div className="row">
            <button
              className="btn ok big"
              onClick={() => {
                act({ type: 'initialProduction', items: items.map(([flavorId, qty]) => ({ flavorId, qty })) }, `Producción inicial lista: ${total}. Vitrina tiene que recibirla.`).then((r) => r.ok && onClose());
              }}
            >
              Marcar LISTA
            </button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>
              Corregir
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function CancelSheet({ s, r, onClose }: { s: State; r: ReplenishRequest; onClose: () => void }) {
  const { act } = useAct();
  const reasons = ['No hay masa / relleno', 'Freidora ocupada con órdenes', 'Ya no da tiempo', 'Otro'];
  return (
    <Sheet title={`No se puede: ${r.qtyRequested} ${fname(s, r.flavorId)}`} onClose={onClose}>
      {r.kind === 'roja' && <p className="muted">Como es automática, el sabor queda en "No reponer" por 30 minutos para que no se vuelva a pedir solo.</p>}
      <div className="actions">
        {reasons.map((x) => (
          <button key={x} className="btn" onClick={() => act({ type: 'cancelRequest', requestId: r.id, reason: x }, 'Solicitud cancelada').then((res) => res.ok && onClose())}>
            {x}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
