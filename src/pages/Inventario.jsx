import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { TIENDAS } from "../lib/constants";

const FRACCIONES = [
  { label: "0", value: 0 },
  { label: "¼", value: 0.25 },
  { label: "½", value: 0.5 },
  { label: "¾", value: 0.75 },
  { label: "1", value: 1 },
];

export default function Inventario() {
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState(null);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tienda, setTienda] = useState(TIENDAS[0]);
  const [empleado, setEmpleado] = useState("");
  const [valores, setValores] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const area = areas.find((a) => a.id === areaId);
  const esChecklist = area?.tipo === "checklist";

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("inv_areas")
        .select("*")
        .eq("activo", true)
        .order("orden");
      if (error) return setMensaje({ tipo: "error", texto: "No se pudieron cargar las áreas." });
      setAreas(data);
      setAreaId(data[0]?.id ?? null);
      setCargando(false);
    })();
  }, []);

  useEffect(() => {
    if (!areaId) return;
    setCargando(true);
    setValores({});
    (async () => {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from("inv_productos").select("*").eq("area_id", areaId).eq("activo", true).order("orden"),
        supabase.from("inv_categorias").select("*").eq("area_id", areaId).order("orden"),
      ]);
      setProductos(prods ?? []);
      setCategorias(cats ?? []);
      setCargando(false);
    })();
  }, [areaId]);

  const grupos = useMemo(() => {
    if (!categorias.length) return [{ id: null, nombre: null, items: productos }];
    return categorias.map((c) => ({
      ...c,
      items: productos.filter((p) => p.categoria_id === c.id),
    }));
  }, [categorias, productos]);

  const bajoRedZone = (p) => {
    const v = valores[p.id];
    if (esChecklist || p.red_zone_valor == null || v == null || v === "") return false;
    return Number(v) <= Number(p.red_zone_valor);
  };

  const faltantes = productos.filter((p) =>
    esChecklist ? valores[p.id] === true : bajoRedZone(p)
  );

  const contados = productos.filter((p) => valores[p.id] !== undefined && valores[p.id] !== "").length;

  async function guardar() {
    if (!empleado.trim()) {
      return setMensaje({ tipo: "error", texto: "Escribe quién hizo el conteo antes de guardar." });
    }
    setGuardando(true);
    setMensaje(null);

    const { data: conteo, error: e1 } = await supabase
      .from("inv_conteos")
      .insert({ area_id: areaId, tienda, empleado: empleado.trim(), estado: "cerrado", closed_at: new Date().toISOString() })
      .select()
      .single();

    if (e1) {
      setGuardando(false);
      return setMensaje({ tipo: "error", texto: "No se guardó el conteo. Intenta otra vez." });
    }

    const lineas = productos
      .filter((p) => valores[p.id] !== undefined && valores[p.id] !== "")
      .map((p) => ({
        conteo_id: conteo.id,
        producto_id: p.id,
        cantidad: esChecklist ? null : Number(valores[p.id]),
        preparar: esChecklist ? valores[p.id] === true : false,
      }));

    const { error: e2 } = await supabase.from("inv_conteo_lineas").insert(lineas);
    setGuardando(false);

    if (e2) return setMensaje({ tipo: "error", texto: "El conteo se creó pero faltaron líneas. Revisa y vuelve a guardar." });
    setValores({});
    setMensaje({ tipo: "ok", texto: `Conteo de ${area.nombre} guardado. ${faltantes.length} productos para reponer.` });
  }

  if (cargando && !areas.length) return <div className="p-6 text-neutral-500">Cargando inventario…</div>;

  return (
    <div className="mx-auto max-w-3xl p-4 pb-32">
      <h1 className="text-2xl font-semibold text-neutral-900">Inventario</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {areas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAreaId(a.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              a.id === areaId ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {a.nombre}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-neutral-600">Tienda</span>
          <select
            value={tienda}
            onChange={(e) => setTienda(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          >
            {TIENDAS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-neutral-600">Empleado</span>
          <input
            value={empleado}
            onChange={(e) => setEmpleado(e.target.value)}
            placeholder="Quién hizo el conteo"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      {cargando ? (
        <p className="mt-8 text-neutral-500">Cargando productos…</p>
      ) : (
        grupos.map((g) => (
          <section key={g.id ?? "todos"} className="mt-8">
            {g.nombre && <h2 className="mb-2 text-sm font-semibold text-neutral-500">{g.nombre}</h2>}
            <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
              {g.items.map((p) => (
                <li
                  key={p.id}
                  className={`flex flex-wrap items-center gap-3 px-3 py-3 ${
                    bajoRedZone(p) ? "bg-red-50" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{p.nombre}</p>
                    {p.red_zone_texto && (
                      <p className="text-xs text-neutral-500">Red zone: {p.red_zone_texto}</p>
                    )}
                  </div>

                  {esChecklist ? (
                    <button
                      onClick={() => setValores((v) => ({ ...v, [p.id]: !v[p.id] }))}
                      className={`h-10 w-24 rounded-lg text-sm font-medium ${
                        valores[p.id] ? "bg-amber-500 text-white" : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {valores[p.id] ? "Preparar" : "Hay"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      {FRACCIONES.map((f) => (
                        <button
                          key={f.label}
                          onClick={() => setValores((v) => ({ ...v, [p.id]: f.value }))}
                          className={`h-9 w-9 rounded-md text-sm ${
                            valores[p.id] === f.value ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                      <input
                        type="number"
                        step="0.25"
                        inputMode="decimal"
                        value={valores[p.id] ?? ""}
                        onChange={(e) => setValores((v) => ({ ...v, [p.id]: e.target.value }))}
                        className="h-9 w-16 rounded-md border border-neutral-300 px-2 text-center"
                        aria-label={`Cantidad de ${p.nombre}`}
                      />
                      <span className="w-14 text-xs text-neutral-400">{p.unidad}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <div className="flex-1 text-sm">
            <p className="text-neutral-700">
              {contados} de {productos.length} contados
            </p>
            {faltantes.length > 0 && (
              <p className="text-red-600">{faltantes.length} para reponer</p>
            )}
            {mensaje && (
              <p className={mensaje.tipo === "error" ? "text-red-600" : "text-green-700"}>{mensaje.texto}</p>
            )}
          </div>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar conteo"}
          </button>
        </div>
      </div>
    </div>
  );
}