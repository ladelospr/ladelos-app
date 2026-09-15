// ============================================================
// process-receipt — Edge Function (Deno)
//
// Recibe la foto de un recibo en base64, la manda a Claude y
// devuelve los datos estructurados (suplidor, fecha, totales, lineas).
//
// Por que existe esta funcion:
//   El front-end NO puede llamar a api.anthropic.com directamente.
//   1. La llave de Anthropic quedaria publicada en el bundle de Vite
//      (todo lo que empieza con VITE_ viaja al navegador).
//   2. api.anthropic.com no manda cabeceras CORS para el navegador.
//   Aqui la llave vive como secreto del proyecto y nunca sale del server.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy process-receipt
// ============================================================

import Anthropic from "npm:@anthropic-ai/sdk@^0.125.0";
import { createClient } from "npm:@supabase/supabase-js@^2.116.0";

const MODELO = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-opus-5";

// 10 MB de base64 ~ 7.5 MB de imagen. Suficiente para una foto de celular.
const MAX_BASE64_CHARS = 10 * 1024 * 1024;
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// El esquema que Claude tiene que llenar. Con strict:true la API garantiza
// que los argumentos validan contra este schema, asi que no hay que andar
// buscando JSON dentro de un bloque de texto.
const HERRAMIENTA = {
  name: "registrar_recibo",
  description:
    "Registra los datos extraidos de la foto de un recibo de suplidor.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      suplidor: {
        type: ["string", "null"],
        description:
          "Nombre del suplidor o empresa que emite el recibo, tal como aparece impreso.",
      },
      fecha: {
        type: ["string", "null"],
        description: "Fecha del recibo en formato YYYY-MM-DD.",
      },
      subtotal: {
        type: ["number", "null"],
        description: "Subtotal antes de impuestos.",
      },
      impuesto: {
        type: ["number", "null"],
        description: "Impuesto / IVU cobrado.",
      },
      total: {
        type: ["number", "null"],
        description: "Total final que se pago.",
      },
      items: {
        type: "array",
        description: "Una entrada por cada linea del recibo.",
        items: {
          type: "object",
          properties: {
            descripcion: { type: "string" },
            cantidad: { type: ["number", "null"] },
            unitario: { type: ["number", "null"] },
            total: { type: ["number", "null"] },
          },
          required: ["descripcion", "cantidad", "unitario", "total"],
          additionalProperties: false,
        },
      },
    },
    required: ["suplidor", "fecha", "subtotal", "impuesto", "total", "items"],
    additionalProperties: false,
  },
} as const;

const INSTRUCCIONES = `Eres el asistente de contabilidad de Ladelos Pastelillos (Puerto Rico).
Te mandan la foto de un recibo de un suplidor y tienes que pasarlo a datos.

Reglas:
- Llama SIEMPRE a la herramienta registrar_recibo, una sola vez.
- Los montos van como numeros, sin simbolo de dolar, sin comas de miles y con punto decimal.
- La fecha va en formato YYYY-MM-DD. Si el recibo usa DD/MM/YY o MM/DD/YY, mira el contexto
  del recibo para decidir; los recibos son de Puerto Rico.
- Si un dato no aparece o no se puede leer, pon null. No lo inventes ni lo estimes.
- En items pon una entrada por cada linea de producto. No incluyas subtotal,
  impuesto ni total como si fueran items.
- El IVU de Puerto Rico normalmente aparece como IVU, TAX, SALES TAX o IMPUESTO.`;

function limpiarNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const n = Number(valor.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Usa POST." }, 405);
  }

  // --- 1. Autenticacion -------------------------------------------------
  // Sin esto cualquiera con la URL podria gastar la cuota de Anthropic.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Falta el token de sesion." }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return json({ error: "Sesion invalida o expirada." }, 401);
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!perfil || !["admin", "supervisor"].includes(perfil.rol)) {
    return json({ error: "Tu rol no puede procesar recibos." }, 403);
  }

  // --- 2. Validacion del cuerpo ----------------------------------------
  let cuerpo: { imagen_base64?: string; media_type?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "El cuerpo no es JSON valido." }, 400);
  }

  const base64 = (cuerpo.imagen_base64 ?? "").replace(
    /^data:[^;]+;base64,/,
    "",
  );
  const mediaType = cuerpo.media_type ?? "image/jpeg";

  if (!base64) {
    return json({ error: "Falta imagen_base64." }, 400);
  }
  if (base64.length > MAX_BASE64_CHARS) {
    return json(
      { error: "La imagen es muy grande. Toma la foto con menos resolucion." },
      413,
    );
  }
  if (!MEDIA_TYPES.includes(mediaType)) {
    return json(
      { error: `Formato no soportado: ${mediaType}. Usa JPEG, PNG o WEBP.` },
      400,
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY no esta configurada en los secretos.");
    return json({ error: "El servidor no tiene configurada la llave de IA." }, 500);
  }

  // --- 3. Extraccion con Claude ----------------------------------------
  const anthropic = new Anthropic({ apiKey });

  try {
    const respuesta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 4096,
      system: INSTRUCCIONES,
      // effort bajo: leer un recibo no necesita razonamiento profundo y
      // asi cada foto cuesta menos.
      output_config: { effort: "low" },
      tools: [HERRAMIENTA],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text:
                "Extrae los datos de este recibo con la herramienta registrar_recibo.",
            },
          ],
        },
      ],
    });

    if (respuesta.stop_reason === "refusal") {
      return json(
        { error: "El modelo no pudo procesar esta imagen. Toma otra foto." },
        422,
      );
    }

    const bloque = respuesta.content.find(
      (b) => b.type === "tool_use" && b.name === "registrar_recibo",
    );

    if (!bloque || bloque.type !== "tool_use") {
      return json(
        {
          error:
            "No se reconocio ningun recibo en la imagen. Verifica que se vea completo y enfocado.",
        },
        422,
      );
    }

    const bruto = bloque.input as Record<string, unknown>;
    const items = Array.isArray(bruto.items) ? bruto.items : [];

    const datos = {
      suplidor: typeof bruto.suplidor === "string" ? bruto.suplidor.trim() : null,
      fecha: typeof bruto.fecha === "string" ? bruto.fecha : null,
      subtotal: limpiarNumero(bruto.subtotal),
      impuesto: limpiarNumero(bruto.impuesto),
      total: limpiarNumero(bruto.total),
      items: items.map((item) => {
        const i = item as Record<string, unknown>;
        return {
          descripcion: typeof i.descripcion === "string" ? i.descripcion.trim() : "",
          cantidad: limpiarNumero(i.cantidad),
          unitario: limpiarNumero(i.unitario),
          total: limpiarNumero(i.total),
        };
      }).filter((i) => i.descripcion !== ""),
    };

    return json({ ok: true, datos, modelo: respuesta.model });
  } catch (err) {
    // El mensaje crudo de Anthropic puede traer detalles internos:
    // se registra en los logs, pero al cliente solo le llega algo generico.
    console.error("Error llamando a Anthropic:", err);
    const status = (err as { status?: number })?.status;
    if (status === 401) {
      return json({ error: "La llave de IA del servidor no es valida." }, 500);
    }
    if (status === 429) {
      return json({ error: "Demasiadas peticiones. Espera un momento." }, 429);
    }
    return json({ error: "No se pudo procesar el recibo. Intenta otra vez." }, 502);
  }
});
