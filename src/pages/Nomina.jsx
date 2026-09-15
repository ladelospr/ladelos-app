import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { descargarCSV } from "../lib/csv";

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const horas = (n) => Number(n ?? 0).toFixed(2);

// periodo = primer dia del mes, igual que en Gastos Fijos.
const periodoDe = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

function moverMes(periodo, delta) {
  const [a, m] = periodo.split("-").map(Number);
  return periodoDe(new Date(a, m - 1 + delta, 1));
}

function nombreMes(periodo) {
  const [a, m] = periodo.split("-").map(Number);
  const texto = new Date(a, m - 1, 1).toLocaleDateString("es-PR", {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function Nomina() {
  const { profile } = useAuth();
  const esAdmin = profile?.rol === "admin";

  const [periodo, setPeriodo] = useState(() => periodoDe(new Date()));
  const [filas, setFilas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [periodosPasados, setPeriodosPasados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  // Descuentos que el admin esta editando pero todavia no ha guardado.
  const [borrador, setBorrador] = useState({});

  const cargar = useCallback(async () => {
    setCargando(true);
    setBorrador({});
    const [{ data: nom, error }, { data: emps }, { data: hist }] = await Promise.all([
      supabase.from("nomina").select("*").eq("periodo", periodo),
      supabase.from("empleados").select("id, nombre, tienda"),
      supabase.from("nomina").select("periodo").order("periodo", { ascending: false }),
    ]);

    if (error) {
      setMensaje({
        tipo: "error",
        texto: `No se pudo cargar la nómina: ${error.message}. ¿Ya corriste supabase-nomina.sql?`,
      });
      setFilas([]);
    } else {
      setFilas(nom ?? []);
    }
    setEmpleados(emps ?? []);
    setPeriodosPasados([...new Set((hist ?? []).map((h) => h.periodo))]);
    setCargando(false);
  }, [periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  const nombrePorId = useMemo(
    () => Object.fromEntries(empleados.map((e) => [e.id, e.nombre])),
    [empleados],
  );

  const ordenadas = useMemo(
    () =>
      [...filas].sort((a, b) =>
        (nombrePorId[a.empleado_id] ?? "").localeCompare(nombrePorId[b.empleado_id] ?? "", "es"),
      ),
    [filas, nombrePorId],
  );

  const totales = useMemo(
    () =>
      filas.reduce(
        (t, f) => ({
          asignadas: t.asignadas + Number(f.horas_asignadas ?? 0),
          horas: t.horas + Number(f.horas_trabajadas ?? 0),
          bruto: t.bruto + Number(f.bruto ?? 0),
          descuentos: t.descuentos + Number(f.descuentos ?? 0),
          neto: t.neto + Number(f.neto ?? 0),
        }),
        { asignadas: 0, horas: 0, bruto: 0, descuentos: 0, neto: 0 },
      ),
    [filas],
  );

  const cerrada = filas.length > 0 && filas.every((f) => f.cerrada);
  const sinTarifa = filas.filter((f) => Number(f.tarifa_hora) === 0);

  async function generar() {
    setGenerando(true);
    setMensaje(null);
    // El calculo vive en Postgres (generar_nomina), no aqui: las horas salen
    // de los ponches y la tarifa del historial de tarifas, y la funcion
    // comprueba el rol antes de escribir nada.
    const { data, error } = await supabase.rpc("generar_nomina", { p_periodo: periodo });
    setGenerando(false);
    if (error) {
      return setMensaje({ tipo: "error", texto: `No se generó la nómina: ${error.message}` });
    }
    setMensaje({
      tipo: "ok",
      texto: `Nómina recalculada para ${data?.length ?? 0} empleados. Los descuentos que hayas escrito se mantienen.`,
    });
    cargar();
  }

  async function guardarDescuentos() {
    const cambios = Object.entries(borrador);
    if (!cambios.length) return;
    setMensaje(null);

    for (const [id, valor] of cambios) {
      const monto = Number(valor);
      if (!Number.isFinite(monto) || monto < 0) {
        return setMensaje({ tipo: "error", texto: "Los descuentos no pueden ser negativos." });
      }
      const { error } = await supabase.from("nomina").update({ descuentos: monto }).eq("id", id);
      if (error) {
        return setMensaje({ tipo: "error", texto: `No se guardó un descuento: ${error.message}` });
      }
    }
    setMensaje({ tipo: "ok", texto: `${cambios.length} descuento(s) guardado(s).` });
    cargar();
  }

  async function alternarCierre() {
    const nuevoEstado = !cerrada;
    const aviso = nuevoEstado
      ? `¿Cerrar la nómina de ${nombreMes(periodo)}? Después no se podrá editar sin reabrirla.`
      : `¿Reabrir la nómina de ${nombreMes(periodo)}?`;
    if (!window.confirm(aviso)) return;

    const { error } = await supabase
      .from("nomina")
      .update({ cerrada: nuevoEstado })
      .eq("periodo", periodo);
    if (error) return setMensaje({ tipo: "error", texto: `No se pudo cambiar el estado: ${error.message}` });
    cargar();
  }

  function exportar() {
    if (!ordenadas.length) return setMensaje({ tipo: "error", texto: "No hay nada que exportar." });
    descargarCSV(
      `nomina-${periodo.slice(0, 7)}.csv`,
      ["Empleado", "Horas asignadas", "Horas trabajadas", "Tarifa", "Bruto", "Descuentos", "Neto"],
      ordenadas.map((f) => [
        nombrePorId[f.empleado_id] ?? "—",
        horas(f.horas_asignadas),
        horas(f.horas_trabajadas),
        Number(f.tarifa_hora ?? 0).toFixed(2),
        Number(f.bruto ?? 0).toFixed(2),
        Number(f.descuentos ?? 0).toFixed(2),
        Number(f.neto ?? 0).toFixed(2),
      ]),
    );
  }

  if (!esAdmin) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-neutral-900">Nómina</h1>
        <p className="mt-4 rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
          La nómina solo la ve un administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Nómina</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Se calcula desde los ponches del mes y la tarifa vigente de cada empleado.
      </p>

      {/* Selector de mes */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
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
        {cerrada && (
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
            Cerrada
          </span>
        )}
      </div>

      {/* Acciones */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={generar}
          disabled={generando || cerrada}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {generando ? "Calculando…" : filas.length ? "Recalcular nómina" : "Generar nómina"}
        </button>
        <button
          onClick={guardarDescuentos}
          disabled={!Object.keys(borrador).length || cerrada}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Guardar descuentos
        </button>
        <button onClick={exportar} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-700">
          Exportar Excel
        </button>
        {filas.length > 0 && (
          <button
            onClick={alternarCierre}
            className="ml-auto rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-700"
          >
            {cerrada ? "Reabrir nómina" : "Cerrar nómina"}
          </button>
        )}
      </div>

      {mensaje && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            mensaje.tipo === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {sinTarifa.length > 0 && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {sinTarifa.length} empleado(s) sin tarifa por hora registrada, así que su bruto
          sale en $0. Añade su tarifa en la tabla <code>empleados_tarifas</code> y recalcula.
        </div>
      )}

      {/* Tabla */}
      {cargando ? (
        <p className="mt-8 text-neutral-500">Cargando nómina…</p>
      ) : ordenadas.length === 0 ? (
        <p className="mt-8 rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
          No hay nómina para {nombreMes(periodo)}. Dale a «Generar nómina».
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Empleado</th>
                <th className="px-3 py-2 text-right">H. asignadas</th>
                <th className="px-3 py-2 text-right">H. trabajadas</th>
                <th className="px-3 py-2 text-right">Tarifa</th>
                <th className="px-3 py-2 text-right">Bruto</th>
                <th className="px-3 py-2 text-right">Descuentos</th>
                <th className="px-3 py-2 text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((f) => {
                const desviacion = Number(f.horas_trabajadas) - Number(f.horas_asignadas);
                return (
                  <tr key={f.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-neutral-900">
                      {nombrePorId[f.empleado_id] ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                      {horas(f.horas_asignadas)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {horas(f.horas_trabajadas)}
                      {Math.abs(desviacion) >= 0.5 && (
                        <span className={desviacion > 0 ? "ml-1 text-xs text-amber-700" : "ml-1 text-xs text-neutral-400"}>
                          {desviacion > 0 ? "+" : ""}{desviacion.toFixed(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                      {money(f.tarifa_hora)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(f.bruto)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number" step="0.01" min="0" inputMode="decimal"
                        disabled={f.cerrada}
                        value={borrador[f.id] ?? Number(f.descuentos ?? 0).toFixed(2)}
                        onChange={(e) => setBorrador((b) => ({ ...b, [f.id]: e.target.value }))}
                        className="w-24 rounded-lg border border-neutral-300 px-2 py-1 text-right tabular-nums disabled:bg-neutral-50"
                        aria-label={`Descuentos de ${nombrePorId[f.empleado_id] ?? "empleado"}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(f.neto)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-200 bg-neutral-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                  {horas(totales.asignadas)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{horas(totales.horas)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums">{money(totales.bruto)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(totales.descuentos)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(totales.neto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-4 rounded-lg bg-neutral-100 p-3 text-xs text-neutral-600">
        <strong>Sobre los descuentos:</strong> la app no calcula las retenciones de
        Puerto Rico (seguro social, Medicare, retención de Hacienda, CRIM). Dependen
        del W-4 de cada empleado y de las tablas vigentes, y ponerlas a ojo sería
        inventar números sobre el sueldo de alguien. Escríbelas a mano en la columna
        de descuentos o sácalas de tu proveedor de payroll.
      </p>

      {periodosPasados.length > 1 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-neutral-900">Nóminas pasadas</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {periodosPasados.map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  p === periodo ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {nombreMes(p)}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
