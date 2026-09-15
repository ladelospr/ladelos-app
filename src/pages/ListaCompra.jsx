import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { TIENDAS } from "../lib/constants";

// La vista inv_lista_compra vive en Supabase y ya hace el calculo de que
// hay que pedir. Como los nombres de sus columnas han cambiado un par de
// veces, cada campo logico se busca por varios alias en vez de asumir uno:
// asi la pantalla no se cae si la vista se renombra por dentro.
const ALIAS = {
  tienda:   ["tienda"],
  area:     ["area", "area_nombre", "nombre_area"],
  producto: ["producto", "producto_nombre", "nombre"],
  unidad:   ["unidad"],
  en_mano:  ["en_mano", "cantidad", "existencia"],
  red_zone: ["red_zone", "red_zone_valor"],
  par:      ["par", "par_valor", "par_nivel"],
  pedir:    ["pedir", "cantidad_pedir", "sugerido"],
  origen:   ["origen", "fuente"],
};

function leer(fila, campo) {
  for (const alias of ALIAS[campo]) {
    if (fila[alias] !== undefined && fila[alias] !== null) return fila[alias];
  }
  return null;
}

function normalizar(fila, i) {
  return {
    key: fila.id ?? `${leer(fila, "producto") ?? "item"}-${i}`,
    tienda: leer(fila, "tienda"),
    area: leer(fila, "area") ?? "Sin área",
    producto: leer(fila, "producto") ?? "—",
    unidad: leer(fila, "unidad") ?? "",
    en_mano: leer(fila, "en_mano"),
    red_zone: leer(fila, "red_zone"),
    par: leer(fila, "par"),
    pedir: leer(fila, "pedir"),
    origen: leer(fila, "origen") ?? "conteo",
  };
}

const ORIGEN_LABEL = {
  conteo: "Conteo",
  dos_cajas: "Dos cajas",
  senal: "Señal",
};

const num = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

