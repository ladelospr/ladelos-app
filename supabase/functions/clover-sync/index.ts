// ============================================================
// clover-sync — Edge Function (Deno)
//
// Trae las ventas de un dia desde la API de Clover.
//
// Por que existe esta funcion:
//   src/lib/clover.js llamaba a api.clover.com directamente desde el
//   navegador con VITE_CLOVER_API_TOKEN. El mismo problema que tenia
//   Recibos con la llave de Anthropic:
//   1. VITE_CLOVER_API_TOKEN viaja en el bundle: cualquiera que abra la
//      app puede leerlo y usarlo para leer (o si el scope del token lo
//      permite, tocar) los datos de venta del negocio en Clover.
//   2. api.clover.com no manda cabeceras CORS, asi que la llamada desde
//      el navegador de todas formas no puede completarse.
//   Aqui el token vive como secreto del proyecto y nunca sale del server.
//
// Deploy:
//   supabase secrets set CLOVER_API_TOKEN=...
//   supabase secrets set CLOVER_MERCHANT_ID=...
//   supabase functions deploy clover-sync
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@^2.116.0";

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

// YYYY-MM-DD, sin nada mas. Evita que un valor raro se cuele en la URL de
// Clover (ya que aqui no hay un ORM que lo escape por nosotros).
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Usa POST." }, 405);
  }

  // --- 1. Autenticacion --------------------------------------------------
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
    return json({ error: "Tu rol no puede sincronizar Clover." }, 403);
  }

  // --- 2. Validacion del cuerpo -------------------------------------------
  let cuerpo: { fecha?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "El cuerpo no es JSON valido." }, 400);
  }

  const fecha = cuerpo.fecha ?? "";
  if (!FECHA_VALIDA.test(fecha)) {
    return json({ error: "fecha debe venir como YYYY-MM-DD." }, 400);
  }

  const token = Deno.env.get("CLOVER_API_TOKEN");
  const merchantId = Deno.env.get("CLOVER_MERCHANT_ID");
  if (!token || !merchantId) {
    console.error("Faltan CLOVER_API_TOKEN o CLOVER_MERCHANT_ID en los secretos.");
    return json({ error: "El servidor no tiene configurada la conexion con Clover." }, 500);
  }

  // --- 3. Llamada a Clover -------------------------------------------------
  const startMs = new Date(fecha + "T00:00:00").getTime();
  const endMs = new Date(fecha + "T23:59:59").getTime();
  const url =
    `https://api.clover.com/v3/merchants/${merchantId}/line_items` +
    `?filter=createdTime>=${startMs}&filter=createdTime<=${endMs}&expand=item&limit=1000`;

  try {
    const respuesta = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!respuesta.ok) {
      console.error("Clover respondio", respuesta.status, await respuesta.text());
      return json(
        { error: `Clover respondió con un error (${respuesta.status}). Revisa el token y el merchant id.` },
        502,
      );
    }

    const datos = await respuesta.json();
    return json({ ok: true, fecha, items: datos.elements ?? [] });
  } catch (err) {
    console.error("Error llamando a Clover:", err);
    return json({ error: "No se pudo conectar con Clover. Intenta otra vez." }, 502);
  }
});
