// Shotstack render webhook receiver
// Configure in Shotstack dashboard or per-render with `callback` URL pointing here.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({} as any));
    console.log("Shotstack webhook payload:", JSON.stringify(payload));

    // Shotstack sends: { type, action, id (render id), status, url, ... }
    const renderId: string | undefined = payload.id || payload.response?.id;
    const status: string | undefined = payload.status || payload.response?.status;
    const url: string | undefined = payload.url || payload.response?.url;

    if (!renderId) {
      return new Response(JSON.stringify({ ok: false, error: "missing render id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    let dbStatus = "rendering";
    if (status === "done") dbStatus = "completed";
    else if (status === "failed") dbStatus = "failed";

    let outputUrl: string | null = null;

    if (status === "done" && url) {
      // Fetch & re-host in our storage
      try {
        const videoRes = await fetch(url);
        if (videoRes.ok) {
          const blob = await videoRes.blob();
          const fileName = `clips/${renderId}/${Date.now()}.mp4`;
          const upRes = await fetch(
            `${supabaseUrl}/storage/v1/object/video-clips/${fileName}`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "video/mp4" },
              body: blob,
            }
          );
          if (upRes.ok) outputUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${fileName}`;
          else outputUrl = url;
        } else {
          outputUrl = url;
        }
      } catch (e) {
        console.error("rehost error", e);
        outputUrl = url;
      }
    }

    const update: any = { render_status: dbStatus };
    if (outputUrl) update.output_url = outputUrl;

    const { error } = await supabase
      .from("video_clips")
      .update(update)
      .eq("shotstack_render_id", renderId);

    if (error) console.error("DB update error:", error);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("shotstack-webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
