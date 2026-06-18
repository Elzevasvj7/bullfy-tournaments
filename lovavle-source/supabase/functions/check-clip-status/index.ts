const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOTSTACK_API_URL = "https://api.shotstack.io/edit/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SHOTSTACK_API_KEY = Deno.env.get("SHOTSTACK_API_KEY");
    if (!SHOTSTACK_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Shotstack API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { render_id, clip_id } = await req.json();

    if (!render_id) {
      return new Response(
        JSON.stringify({ error: "render_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check render status with Shotstack
    const statusRes = await fetch(`${SHOTSTACK_API_URL}/render/${render_id}`, {
      headers: { "x-api-key": SHOTSTACK_API_KEY },
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.error("Shotstack status error:", statusRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to check render status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusData = await statusRes.json();
    const renderStatus = statusData.response?.status;
    const renderUrl = statusData.response?.url;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Map Shotstack status to our status
    let dbStatus: string;
    switch (renderStatus) {
      case "done":
        dbStatus = "completed";
        break;
      case "failed":
        dbStatus = "failed";
        break;
      case "rendering":
      case "queued":
      case "fetching":
      case "saving":
        dbStatus = "rendering";
        break;
      default:
        dbStatus = renderStatus || "unknown";
    }

    let outputUrl = null;

    // If render is done, download and upload to our storage
    if (renderStatus === "done" && renderUrl) {
      try {
        console.log("Downloading rendered clip from Shotstack...");
        const videoRes = await fetch(renderUrl);

        if (videoRes.ok) {
          const videoBlob = await videoRes.blob();
          const fileName = `clips/${clip_id || render_id}/${Date.now()}.mp4`;

          // Upload to Supabase storage
          const uploadRes = await fetch(
            `${supabaseUrl}/storage/v1/object/video-clips/${fileName}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "video/mp4",
              },
              body: videoBlob,
            }
          );

          if (uploadRes.ok) {
            outputUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${fileName}`;
            console.log("Clip uploaded to storage:", outputUrl);
          } else {
            console.error("Storage upload error:", await uploadRes.text());
            // Fall back to Shotstack URL
            outputUrl = renderUrl;
          }
        } else {
          console.error("Video download failed:", videoRes.status);
          outputUrl = renderUrl;
        }
      } catch (e) {
        console.error("Download/upload error:", e);
        outputUrl = renderUrl;
      }
    }

    // Update clip record in DB if clip_id provided
    if (clip_id) {
      const updateBody: any = { render_status: dbStatus };
      if (outputUrl) updateBody.output_url = outputUrl;

      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/video_clips?id=eq.${clip_id}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateBody),
        }
      );

      if (!updateRes.ok) {
        console.error("DB update error:", await updateRes.text());
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        render_id,
        clip_id: clip_id || null,
        status: dbStatus,
        output_url: outputUrl,
        shotstack_status: renderStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-clip-status error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
