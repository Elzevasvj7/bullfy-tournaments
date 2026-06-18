// Enviar nota de voz TTS (ElevenLabs) a un lead vía Telegram sendVoice
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { lead_id, text, voice_id, stability = 0.5, similarity_boost = 0.75 } = await req.json();
    if (!lead_id || !text || !voice_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing fields" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: lead } = await admin
      .from("stream_leads")
      .select("telegram_chat_id")
      .eq("id", lead_id)
      .maybeSingle();

    if (!lead?.telegram_chat_id) {
      return new Response(JSON.stringify({ ok: false, error: "lead not linked to telegram" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Generar MP3 con ElevenLabs
    const ttsR = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability, similarity_boost, use_speaker_boost: true },
      }),
    });
    if (!ttsR.ok) {
      const err = await ttsR.text();
      return new Response(JSON.stringify({ ok: false, error: `tts: ${err}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const audioBuf = await ttsR.arrayBuffer();

    // 2. Subir a Storage
    const fileName = `${lead_id}/${Date.now()}.mp3`;
    const { error: upErr } = await admin.storage
      .from("telegram-voice-notes")
      .upload(fileName, audioBuf, { contentType: "audio/mpeg", upsert: true });
    if (upErr) {
      return new Response(JSON.stringify({ ok: false, error: `upload: ${upErr.message}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: urlData } = admin.storage.from("telegram-voice-notes").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // 3. Enviar a Telegram como audio (sendAudio acepta MP3 vía URL)
    const tgR = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: lead.telegram_chat_id,
        audio: publicUrl,
        title: "Nota de voz",
        performer: "Bullfy",
      }),
    });
    const tgResult = await tgR.json();
    if (!tgResult.ok) {
      return new Response(JSON.stringify({ ok: false, error: tgResult.description ?? "telegram error" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("telegram_messages").insert({
      lead_id,
      direction: "out",
      kind: "voice",
      body: text,
      media_url: publicUrl,
      voice_id_used: voice_id,
      tg_message_id: tgResult.result?.message_id,
      sent_by: user.id,
    });

    return new Response(JSON.stringify({ ok: true, media_url: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
