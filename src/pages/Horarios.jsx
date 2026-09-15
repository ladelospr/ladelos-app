import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { DIAS_SEMANA, BLOQUES } from "../lib/constants";

// Fase 4, pantalla 1: DISPONIBILIDADES.
// Cada empleado marca en qué bloques puede trabajar. Se guarda solo,
// sin botón de guardar, porque son 14 casillas y nadie va a recordar
// darle a guardar en el celular.
//
// Las pantallas 2 (scheduling con sugerencias a partir de las ventas de
// Clover) y 3 (PDF semanal) se montan encima de esta tabla — ver
// ROADMAP.md para el estado de cada una.

const clave = (dia, bloque) => `${dia}-${bloque}`;

export default function Horarios() {
  const { user, profile } = useAuth();
  const esGerencia = ["admin", "supervisor"].includes(profile?.rol);

  const [empleados, setEmpleados] = useState([]);
  const [empleadoId, setEmpleadoId] = useState(null);
  const [disponibilidades, setDisponibilidades] = useState([]);
  const [vista, setVista] = useState("mia");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [{ data: emps, error: eEmp }, { data: disp }] = await Promise.all([
      supabase.from("empleados").select("*").eq("activo", true).order("nombre"),
      supabase.from("disponibilidades").select("*"),
    ]);

    if (eEmp) {
      setMensaje({
        tipo: "error",
        texto: "No se pudo cargar la lista de empleados. ¿Ya corriste supabase-roadmap.sql?",
      });
      setCargando(false);
      return;
    }

    setEmpleados(emps ?? []);
    setDisponibilidades(disp ?? []);

    // Si el usuario tiene ficha de empleado, empieza en la suya.
    const mio = (emps ?? []).find((e) => e.profile_id === user?.id);
    setEmpleadoId((actual) => actual ?? mio?.id ?? (esGerencia ? emps?.[0]?.id : null) ?? null);
    setCargando(false);
  }, [user?.id, esGerencia]);

  useEffect(() => { cargar(); }, [cargar]);

  const empleado = empleados.find((e) => e.id === empleadoId) ?? null;

  // Mapa {dia-bloque: disponible} del empleado seleccionado.
  const mapa = useMemo(() => {
    const m = {};
    for (const d of disponibilidades) {
      if (d.empleado_id === empleadoId) m[clave(d.dia_semana, d.bloque)] = d.disponible;
    }
    return m;
  }, [disponibilidades, empleadoId]);

  // Gerencia edita a cualquiera; el resto solo su propia ficha.
  const puedeEditar =
    !!empleado && (esGerencia || empleado.profile_id === user?.id);

  async function alternar(dia, bloque) {
    if (!empleado || !puedeEditar) return;
    const k = clave(dia, bloque);
    const nuevo = !mapa[k];

    setGuardando(k);
    setMensaje(null);

    // Optimista: la casilla cambia al instante.
    setDisponibilidades((ds) => {
      const existe = ds.some(
        (d) => d.empleado_id === empleadoId && d.dia_semana === dia && d.bloque === bloque,
      );
      if (existe) {
        return ds.map((d) =>
          d.empleado_id === empleadoId && d.dia_semana === dia && d.bloque === bloque
            ? { ...d, disponible: nuevo }
            : d,
        );
      }
      return [...ds, { empleado_id: empleadoId, dia_semana: dia, bloque, disponible: nuevo }];
    });

    const { error } = await supabase
      .from("disponibilidades")
      .upsert(
        { empleado_id: empleadoId, dia_semana: dia, bloque, disponible: nuevo, updated_at: new Date().toISOString() },
        { onConflict: "empleado_id,dia_semana,bloque" },
      );

    setGuardando(null);
    if (error) {
      setMensaje({ tipo: "error", texto: `No se guardó el cambio: ${error.message}` });
      cargar(); // vuelve a lo que hay en la base
    }
  }

  const horasSemana = useMemo(() => {
    // Bloque 1 son 7 horas (7AM-2PM), bloque 2 son 5 (2PM-7PM).
    const horas = { 1: 7, 2: 5 };
    return Object.entries(mapa)
      .filter(([, v]) => v)
      .reduce((t, [k]) => t + horas[Number(k.split("-")[1])], 0);
  }, [mapa]);

  if (cargando) return <p className="text-neutral-500">Cargando horarios…</p>;

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Horarios</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Disponibilidad semanal de cada empleado. Se guarda sola al tocar cada bloque.
      </p>

      {esGerencia && (
        <div className="mt-4 flex gap-2">
          {[
            { id: "mia", label: "Por empleado" },
            { id: "todas", label: "Ver todas" },
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

      {empleados.length === 0 ? (
        <p className="mt-8 rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
          No hay empleados registrados todavía. Añádelos en la tabla <code>empleados</code>.
        </p>
      ) : vista === "todas" && esGerencia ? (
        <TablaTodas empleados={empleados} disponibilidades={disponibilidades} />
      ) : (
        <>
          {esGerencia && (
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
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm text-neutral-600">
                  Disponibilidad de <strong className="text-neutral-900">{empleado.nombre}</strong>
                </p>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                  {horasSemana} h disponibles por semana
                </span>
                {!puedeEditar && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                    Solo lectura
                  </span>
                )}
              </div>

              <GridDisponibilidad
                mapa={mapa}
                guardando={guardando}
                puedeEditar={puedeEditar}
                onAlternar={alternar}
              />

              <p className="mt-3 text-xs text-neutral-500">
                Verde = disponible. Gris = no disponible. Los cambios se guardan solos.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function GridDisponibilidad({ mapa, guardando, puedeEditar, onAlternar }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-3 py-2 text-left">Bloque</th>
            {DIAS_SEMANA.map((d) => (
              <th key={d.valor} className="px-2 py-2 text-center">{d.corto}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BLOQUES.map((b) => (
            <tr key={b.valor} className="border-b border-neutral-100 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 font-medium text-neutral-700">{b.label}</td>
              {DIAS_SEMANA.map((d) => {
                const k = clave(d.valor, b.valor);
                const activo = !!mapa[k];
                return (
                  <td key={d.valor} className="px-1 py-1 text-center">
                    <button
                      onClick={() => onAlternar(d.valor, b.valor)}
                      disabled={!puedeEditar || guardando === k}
                      aria-pressed={activo}
                      aria-label={`${d.label} ${b.label}: ${activo ? "disponible" : "no disponible"}`}
                      className={`h-11 w-full min-w-11 rounded-lg text-xs font-medium transition disabled:opacity-60 ${
                        activo ? "bg-green-600 text-white" : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      {guardando === k ? "…" : activo ? "Sí" : "—"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaTodas({ empleados, disponibilidades }) {
  // {empleado_id: Set("dia-bloque")}
  const porEmpleado = useMemo(() => {
    const m = {};
    for (const d of disponibilidades) {
      if (!d.disponible) continue;
      (m[d.empleado_id] ??= new Set()).add(clave(d.dia_semana, d.bloque));
    }
    return m;
  }, [disponibilidades]);

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <th className="sticky left-0 bg-white px-3 py-2 text-left">Empleado</th>
            {DIAS_SEMANA.map((d) => (
              <th key={d.valor} className="px-2 py-2 text-center" colSpan={BLOQUES.length}>
                {d.corto}
              </th>
            ))}
          </tr>
          <tr className="border-b border-neutral-200 text-[10px] uppercase text-neutral-400">
            <th className="sticky left-0 bg-white px-3 py-1" />
            {DIAS_SEMANA.flatMap((d) =>
              BLOQUES.map((b) => (
                <th key={`${d.valor}-${b.valor}`} className="px-1 py-1 text-center">{b.corto}</th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {empleados.map((e) => {
            const suyas = porEmpleado[e.id] ?? new Set();
            return (
              <tr key={e.id} className="border-b border-neutral-100 last:border-0">
                <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 font-medium text-neutral-900">
                  {e.nombre}
                  {e.tienda && <span className="ml-1 text-xs text-neutral-400">{e.tienda}</span>}
                </td>
                {DIAS_SEMANA.flatMap((d) =>
                  BLOQUES.map((b) => {
                    const activo = suyas.has(clave(d.valor, b.valor));
                    return (
                      <td key={`${d.valor}-${b.valor}`} className="px-1 py-1">
                        <div
                          title={`${e.nombre} — ${d.label} ${b.label}`}
                          className={`mx-auto h-6 w-6 rounded ${activo ? "bg-green-500" : "bg-neutral-100"}`}
                        />
                      </td>
                    );
                  }),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
