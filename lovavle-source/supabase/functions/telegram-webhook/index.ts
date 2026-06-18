// Telegram webhook — recibe updates del bot (verify_jwt = false)
// Vincula /start lead_<token> y guarda mensajes entrantes en telegram_messages
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function deriveSecret(): Promise<string> {
  const data = new TextEncoder().encode(`telegram-webhook:${TG_TOKEN}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function tgCall(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const expected = await deriveSecret();
    const actual = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (actual !== expected) {
      console.warn("Invalid webhook secret");
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const update = await req.json();
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const message = update.message ?? update.edited_message;
    if (!message?.chat?.id) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username ?? null;
    const text: string = message.text ?? "";

    // Handle /start lead_<token>
    if (text.startsWith("/start")) {
      const param = text.split(" ")[1]?.trim();
      if (param?.startsWith("lead_")) {
        const token = param.slice(5);
        const { data: tokenRow } = await supabase
          .from("telegram_link_tokens")
          .select("*")
          .eq("token", token)
          .is("consumed_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (tokenRow) {
          // Vincular: si tiene lead_id ya, usar ese; si no, buscar por email/phone
          let leadId = tokenRow.lead_id as string | null;
          if (!leadId && (tokenRow.lead_email || tokenRow.lead_phone)) {
            const { data: lead } = await supabase
              .from("stream_leads")
              .select("id")
              .or(`email.eq.${tokenRow.lead_email ?? ""},phone.eq.${tokenRow.lead_phone ?? ""}`)
              .maybeSingle();
            leadId = lead?.id ?? null;
          }

          if (leadId) {
            await supabase.from("stream_leads").update({
              telegram_chat_id: chatId,
              telegram_user_id: userId,
              telegram_username: username,
              telegram_linked_at: new Date().toISOString(),
              telegram_last_seen_at: new Date().toISOString(),
            }).eq("id", leadId);

            await supabase.from("telegram_link_tokens").update({
              consumed_at: new Date().toISOString(),
              lead_id: leadId,
            }).eq("token", token);

            await tgCall("sendMessage", {
              chat_id: chatId,
              text: "✅ ¡Listo! Tu cuenta de Telegram quedó vinculada. Un asesor de Bullfy se comunicará contigo por aquí.",
            });
          } else {
            await tgCall("sendMessage", { chat_id: chatId, text: "Token válido pero no pudimos identificar tu cuenta. Contacta a soporte." });
          }
        } else {
          await tgCall("sendMessage", { chat_id: chatId, text: "Bienvenido a Bullfy. Tu enlace de vinculación expiró o no es válido." });
        }
      } else {
        await tgCall("sendMessage", { chat_id: chatId, text: "Bienvenido a Bullfy 👋" });
      }
    }

    // Guardar mensaje entrante si pertenece a un lead vinculado
    const { data: lead } = await supabase
      .from("stream_leads")
      .select("id")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();

    if (lead) {
      let kind = "text";
      let body: string | null = text || message.caption || null;
      let mediaUrl: string | null = null;

      if (message.voice) kind = "voice";
      else if (message.photo) kind = "photo";
      else if (message.document) kind = "document";
      else if (message.sticker) kind = "sticker";
      else if (!text) kind = "other";

      await supabase.from("telegram_messages").upsert({
        lead_id: lead.id,
        direction: "in",
        kind,
        body,
        media_url: mediaUrl,
        tg_message_id: message.message_id,
        tg_update_id: update.update_id,
      }, { onConflict: "tg_update_id" });

      await supabase.from("stream_leads").update({
        telegram_last_seen_at: new Date().toISOString(),
      }).eq("id", lead.id);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("telegram-webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
