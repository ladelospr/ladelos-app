import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { TIENDAS, TIPOS_GASTO, TIPO_GASTO_LABEL, BUCKET_GASTOS } from "../lib/constants";

const DIAS_ALERTA = 3;

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

// periodo se guarda como el primer dia del mes ("2026-09-01"), asi ordena
// bien y se puede comparar aunque la columna sea date o text.
const periodoDe = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-01`;

const nombreMes = (periodo) => {
  const [a, m] = periodo.split("-");
  const d = new Date(Number(a), Number(m) - 1, 1);
  const texto = d.toLocaleDateString("es-PR", { month: "long", year: "numeric" });
  // Solo la primera letra: la clase capitalize de CSS pondria "Septiembre De 2026".
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

function moverMes(periodo, delta) {
  const [a, m] = periodo.split("-").map(Number);
  return periodoDe(new Date(a, m - 1 + delta, 1));
}

// Dias que faltan para el vencimiento. Negativo = ya vencio.
function diasPara(vencimiento) {
  if (!vencimiento) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [a, m, d] = vencimiento.split("-").map(Number);
  const venc = new Date(a, m - 1, d);
  return Math.round((venc - hoy) / 86400000);
}

export default function GastosFijos() {
  const [periodo, setPeriodo] = useState(() => periodoDe(new Date()));
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [modalTienda, setModalTienda] = useState(null);
  const [urlsFirmadas, setUrlsFirmadas] = useState({});

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from("inv_gastos_fijos")
      .select("*")
      .eq("periodo", periodo)
      .order("vencimiento", { ascending: true });
    if (error) {
      setMensaje({ tipo: "error", texto: `No se pudieron cargar los gastos: ${error.message}` });
      setGastos([]);
    } else {
      setGastos(data ?? []);
    }
    setCargando(false);
  }, [periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  // El bucket es privado, asi que cada foto necesita su URL firmada.
  useEffect(() => {
    const rutas = gastos.map((g) => g.imagen_url).filter((u) => u && !u.startsWith("http"));
    if (!rutas.length) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase.storage.from(BUCKET_GASTOS).createSignedUrls(rutas, 3600);
      if (cancelado || !data) return;
      setUrlsFirmadas((prev) => {
        const siguiente = { ...prev };
        data.forEach((r, i) => { if (r.signedUrl) siguiente[rutas[i]] = r.signedUrl; });
        return siguiente;
      });
    })();
    return () => { cancelado = true; };
  }, [gastos]);

  function urlFoto(gasto) {
    if (!gasto.imagen_url) return null;
    return gasto.imagen_url.startsWith("http") ? gasto.imagen_url : urlsFirmadas[gasto.imagen_url];
  }

  async function alternarPagado(gasto) {
    // Optimista: la tabla se actualiza al instante y se revierte si falla.
    const antes = gastos;
    setGastos((gs) => gs.map((g) => (g.id === gasto.id ? { ...g, pagado: !g.pagado } : g)));
    const { error } = await supabase
      .from("inv_gastos_fijos")
      .update({ pagado: !gasto.pagado })
      .eq("id", gasto.id);
    if (error) {
      setGastos(antes);
      setMensaje({ tipo: "error", texto: `No se pudo marcar el pago: ${error.message}` });
    }
  }

  async function borrar(gasto) {
    if (!window.confirm(`¿Borrar el gasto de ${TIPO_GASTO_LABEL[gasto.tipo] ?? gasto.tipo} (${money(gasto.monto)})?`)) return;
    const { error } = await supabase.from("inv_gastos_fijos").delete().eq("id", gasto.id);
    if (error) return setMensaje({ tipo: "error", texto: `No se pudo borrar: ${error.message}` });
    setGastos((gs) => gs.filter((g) => g.id !== gasto.id));
  }

  async function subirFoto(gasto, file) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const ruta = `${gasto.tienda}/${periodo.slice(0, 7)}/${gasto.id}.${ext}`;
    const { error: eSubida } = await supabase.storage
      .from(BUCKET_GASTOS)
      .upload(ruta, file, { upsert: true });
    if (eSubida) return setMensaje({ tipo: "error", texto: `No se subió la foto: ${eSubida.message}` });

    const { error } = await supabase
      .from("inv_gastos_fijos")
      .update({ imagen_url: ruta })
      .eq("id", gasto.id);
    if (error) return setMensaje({ tipo: "error", texto: `Se subió la foto pero no se guardó: ${error.message}` });

    setGastos((gs) => gs.map((g) => (g.id === gasto.id ? { ...g, imagen_url: ruta } : g)));
    setMensaje({ tipo: "ok", texto: "Foto del recibo guardada." });
  }

  const porTienda = useMemo(() => {
    const mapa = Object.fromEntries(TIENDAS.map((t) => [t, []]));
    for (const g of gastos) (mapa[g.tienda] ??= []).push(g);
    return mapa;
  }, [gastos]);

  const totales = useMemo(() => {
    const suma = (arr) => arr.reduce((t, g) => t + Number(g.monto ?? 0), 0);
    return {
      total: suma(gastos),
      pagado: suma(gastos.filter((g) => g.pagado)),
      pendiente: suma(gastos.filter((g) => !g.pagado)),
    };
  }, [gastos]);

  const porVencer = gastos.filter(
    (g) => !g.pagado && diasPara(g.vencimiento) !== null && diasPara(g.vencimiento) <= DIAS_ALERTA,
  );

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Gastos fijos</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Agua, luz, gas, seguros, alquiler y reparaciones de cada tienda.
      </p>

      {/* Selector de mes */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => setPeriodo((p) => moverMes(p, -1))}
          className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700"
        >
          ← Mes anterior
        </button>
        <span className="min-w-44 text-center font-semibold text-neutral-900">
          {nombreMes(periodo)}
        </span>
        <button
          onClick={() => setPeriodo((p) => moverMes(p, 1))}
          className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700"
        >
          Mes siguiente →
        </button>
      </div>

      {/* Totales */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Total del mes</p>
          <p className="text-xl font-semibold text-neutral-900">{money(totales.total)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Pagado</p>
          <p className="text-xl font-semibold text-green-700">{money(totales.pagado)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Pendiente</p>
          <p className="text-xl font-semibold text-amber-700">{money(totales.pendiente)}</p>
        </div>
      </div>

      {porVencer.length > 0 && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <strong>{porVencer.length}</strong>{" "}
          {porVencer.length === 1 ? "gasto vence" : "gastos vencen"} en {DIAS_ALERTA} días o menos:{" "}
          {porVencer.map((g) => `${TIPO_GASTO_LABEL[g.tipo] ?? g.tipo} (${g.tienda})`).join(", ")}.
        </div>
      )}

      {mensaje && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            mensaje.tipo === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Una columna por tienda */}
      {cargando ? (
        <p className="mt-8 text-neutral-500">Cargando gastos…</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {TIENDAS.map((t) => (
            <ColumnaTienda
              key={t}
              tienda={t}
              gastos={porTienda[t] ?? []}
              urlFoto={urlFoto}
              onAñadir={() => setModalTienda(t)}
              onAlternarPagado={alternarPagado}
              onSubirFoto={subirFoto}
              onBorrar={borrar}
            />
          ))}
        </div>
      )}

      {modalTienda && (
        <ModalGasto
          tienda={modalTienda}
          periodo={periodo}
          onCerrar={() => setModalTienda(null)}
          onGuardado={(gasto) => {
            setGastos((gs) => [...gs, gasto]);
            setModalTienda(null);
            setMensaje({ tipo: "ok", texto: "Gasto añadido." });
          }}
        />
      )}
    </div>
  );
}

function ColumnaTienda({ tienda, gastos, urlFoto, onAñadir, onAlternarPagado, onSubirFoto, onBorrar }) {
  const total = gastos.reduce((t, g) => t + Number(g.monto ?? 0), 0);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-neutral-900">{tienda}</h2>
          <p className="text-xs text-neutral-500">
            {gastos.length} {gastos.length === 1 ? "gasto" : "gastos"} — {money(total)}
          </p>
        </div>
        <button onClick={onAñadir} className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white">
          + Añadir gasto
        </button>
      </header>

      {gastos.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-neutral-500">
          Todavía no hay gastos registrados este mes.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {gastos.map((g) => (
            <FilaGasto
              key={g.id}
              gasto={g}
              foto={urlFoto(g)}
              onAlternarPagado={onAlternarPagado}
              onSubirFoto={onSubirFoto}
              onBorrar={onBorrar}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilaGasto({ gasto, foto, onAlternarPagado, onSubirFoto, onBorrar }) {
  const inputRef = useRef(null);
  const dias = diasPara(gasto.vencimiento);
  const urgente = !gasto.pagado && dias !== null && dias <= DIAS_ALERTA;

  return (
    <li className={`px-4 py-3 ${urgente ? "bg-red-50" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-neutral-900">
            {TIPO_GASTO_LABEL[gasto.tipo] ?? gasto.tipo}
          </p>
          <p className={`text-xs ${urgente ? "font-medium text-red-700" : "text-neutral-500"}`}>
            {gasto.vencimiento ? `Vence ${gasto.vencimiento}` : "Sin fecha de vencimiento"}
            {urgente &&
              (dias < 0 ? " — vencido" : dias === 0 ? " — hoy" : ` — en ${dias} ${dias === 1 ? "día" : "días"}`)}
          </p>
        </div>

        <span className="font-semibold text-neutral-900">{money(gasto.monto)}</span>

        <button
          onClick={() => onAlternarPagado(gasto)}
          className={`w-24 rounded-lg px-3 py-1.5 text-sm font-medium ${
            gasto.pagado ? "bg-green-600 text-white" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {gasto.pagado ? "Pagado" : "Pendiente"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSubirFoto(gasto, file);
            e.target.value = "";
          }}
        />
        {foto ? (
          <a href={foto} target="_blank" rel="noreferrer" className="text-sm text-blue-600" title="Ver recibo">
            📎 Ver
          </a>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="text-sm text-neutral-500"
            title="Subir foto del recibo"
          >
            📷 Subir
          </button>
        )}

        <button onClick={() => onBorrar(gasto)} className="text-sm text-neutral-400" title="Borrar gasto">
          ✕
        </button>
      </div>
    </li>
  );
}

function ModalGasto({ tienda, periodo, onCerrar, onGuardado }) {
  const [tipo, setTipo] = useState(TIPOS_GASTO[0].valor);
  const [monto, setMonto] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar() {
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) return setError("El monto tiene que ser mayor que cero.");
    setGuardando(true);
    setError(null);

    const { data: gasto, error: eInsert } = await supabase
      .from("inv_gastos_fijos")
      .insert({ tienda, tipo, periodo, monto: valor, vencimiento: vencimiento || null, pagado: false })
      .select()
      .single();

    if (eInsert) {
      setGuardando(false);
      return setError(`No se guardó: ${eInsert.message}`);
    }

    // La foto se sube despues porque la ruta lleva el id del gasto.
    if (archivo) {
      const ext = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
      const ruta = `${tienda}/${periodo.slice(0, 7)}/${gasto.id}.${ext}`;
      const { error: eSubida } = await supabase.storage
        .from(BUCKET_GASTOS)
        .upload(ruta, archivo, { upsert: true });
      if (!eSubida) {
        await supabase.from("inv_gastos_fijos").update({ imagen_url: ruta }).eq("id", gasto.id);
        gasto.imagen_url = ruta;
      }
    }

    setGuardando(false);
    onGuardado(gasto);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-neutral-900">Añadir gasto — {tienda}</h2>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs text-neutral-600">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            >
              {TIPOS_GASTO.map((t) => (
                <option key={t.valor} value={t.valor}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-neutral-600">Monto</span>
            <input
              type="number" step="0.01" inputMode="decimal" autoFocus
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-xs text-neutral-600">Vencimiento</span>
            <input
              type="date"
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-xs text-neutral-600">Foto del recibo (opcional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
          </label>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCerrar} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-700">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar gasto"}
          </button>
        </div>
      </div>
    </div>
  );
}
