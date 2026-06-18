// Generates an AI voiceover for a clip and produces a re-rendered video with
// the new audio replacing the original. ElevenLabs MP3 + Shotstack overlay.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const respond = (p: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const SHOTSTACK_KEY = Deno.env.get("SHOTSTACK_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { clip_id, voice_id, voice_name, text, language = "es" } = await req.json();
    if (!clip_id || !voice_id || !text) return respond({ ok: false, error: "clip_id, voice_id, text required" });

    // Auth
    const authHeader = req.headers.get("authorization") || "";
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    });
    if (!userRes.ok) return respond({ ok: false, error: "No autenticado" }, 401);
    const user = await userRes.json();

    // Load clip
    const cRes = await fetch(`${supabaseUrl}/rest/v1/video_clips?id=eq.${clip_id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const clip = (await cRes.json())?.[0];
    if (!clip || !clip.output_url) return respond({ ok: false, error: "Clip no encontrado o sin video" });

    // 1. Generate TTS via ElevenLabs (MP3)
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
        }),
      }
    );
    if (!ttsRes.ok) {
      const t = await ttsRes.text();
      return respond({ ok: false, error: `ElevenLabs error: ${t.substring(0, 200)}` });
    }
    const audioBuf = await ttsRes.arrayBuffer();

    // 2. Upload MP3 to storage
    const audioPath = `voiceovers/${user.id}/${Date.now()}-${clip_id}.mp3`;
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/clip-voiceovers/${audioPath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "audio/mpeg" },
      body: audioBuf,
    });
    if (!uploadRes.ok) {
      const t = await uploadRes.text();
      return respond({ ok: false, error: `Upload audio falló: ${t.substring(0, 150)}` });
    }
    const audio_url = `${supabaseUrl}/storage/v1/object/public/clip-voiceovers/${audioPath}`;

    // 3. Re-render with Shotstack: original video muted + new audio
    const duration = (clip.end_time || 0) - (clip.start_time || 0) || 30;
    const renderPayload = {
      timeline: {
        background: "#000000",
        soundtrack: { src: audio_url, effect: "fadeOut" },
        tracks: [
          {
            clips: [
              {
                asset: { type: "video", src: clip.output_url, volume: 0 },
                start: 0,
                length: duration,
              },
            ],
          },
        ],
      },
      output: { format: "mp4", resolution: "1080", aspectRatio: clip.format === "vertical" ? "9:16" : "16:9" },
    };

    const sRes = await fetch("https://api.shotstack.io/edit/v1/render", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": SHOTSTACK_KEY },
      body: JSON.stringify(renderPayload),
    });
    const sData = await sRes.json();
    if (!sRes.ok) return respond({ ok: false, error: "Shotstack falló", details: sData });
    const renderId = sData.response?.id;

    // 4. Save voiceover record
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/clip_voiceovers`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        clip_id, language, voice_id, voice_name,
        text_used: text, audio_url, shotstack_render_id: renderId, status: "rendering",
        created_by: user.id,
      }),
    });
    const saved = (await insertRes.json())?.[0];

    return respond({ ok: true, voiceover_id: saved?.id, render_id: renderId, audio_url });
  } catch (e) {
    console.error("generate-clip-voiceover error:", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
