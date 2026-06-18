// Webhook que recibe el callback de Shotstack para tournament_highlights
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({} as any));
    console.log("tournament-highlight-webhook payload:", JSON.stringify(payload));

    const renderId: string | undefined = payload.id || payload.response?.id;
    const status: string | undefined = payload.status || payload.response?.status;
    const url: string | undefined = payload.url || payload.response?.url;

    if (!renderId) {
      return new Response(JSON.stringify({ ok: false, error: "missing render id" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let dbStatus: string = "rendering";
    if (status === "done") dbStatus = "completed";
    else if (status === "failed") dbStatus = "failed";

    let outputUrl: string | null = null;

    if (status === "done" && url) {
      // Re-host en bucket público para evitar URLs caducas de Shotstack
      try {
        const videoRes = await fetch(url);
        if (videoRes.ok) {
          const blob = await videoRes.blob();
          const fileName = `${renderId}-${Date.now()}.mp4`;
          const upRes = await fetch(`${supabaseUrl}/storage/v1/object/tournament-highlights/${fileName}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "video/mp4" },
            body: blob,
          });
          if (upRes.ok) outputUrl = `${supabaseUrl}/storage/v1/object/public/tournament-highlights/${fileName}`;
          else outputUrl = url;
        } else {
          outputUrl = url;
        }
      } catch (e) {
        console.error("rehost error:", e);
        outputUrl = url;
      }
    }

    const update: any = { status: dbStatus };
    if (outputUrl) update.video_url = outputUrl;
    if (status === "failed") update.error_message = payload.error || "render failed";

    const { error } = await supabase
      .from("tournament_highlights")
      .update(update)
      .eq("shotstack_render_id", renderId);

    if (error) console.error("DB update error:", error);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("tournament-highlight-webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