function descargarCSV(nombre, filas) {
  const escapa = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cabecera = ["Área", "Producto", "En mano", "Red zone", "Par", "Pedir", "Unidad", "Origen"];
  const cuerpo = filas.map((f) =>
    [f.area, f.producto, f.en_mano, f.red_zone, f.par, f.pedir, f.unidad, ORIGEN_LABEL[f.origen] ?? f.origen]
      .map(escapa)
      .join(","),
  );
  // El BOM es lo que hace que Excel abra el archivo con los acentos bien.
  const csv = "﻿" + [cabecera.map(escapa).join(","), ...cuerpo].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // navigator.clipboard solo existe en https. En la tablet de la tienda
    // sobre http hace falta el truco del textarea.
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export default function ListaCompra() {
  const [tienda, setTienda] = useState(TIENDAS[0]);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroOrigen, setFiltroOrigen] = useState("todos");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error } = await supabase.from("inv_lista_compra").select("*");
    if (error) {
      setError("No se pudo cargar la lista de compra. Revisa que exista la vista inv_lista_compra.");
      setFilas([]);
    } else {
      setFilas((data ?? []).map(normalizar));
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Al cambiar de tienda los filtros anteriores pueden no existir aqui.
  useEffect(() => {
    setFiltroArea("todas");
    setFiltroOrigen("todos");
    setMensaje(null);
  }, [tienda]);

  const deLaTienda = useMemo(
    // Si la vista no trae columna tienda, se muestra todo en ambas pestañas.
    () => filas.filter((f) => f.tienda == null || f.tienda === tienda),
    [filas, tienda],
  );

  const areas = useMemo(
    () => [...new Set(deLaTienda.map((f) => f.area))].sort((a, b) => a.localeCompare(b, "es")),
    [deLaTienda],
  );

  const origenes = useMemo(
    () => [...new Set(deLaTienda.map((f) => f.origen))].sort(),
    [deLaTienda],
  );

  const visibles = useMemo(
    () =>
      deLaTienda
        .filter((f) => filtroArea === "todas" || f.area === filtroArea)
        .filter((f) => filtroOrigen === "todos" || f.origen === filtroOrigen)
        .sort((a, b) => a.area.localeCompare(b.area, "es") || a.producto.localeCompare(b.producto, "es")),
    [deLaTienda, filtroArea, filtroOrigen],
  );

  // Texto para pegar en WhatsApp al proveedor.
  const textoWhatsApp = useMemo(() => {
    const porArea = visibles.reduce((acc, f) => {
      (acc[f.area] ??= []).push(f);
      return acc;
    }, {});
    const hoy = new Date().toLocaleDateString("es-PR");
    const lineas = [`*Ladelos ${tienda}* — pedido ${hoy}`, ""];
    for (const [area, items] of Object.entries(porArea)) {
      lineas.push(`*${area}*`);
      for (const f of items) {
        const cantidad = f.pedir === null ? "" : ` — ${f.pedir}${f.unidad ? " " + f.unidad : ""}`;
        lineas.push(`• ${f.producto}${cantidad}`);
      }
      lineas.push("");
    }
    lineas.push(`Total: ${visibles.length} items`);
    return lineas.join("\n");
  }, [visibles, tienda]);

  async function copiar() {
    if (!visibles.length) return setMensaje({ tipo: "error", texto: "No hay nada que copiar." });
    const ok = await copiarAlPortapapeles(textoWhatsApp);
    setMensaje(
      ok
        ? { tipo: "ok", texto: "Lista copiada. Pégala en WhatsApp." }
        : { tipo: "error", texto: "El navegador no dejó copiar. Selecciona el texto a mano." },
    );
  }

  function exportar() {
    if (!visibles.length) return setMensaje({ tipo: "error", texto: "No hay nada que exportar." });
    const fecha = new Date().toISOString().split("T")[0];
    descargarCSV(`lista-compra-${tienda.toLowerCase()}-${fecha}.csv`, visibles);
  }

  async function marcarEnviado() {
    if (!visibles.length) return setMensaje({ tipo: "error", texto: "No hay items para enviar." });
    setEnviando(true);
    setMensaje(null);
    const { error } = await supabase.from("inv_ordenes_compra").insert({
      tienda,
      fecha: new Date().toISOString().split("T")[0],
      items_json: visibles.map(({ key, ...resto }) => resto),
      enviado: true,
    });
    setEnviando(false);
    setMensaje(
      error
        ? { tipo: "error", texto: `No se registró la orden: ${error.message}` }
        : { tipo: "ok", texto: `Orden de ${visibles.length} items registrada como enviada.` },
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Lista de compra</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Se arma sola con el último conteo de inventario de cada área.
      </p>

      {/* Pestañas de tienda */}
      <div className="mt-4 flex gap-2">
        {TIENDAS.map((t) => (
          <button
            key={t}
            onClick={() => setTienda(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              t === tienda ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Resumen */}
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <span className="text-2xl font-semibold text-neutral-900">{visibles.length}</span>
        <span className="ml-2 text-sm text-neutral-600">
          items para pedir en {tienda}
          {visibles.length !== deLaTienda.length && ` (de ${deLaTienda.length} sin filtrar)`}
        </span>
      </div>

      {/* Filtros y acciones */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-neutral-600">Área</span>
          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="todas">Todas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-neutral-600">Origen</span>
          <select
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="todos">Todos</option>
            {origenes.map((o) => (
              <option key={o} value={o}>{ORIGEN_LABEL[o] ?? o}</option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={copiar} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white">
            Copiar para WhatsApp
          </button>
          <button onClick={exportar} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700">
            Exportar Excel
          </button>
          <button
            onClick={marcarEnviado}
            disabled={enviando}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {enviando ? "Guardando…" : "Marcar como enviado"}
          </button>
          <button onClick={cargar} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-700">
            Refrescar
          </button>
        </div>
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
      {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Tabla */}
      {cargando ? (
        <p className="mt-8 text-neutral-500">Cargando lista…</p>
      ) : visibles.length === 0 ? (
        <p className="mt-8 rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
          No hay nada que pedir en {tienda} con estos filtros.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2 text-right">En mano</th>
                <th className="px-3 py-2 text-right">Red zone</th>
                <th className="px-3 py-2 text-right">Par</th>
                <th className="px-3 py-2 text-right">Pedir</th>
                <th className="px-3 py-2">Origen</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.key} className="border-b border-neutral-100 last:border-0">
                  <td className="px-3 py-2 text-neutral-600">{f.area}</td>
                  <td className="px-3 py-2 font-medium text-neutral-900">{f.producto}</td>
                  <td className="px-3 py-2 text-right">{num(f.en_mano)}</td>
                  <td className="px-3 py-2 text-right text-neutral-500">{num(f.red_zone)}</td>
                  <td className="px-3 py-2 text-right text-neutral-500">{num(f.par)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-neutral-900">
                    {num(f.pedir)} {f.unidad}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        f.origen === "conteo" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {ORIGEN_LABEL[f.origen] ?? f.origen}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
