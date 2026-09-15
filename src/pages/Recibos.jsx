import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { TIENDAS } from "../lib/constants";

const HOY = () => new Date().toISOString().split("T")[0];

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

// Lee el File y devuelve solo la parte base64 (sin el prefijo data:...)
function leerBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target.result).split(",")[1]);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

export default function Recibos() {
  const [tienda, setTienda] = useState(TIENDAS[0]);
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  // Datos extraidos, editables antes de guardar.
  const [form, setForm] = useState(null);
  const fileInputRef = useRef(null);

  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    const { data, error } = await supabase
      .from("inv_recibos")
      .select("id, tienda, fecha, suplidor_texto, subtotal, impuesto, total, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (!error) setHistorial(data ?? []);
    setCargandoHistorial(false);
  }, []);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  function limpiar() {
    setImagen(null);
    setPreview(null);
    setForm(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function seleccionarImagen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagen(file);
    setForm(null);
    setMensaje(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function procesarRecibo() {
    if (!imagen) {
      return setMensaje({ tipo: "error", texto: "Selecciona una foto del recibo primero." });
    }
    setProcesando(true);
    setMensaje(null);

    try {
      const base64 = await leerBase64(imagen);

      // La llave de Anthropic vive en el Edge Function, no en el navegador.
      const { data, error } = await supabase.functions.invoke("process-receipt", {
        body: { imagen_base64: base64, media_type: imagen.type || "image/jpeg" },
      });

      // Cuando el Edge Function responde 4xx/5xx, supabase-js tira el cuerpo
      // dentro de error.context; ahi esta el mensaje util para el usuario.
      if (error) {
        let detalle = error.message;
        try {
          const cuerpo = await error.context?.json();
          if (cuerpo?.error) detalle = cuerpo.error;
        } catch { /* la respuesta no era JSON */ }
        throw new Error(detalle);
      }
      if (!data?.datos) throw new Error("El servidor no devolvio datos del recibo.");

      const d = data.datos;
      setForm({
        suplidor: d.suplidor ?? "",
        fecha: d.fecha ?? HOY(),
        subtotal: d.subtotal ?? "",
        impuesto: d.impuesto ?? "",
        total: d.total ?? "",
        items: d.items ?? [],
      });
      setMensaje({ tipo: "ok", texto: "Recibo leido. Revisa y corrige antes de guardar." });
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message });
    } finally {
      setProcesando(false);
    }
  }

  // Devuelve un texto de error, o null si todo esta bien.
  function validar(f) {
    if (!f.suplidor?.trim()) return "Escribe el nombre del suplidor.";
    const total = Number(f.total);
    if (!Number.isFinite(total) || total <= 0) return "El total tiene que ser mayor que cero.";
    if (!f.fecha) return "Escribe la fecha del recibo.";
    return null;
  }

  async function guardarRecibo() {
    if (!form) return;
    const problema = validar(form);
    if (problema) return setMensaje({ tipo: "error", texto: problema });

    setGuardando(true);
    setMensaje(null);

    const numero = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

    try {
      const { data: recibo, error: e1 } = await supabase
        .from("inv_recibos")
        .insert({
          tienda,
          fecha: form.fecha,
          suplidor_texto: form.suplidor.trim(),
          subtotal: numero(form.subtotal),
          impuesto: numero(form.impuesto),
          total: Number(form.total),
          procesado_ia: true,
        })
        .select()
        .single();
      if (e1) throw e1;

      const lineas = (form.items ?? [])
        .filter((i) => i.descripcion?.trim())
        .map((i) => ({
          recibo_id: recibo.id,
          descripcion: i.descripcion.trim(),
          cantidad: numero(i.cantidad),
          costo_unitario: numero(i.unitario),
          total_linea: numero(i.total),
        }));

      if (lineas.length) {
        const { error: e2 } = await supabase.from("inv_recibo_lineas").insert(lineas);
        if (e2) {
          // Sin las lineas el recibo queda a medias, asi que se deshace la
          // cabecera en vez de dejar un registro huerfano en la base.
          await supabase.from("inv_recibos").delete().eq("id", recibo.id);
          throw new Error("No se guardaron las lineas del recibo. No se guardo nada.");
        }
      }

      setMensaje({
        tipo: "ok",
        texto: `Recibo guardado: ${form.suplidor.trim()} — ${money(form.total)}.`,
      });
      limpiar();
      cargarHistorial();
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message || "No se pudo guardar el recibo." });
    } finally {
      setGuardando(false);
    }
  }

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const setItem = (idx, campo) => (e) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [campo]: e.target.value } : it)),
    }));

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Recibos</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Toma la foto del recibo del suplidor y el sistema extrae los datos.
      </p>

      <label className="mt-4 block max-w-xs">
        <span className="text-sm text-neutral-600">Tienda</span>
        <select
          value={tienda}
          onChange={(e) => setTienda(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        >
          {TIENDAS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>

      <div className="mt-6 rounded-xl border-2 border-dashed border-neutral-300 bg-white p-8 text-center">
        {preview ? (
          <img src={preview} alt="Vista previa del recibo" className="mx-auto max-h-56 rounded" />
        ) : (
          <div className="text-neutral-500">
            <div className="mb-2 text-4xl">📸</div>
            <p>Selecciona una foto del recibo</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={seleccionarImagen}
          className="hidden"
        />
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            {preview ? "Cambiar imagen" : "Seleccionar imagen"}
          </button>
          {preview && (
            <button onClick={limpiar} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-700">
              Quitar
            </button>
          )}
        </div>
      </div>

      {imagen && !form && (
        <button
          onClick={procesarRecibo}
          disabled={procesando}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {procesando ? "Leyendo el recibo…" : "Procesar con IA"}
        </button>
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

      {form && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold text-neutral-900">Datos extraídos</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Corrige lo que haga falta. Se guarda lo que veas aquí.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-neutral-600">Suplidor</span>
              <input
                value={form.suplidor}
                onChange={set("suplidor")}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-600">Fecha</span>
              <input
                type="date"
                value={form.fecha}
                onChange={set("fecha")}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-600">Subtotal</span>
              <input
                type="number" step="0.01" inputMode="decimal"
                value={form.subtotal}
                onChange={set("subtotal")}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-600">Impuesto (IVU)</span>
              <input
                type="number" step="0.01" inputMode="decimal"
                value={form.impuesto}
                onChange={set("impuesto")}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs text-neutral-600">Total</span>
              <input
                type="number" step="0.01" inputMode="decimal"
                value={form.total}
                onChange={set("total")}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-semibold"
              />
            </label>
          </div>

          {form.items.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {form.items.length} líneas
              </p>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      value={item.descripcion ?? ""}
                      onChange={setItem(i, "descripcion")}
                      className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                      aria-label={`Descripción de la línea ${i + 1}`}
                    />
                    <input
                      type="number" step="0.01" inputMode="decimal"
                      value={item.cantidad ?? ""}
                      onChange={setItem(i, "cantidad")}
                      className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-center text-sm"
                      aria-label={`Cantidad de la línea ${i + 1}`}
                    />
                    <input
                      type="number" step="0.01" inputMode="decimal"
                      value={item.unitario ?? ""}
                      onChange={setItem(i, "unitario")}
                      className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-center text-sm"
                      aria-label={`Costo unitario de la línea ${i + 1}`}
                    />
                    <input
                      type="number" step="0.01" inputMode="decimal"
                      value={item.total ?? ""}
                      onChange={setItem(i, "total")}
                      className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-center text-sm"
                      aria-label={`Total de la línea ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={guardarRecibo}
            disabled={guardando}
            className="mt-5 w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar recibo"}
          </button>
        </div>
      )}

      {/* ---- Historial ---- */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-neutral-900">Últimos 10 recibos</h2>
        {cargandoHistorial ? (
          <p className="mt-2 text-sm text-neutral-500">Cargando…</p>
        ) : historial.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Todavía no hay recibos guardados.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Tienda</th>
                  <th className="px-3 py-2">Suplidor</th>
                  <th className="px-3 py-2 text-right">Impuesto</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2">{r.fecha}</td>
                    <td className="px-3 py-2 text-neutral-600">{r.tienda}</td>
                    <td className="px-3 py-2">{r.suplidor_texto || "—"}</td>
                    <td className="px-3 py-2 text-right text-neutral-600">{money(r.impuesto)}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
