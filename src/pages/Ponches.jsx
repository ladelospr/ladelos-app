import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { TIENDAS } from "../lib/constants";

// Fecha local en formato YYYY-MM-DD.
//
// Ojo con no usar toISOString(): devuelve UTC, y Puerto Rico va en UTC-4.
// Un ponche a las 9 de la noche se guardaria con la fecha del dia siguiente,
// y horas_trabajadas() filtra por esa columna, asi que las horas caerian en
// el mes equivocado en el corte de fin de mes.
function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const hora = (ts) =>
  ts ? new Date(ts).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" }) : "—";

// Duracion en milisegundos a "7h 30m".
function duracion(ms) {
  if (ms == null || ms < 0) return "—";
  const total = Math.floor(ms / 60000);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

const duracionPonche = (p) =>
  p.hora_salida ? duracion(new Date(p.hora_salida) - new Date(p.hora_entrada)) : null;

export default function Ponches() {
  const { user, profile } = useAuth();
  const esGerencia = ["admin", "supervisor"].includes(profile?.rol);

  const [empleados, setEmpleados] = useState([]);
  const [empleadoId, setEmpleadoId] = useState(null);
  const [tienda, setTienda] = useState(TIENDAS[0]);
  const [mios, setMios] = useState([]);
  const [todos, setTodos] = useState([]);
  const [vista, setVista] = useState("ponchar");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [ahora, setAhora] = useState(Date.now());

  // Filtros de la vista de admin
  const [filtroTienda, setFiltroTienda] = useState("todas");
  const [filtroFecha, setFiltroFecha] = useState(fechaLocal());

  // Refresca el cronometro del ponche abierto una vez por minuto.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const cargarEmpleados = useCallback(async () => {
    const { data, error } = await supabase
      .from("empleados")
      .select("*")
      .eq("activo", true)
      .order("nombre");
    if (error) {
      setMensaje({ tipo: "error", texto: "No se pudo cargar la lista de empleados." });
      return;
    }
    setEmpleados(data ?? []);
    const mio = (data ?? []).find((e) => e.profile_id === user?.id);
    setEmpleadoId((actual) => actual ?? mio?.id ?? (esGerencia ? data?.[0]?.id : null) ?? null);
  }, [user?.id, esGerencia]);

  const cargarMios = useCallback(async () => {
    if (!empleadoId) return setMios([]);
    const { data } = await supabase
      .from("ponches")
      .select("*")
      .eq("empleado_id", empleadoId)
      .order("hora_entrada", { ascending: false })
      .limit(10);
    setMios(data ?? []);
  }, [empleadoId]);

  const cargarTodos = useCallback(async () => {
    let q = supabase.from("ponches").select("*").eq("fecha", filtroFecha);
    if (filtroTienda !== "todas") q = q.eq("tienda", filtroTienda);
    const { data } = await q.order("hora_entrada", { ascending: false });
    setTodos(data ?? []);
  }, [filtroFecha, filtroTienda]);

  useEffect(() => {
    (async () => {
      await cargarEmpleados();
      setCargando(false);
    })();
  }, [cargarEmpleados]);

  useEffect(() => { cargarMios(); }, [cargarMios]);
  useEffect(() => { if (vista === "todos") cargarTodos(); }, [vista, cargarTodos]);

  const empleado = empleados.find((e) => e.id === empleadoId) ?? null;
  const nombrePorId = useMemo(
    () => Object.fromEntries(empleados.map((e) => [e.id, e.nombre])),
    [empleados],
  );

  const abierto = mios.find((p) => !p.hora_salida) ?? null;
  const puedePonchar = !!empleado && (esGerencia || empleado.profile_id === user?.id);

  async function entrar() {
    if (!empleado) return;
    setOcupado(true);
    setMensaje(null);
    const { error } = await supabase.from("ponches").insert({
      empleado_id: empleadoId,
      tienda: empleado.tienda ?? tienda,
      fecha: fechaLocal(),
      hora_entrada: new Date().toISOString(),
    });
    setOcupado(false);
    if (error) {
      // El indice parcial idx_ponche_abierto_unico impide dos ponches
      // abiertos a la vez, incluso desde dos pantallas distintas.
      const texto = error.code === "23505"
        ? "Ya hay un ponche abierto para este empleado. Cierra ese primero."
        : `No se registró la entrada: ${error.message}`;
      return setMensaje({ tipo: "error", texto });
    }
    setMensaje({ tipo: "ok", texto: `Entrada registrada a las ${hora(new Date().toISOString())}.` });
    cargarMios();
  }

  async function salir() {
    if (!abierto) return;
    setOcupado(true);
    setMensaje(null);
    const { error } = await supabase
      .from("ponches")
      .update({ hora_salida: new Date().toISOString() })
      .eq("id", abierto.id);
    setOcupado(false);
    if (error) return setMensaje({ tipo: "error", texto: `No se registró la salida: ${error.message}` });
    const trabajado = duracion(Date.now() - new Date(abierto.hora_entrada));
    setMensaje({ tipo: "ok", texto: `Salida registrada. Turno de ${trabajado}.` });
    cargarMios();
  }

  if (cargando) return <p className="text-neutral-500">Cargando ponches…</p>;

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Ponches</h1>
      <p className="mt-1 text-sm text-neutral-500">Entrada y salida del turno.</p>

      {esGerencia && (
        <div className="mt-4 flex gap-2">
          {[
            { id: "ponchar", label: "Ponchar" },
            { id: "todos", label: "Ver todos" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                vista === v.id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {v.label}
            </button>
          ))}
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

      {vista === "todos" && esGerencia ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs text-neutral-600">Fecha</span>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-600">Tienda</span>
              <select
                value={filtroTienda}
                onChange={(e) => setFiltroTienda(e.target.value)}
                className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="todas">Todas</option>
                {TIENDAS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>

          <TablaPonches
            ponches={todos}
            nombrePorId={nombrePorId}
            ahora={ahora}
            vacio={`No hay ponches el ${filtroFecha}.`}
            conNombre
          />
        </section>
      ) : (
        <>
          {esGerencia && empleados.length > 0 && (
            <label className="mt-4 block max-w-xs">
              <span className="text-sm text-neutral-600">Empleado</span>
              <select
                value={empleadoId ?? ""}
                onChange={(e) => setEmpleadoId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              >
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}{e.tienda ? ` — ${e.tienda}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!empleado ? (
            <p className="mt-8 rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
              Tu usuario no está enlazado con ninguna ficha de empleado. Pídele a un
              administrador que llene <code>empleados.profile_id</code> con tu cuenta.
            </p>
          ) : (
            <>
              {!empleado.tienda && (
                <label className="mt-3 block max-w-xs">
                  <span className="text-sm text-neutral-600">Tienda del turno</span>
                  <select
                    value={tienda}
                    onChange={(e) => setTienda(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                  >
                    {TIENDAS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
              )}

              {/* Botón grande: esto se usa desde la tablet de la tienda */}
              <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 text-center">
                {abierto ? (
                  <>
                    <p className="text-sm text-neutral-500">
                      Entrada a las {hora(abierto.hora_entrada)}
                      {abierto.tienda ? ` — ${abierto.tienda}` : ""}
                    </p>
                    <p className="mt-1 text-4xl font-semibold tabular-nums text-neutral-900">
                      {duracion(ahora - new Date(abierto.hora_entrada))}
                    </p>
                    <button
                      onClick={salir}
                      disabled={ocupado || !puedePonchar}
                      className="mt-5 w-full rounded-xl bg-red-600 px-6 py-5 text-lg font-semibold text-white disabled:opacity-50"
                    >
                      {ocupado ? "Registrando…" : "Salida"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-neutral-500">
                      {empleado.nombre} no tiene ningún turno abierto.
                    </p>
                    <button
                      onClick={entrar}
                      disabled={ocupado || !puedePonchar}
                      className="mt-5 w-full rounded-xl bg-green-600 px-6 py-5 text-lg font-semibold text-white disabled:opacity-50"
                    >
                      {ocupado ? "Registrando…" : "Entrada"}
                    </button>
                  </>
                )}
                {!puedePonchar && (
                  <p className="mt-3 text-xs text-amber-700">
                    Solo lectura: no puedes ponchar por otra persona.
                  </p>
                )}
              </div>

              <h2 className="mt-8 text-lg font-semibold text-neutral-900">Últimos 10 ponches</h2>
              <TablaPonches
                ponches={mios}
                nombrePorId={nombrePorId}
                ahora={ahora}
                vacio="Todavía no hay ponches registrados."
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function TablaPonches({ ponches, nombrePorId, ahora, vacio, conNombre = false }) {
  if (!ponches.length) {
    return (
      <p className="mt-3 rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
        {vacio}
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
            {conNombre && <th className="px-3 py-2">Empleado</th>}
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2">Tienda</th>
            <th className="px-3 py-2">Entrada</th>
            <th className="px-3 py-2">Salida</th>
            <th className="px-3 py-2 text-right">Horas</th>
          </tr>
        </thead>
        <tbody>
          {ponches.map((p) => {
            const cerrado = !!p.hora_salida;
            return (
              <tr
                key={p.id}
                className={`border-b border-neutral-100 last:border-0 ${cerrado ? "" : "bg-amber-50"}`}
              >
                {conNombre && (
                  <td className="px-3 py-2 font-medium text-neutral-900">
                    {nombrePorId[p.empleado_id] ?? "—"}
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-2">{p.fecha}</td>
                <td className="px-3 py-2 text-neutral-600">{p.tienda || "—"}</td>
                <td className="px-3 py-2">{hora(p.hora_entrada)}</td>
                <td className="px-3 py-2">
                  {cerrado ? hora(p.hora_salida) : <span className="text-amber-700">abierto</span>}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {cerrado
                    ? duracionPonche(p)
                    : <span className="text-amber-700">{duracion(ahora - new Date(p.hora_entrada))}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
