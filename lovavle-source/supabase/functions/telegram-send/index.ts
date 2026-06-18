// Enviar mensaje de texto, foto o documento a un lead vía Telegram
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { lead_id, text, photo_url, document_url, caption } = await req.json();
    if (!lead_id) return new Response(JSON.stringify({ ok: false, error: "missing lead_id" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: lead, error } = await admin
      .from("stream_leads")
      .select("telegram_chat_id")
      .eq("id", lead_id)
      .maybeSingle();

    if (error || !lead?.telegram_chat_id) {
      return new Response(JSON.stringify({ ok: false, error: "lead not linked to telegram" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const chatId = lead.telegram_chat_id;
    let method = "sendMessage";
    let payload: Record<string, unknown> = { chat_id: chatId };
    let kind = "text";
    let body: string | null = text ?? null;
    let mediaUrl: string | null = null;

    if (photo_url) {
      method = "sendPhoto";
      payload = { chat_id: chatId, photo: photo_url, caption };
      kind = "photo";
      mediaUrl = photo_url;
      body = caption ?? null;
    } else if (document_url) {
      method = "sendDocument";
      payload = { chat_id: chatId, document: document_url, caption };
      kind = "document";
      mediaUrl = document_url;
      body = caption ?? null;
    } else {
      payload.text = text;
    }

    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await r.json();

    if (!result.ok) {
      return new Response(JSON.stringify({ ok: false, error: result.description ?? "telegram error" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("telegram_messages").insert({
      lead_id,
      direction: "out",
      kind,
      body,
      media_url: mediaUrl,
      tg_message_id: result.result?.message_id,
      sent_by: user.id,
    });

    return new Response(JSON.stringify({ ok: true, message_id: result.result?.message_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
