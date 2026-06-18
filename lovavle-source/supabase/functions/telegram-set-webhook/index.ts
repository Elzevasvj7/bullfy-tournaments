// Registrar webhook en Telegram (one-time, requiere auth admin)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function deriveSecret(): Promise<string> {
  const data = new TextEncoder().encode(`telegram-webhook:${TG_TOKEN}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
    const secret = await deriveSecret();

    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message", "edited_message"],
        drop_pending_updates: true,
      }),
    });
    const result = await r.json();

    const info = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getMe`).then(r => r.json());

    return new Response(JSON.stringify({ ok: true, setWebhook: result, bot: info.result, webhookUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
