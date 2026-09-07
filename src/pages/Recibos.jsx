import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const TIENDAS = ["Bayamón", "Cataño"];

export default function Recibos() {
  const [tienda, setTienda] = useState(TIENDAS[0]);
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [extraccion, setExtraccion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const fileInputRef = useRef(null);

  const handleImagenSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagen(file);
      const reader = new FileReader();
      reader.onload = (event) => setPreview(event.target?.result);
      reader.readAsDataURL(file);
    }
  };

  const procesarRecibo = async () => {
    if (!imagen) return setMensaje({ tipo: "error", texto: "Selecciona una imagen primero." });
    setProcesando(true);
    setMensaje(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result?.split(",")[1];
      
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-opus-4-1",
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: "image/jpeg", data: base64 },
                  },
                  {
                    type: "text",
                    text: `Extrae de este recibo:
1. Nombre del suplidor/empresa
2. Fecha (YYYY-MM-DD)
3. Subtotal (solo número)
4. Impuesto/IVU (solo número)
5. Total (solo número)
6. Lista de items (descripción, cantidad, precio unitario, total)

Responde en JSON con estructura:
{
  "suplidor": "nombre",
  "fecha": "YYYY-MM-DD",
  "subtotal": 0,
  "impuesto": 0,
  "total": 0,
  "items": [
    {"descripcion": "...", "cantidad": 1, "unitario": 0, "total": 0}
  ]
}

Si no encuentras algún dato, usa null.`,
                  },
                ],
              },
            ],
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Error en API");

        const texto = data.content[0]?.text || "";
        const jsonMatch = texto.match(/\{[\s\S]*\}/);
        const resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

        setExtraccion(resultado);
        setMensaje({ tipo: "ok", texto: "Recibo procesado. Verifica los datos antes de guardar." });
      } catch (err) {
        setMensaje({ tipo: "error", texto: `Error: ${err.message}` });
      }
      setProcesando(false);
    };
    reader.readAsDataURL(imagen);
  };

  const guardarRecibo = async () => {
    if (!extraccion) return;
    setGuardando(true);

    try {
      const { data: recibo, error: e1 } = await supabase
        .from("inv_recibos")
        .insert({
          tienda,
          fecha: extraccion.fecha || new Date().toISOString().split("T")[0],
          suplidor_texto: extraccion.suplidor,
          subtotal: extraccion.subtotal,
          impuesto: extraccion.impuesto,
          total: extraccion.total,
          procesado_ia: true,
        })
        .select()
        .single();

      if (e1) throw e1;

      if (extraccion.items?.length > 0) {
        const lineas = extraccion.items.map((item) => ({
          recibo_id: recibo.id,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          costo_unitario: item.unitario,
          total_linea: item.total,
        }));

        const { error: e2 } = await supabase.from("inv_recibo_lineas").insert(lineas);
        if (e2) throw e2;
      }

      setMensaje({ tipo: "ok", texto: `Recibo guardado. Total: $${extraccion.total || 0}` });
      setImagen(null);
      setPreview(null);
      setExtraccion(null);
      fileInputRef.current.value = "";
    } catch (err) {
      setMensaje({ tipo: "error", texto: `Error al guardar: ${err.message}` });
    }
    setGuardando(false);
  };

  return (
    <div className="mx-auto max-w-2xl p-4 pb-32">
      <h1 className="text-2xl font-semibold text-neutral-900">Recibos</h1>

      <div className="mt-4">
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
      </div>

      <div className="mt-6 rounded-lg border-2 border-dashed border-neutral-300 p-8 text-center">
        {preview ? (
          <img src={preview} alt="preview" className="mx-auto max-h-48 rounded" />
        ) : (
          <div className="text-neutral-500">
            <div className="text-4xl mb-2">📸</div>
            <p>Selecciona una foto del recibo</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImagenSelect}
          className="mt-4 hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Seleccionar imagen
        </button>
      </div>

      {imagen && (
        <button
          onClick={procesarRecibo}
          disabled={procesando}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {procesando ? "Procesando…" : "Procesar con Claude"}
        </button>
      )}

      {extraccion && (
        <div className="mt-8 space-y-4 rounded-lg border border-neutral-200 p-4">
          <h2 className="font-semibold text-neutral-900">Datos extraídos</h2>
          <div className="grid gap-2 text-sm">
            <p><strong>Suplidor:</strong> {extraccion.suplidor || "—"}</p>
            <p><strong>Fecha:</strong> {extraccion.fecha || "—"}</p>
            <p><strong>Subtotal:</strong> ${extraccion.subtotal || 0}</p>
            <p><strong>Impuesto:</strong> ${extraccion.impuesto || 0}</p>
            <p><strong>Total:</strong> ${extraccion.total || 0}</p>
          </div>
          {extraccion.items?.length > 0 && (
            <div>
              <p className="mb-2 font-medium">Items:</p>
              <ul className="space-y-1 text-xs">
                {extraccion.items.map((item, i) => (
                  <li key={i} className="text-neutral-600">
                    {item.descripcion} x{item.cantidad} @ ${item.unitario} = ${item.total}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={guardarRecibo}
            disabled={guardando}
            className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar recibo"}
          </button>
        </div>
      )}

      {mensaje && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${
          mensaje.tipo === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
        }`}>
          {mensaje.texto}
        </div>
      )}
    </div>
  );
}