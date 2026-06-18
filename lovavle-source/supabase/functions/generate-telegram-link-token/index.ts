// Genera un link_token de Telegram para vincular un lead durante el registro.
// Público (verify_jwt=false) — usado por LiveGuest antes/después de OTP.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

let cachedBotUsername: string | null = null;

async function getBotUsername(): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername;
  if (!TG_TOKEN) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getMe`);
    const j = await r.json();
    if (j?.ok && j.result?.username) {
      cachedBotUsername = j.result.username as string;
      return cachedBotUsername;
    }
  } catch (e) {
    console.error("getMe failed:", e);
  }
  return null;
}

const ok = (data: Record<string, unknown>) =>
  new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const fail = (error: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Leer config
    const { data: cfgRow } = await admin
      .from("integration_settings")
      .select("config")
      .eq("service_name", "lead_system_config")
      .maybeSingle();

    const cfg = (cfgRow?.config ?? {}) as Record<string, unknown>;
    const enabled = !!cfg.telegram_enabled;
    const required = !!cfg.telegram_required_in_registration;

    if (!enabled) {
      return ok({ enabled: false, required: false });
    }

    const botUsername = await getBotUsername();
    if (!botUsername) {
      return fail("telegram_bot_unavailable", { enabled: true, required });
    }

    // 2) Parse body opcional
    let body: any = {};
    try { body = await req.json(); } catch {}
    const lead_id = body?.lead_id ?? null;
    const lead_email = body?.lead_email ?? null;
    const lead_phone = body?.lead_phone ?? null;

    // 3) Generar token y guardar
    const token = crypto.randomUUID().replace(/-/g, "");
    const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { error: insErr } = await admin.from("telegram_link_tokens").insert({
      token,
      lead_id,
      lead_email,
      lead_phone,
      expires_at,
    });
    if (insErr) {
      console.error("insert token failed:", insErr);
      return fail(insErr.message, { enabled, required });
    }

    const link = `https://t.me/${botUsername}?start=lead_${token}`;
    return ok({
      enabled: true,
      required,
      bot_username: botUsername,
      token,
      link,
      expires_at,
    });
  } catch (e) {
    return fail(String((e as Error)?.message ?? e));
  }
});
