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
    let userCanRemoveBranding = false;
    let userTier: string = "free";
    const SHOTSTACK_API_KEY = Deno.env.get("SHOTSTACK_API_KEY");
    if (!SHOTSTACK_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Shotstack API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Usage enforcement
    const { user_id } = (() => {
      try {
        const authHeader = req.headers.get("authorization") || "";
        const token = authHeader.replace("Bearer ", "");
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          return { user_id: payload.sub };
        }
      } catch {}
      return { user_id: null };
    })();

    if (user_id) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: access } = await supabaseAdmin
        .from("video_studio_access")
        .select("tier, enabled, monthly_clip_limit, can_remove_branding")
        .eq("user_id", user_id)
        .maybeSingle();

      if (access && !access.enabled) {
        return new Response(
          JSON.stringify({ error: "Video Studio access is disabled for your account" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (access) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabaseAdmin
          .from("video_studio_usage_log")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user_id)
          .eq("action", "clip")
          .gte("created_at", startOfMonth.toISOString());

        if ((count || 0) >= access.monthly_clip_limit) {
          return new Response(
            JSON.stringify({ error: "Monthly clip limit reached", limit: access.monthly_clip_limit, used: count }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log usage
        await supabaseAdmin.from("video_studio_usage_log").insert({
          user_id,
          action: "clip",
          credits_used: 1,
          metadata: { tier: access.tier },
        });

        userTier = access.tier || "free";
        if (access.can_remove_branding) {
          userCanRemoveBranding = true;
        }
      }
    }

    const {
      source_url,
      start_time,
      end_time,
      format = "vertical",
      has_subtitles = true,
      subtitle_text,
      title,
      source_type = "upload",
      source_id,
      created_by,
      add_watermark = true,
      portal_id,
    } = await req.json();

    // Load brand config for portal (if any)
    let brand: any = null;
    if (portal_id) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const sbAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: brandRow } = await sbAdmin
          .from("portal_video_brand_config")
          .select("*")
          .eq("portal_id", portal_id)
          .maybeSingle();
        brand = brandRow;
      } catch (e) {
        console.warn("Could not load portal brand config:", e);
      }
    }

    if (!source_url || start_time === undefined || end_time === undefined) {
      return new Response(
        JSON.stringify({ error: "source_url, start_time, and end_time are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clipDuration = end_time - start_time;
    if (clipDuration <= 0 || clipDuration > 120) {
      return new Response(
        JSON.stringify({ error: "Clip duration must be between 1 and 120 seconds" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Shotstack timeline
    const isVertical = format === "vertical";
    const width = isVertical ? 1080 : 1920;
    const height = isVertical ? 1920 : 1080;

    // Tracks array (bottom to top rendering)
    const tracks: any[] = [];

    // Main video clip
    const videoClip: any = {
      asset: {
        type: "video",
        src: source_url,
        trim: start_time,
      },
      start: 0,
      length: clipDuration,
      fit: isVertical ? "cover" : "contain",
    };

    // For vertical: apply crop to center
    if (isVertical) {
      videoClip.scale = 1;
      videoClip.position = "center";
    }

    tracks.push({ clips: [videoClip] });

    // Subtitle styling from brand config (with safe defaults)
    const subFont = brand?.subtitle_font || "Montserrat";
    const subSize = brand?.subtitle_font_size || 42;
    const subColor = brand?.subtitle_color || "white";
    const subBg = brand?.subtitle_bg_color || "rgba(0,0,0,0.5)";
    const subPos = brand?.subtitle_position || "bottom";
    const watermarkText = brand?.watermark_text || "Powered by Bullfy";

    // Subtitle track
    if (has_subtitles && subtitle_text) {
      const subtitleLines = parseSubtitleSegments(subtitle_text, clipDuration);
      const subtitleClips = subtitleLines.map((seg) => ({
        asset: {
          type: "html",
          html: `<p style="font-family: '${subFont}', sans-serif; font-size: ${subSize}px; color: ${subColor}; text-align: center; text-shadow: 2px 2px 8px rgba(0,0,0,0.9); background: ${subBg}; padding: 12px 24px; border-radius: 12px; max-width: 900px; word-wrap: break-word;">${escapeHtml(seg.text)}</p>`,
          width: width - 120,
          height: 200,
        },
        start: seg.start,
        length: seg.duration,
        position: subPos,
        offset: { x: 0, y: isVertical ? 0.08 : 0.05 },
        transition: { in: "fade", out: "fade" },
      }));

      if (subtitleClips.length > 0) {
        tracks.unshift({ clips: subtitleClips });
      }
    }

    // Watermark / brand logo — tier-based
    // free: forced "Powered by Bullfy" text (large, opaque) + portal logo if exists
    // pro: portal logo only (or small custom watermark text)
    // enterprise / can_remove_branding: nothing forced
    const wantsBranding = add_watermark && !userCanRemoveBranding;

    if (wantsBranding && brand?.logo_url && userTier !== "free") {
      // Pro: portal logo only
      tracks.unshift({
        clips: [
          {
            asset: { type: "image", src: brand.logo_url },
            start: 0,
            length: clipDuration,
            position: "topRight",
            offset: { x: -0.03, y: 0.03 },
            scale: 0.15,
          },
        ],
      });
    } else if (wantsBranding && userTier !== "free") {
      // Pro without logo: small custom watermark
      tracks.unshift({
        clips: [
          {
            asset: {
              type: "html",
              html: `<p style="font-family: '${subFont}', sans-serif; font-size: 22px; font-weight: 700; color: rgba(255,255,255,0.6); text-shadow: 1px 1px 4px rgba(0,0,0,0.5);">${escapeHtml(watermarkText)}</p>`,
              width: 320,
              height: 50,
            },
            start: 0,
            length: clipDuration,
            position: "topRight",
            offset: { x: -0.03, y: 0.03 },
          },
        ],
      });
    } else if (wantsBranding) {
      // FREE tier: forced Bullfy watermark, larger & more visible, cannot be removed
      tracks.unshift({
        clips: [
          {
            asset: {
              type: "html",
              html: `<p style="font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800; color: rgba(255,255,255,0.92); text-shadow: 2px 2px 8px rgba(0,0,0,0.85); background: rgba(20,110,245,0.85); padding: 8px 16px; border-radius: 8px;">Powered by Bullfy</p>`,
              width: 360,
              height: 60,
            },
            start: 0,
            length: clipDuration,
            position: "bottomRight",
            offset: { x: -0.03, y: 0.05 },
          },
        ],
      });
      // If FREE has a portal logo, also add it small in topRight
      if (brand?.logo_url) {
        tracks.unshift({
          clips: [
            {
              asset: { type: "image", src: brand.logo_url },
              start: 0,
              length: clipDuration,
              position: "topRight",
              offset: { x: -0.03, y: 0.03 },
              scale: 0.1,
            },
          ],
        });
      }
    }

    const timeline = {
      tracks,
      background: "#000000",
    };

    const output = {
      format: "mp4",
      resolution: isVertical ? "1080" : "hd",
      aspectRatio: isVertical ? "9:16" : "16:9",
      size: {
        width,
        height,
      },
    };

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/shotstack-webhook`;
    const renderPayload = { timeline, output, callback: callbackUrl };

    console.log("Sending render to Shotstack...");

    const renderRes = await fetch(`${SHOTSTACK_API_URL}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SHOTSTACK_API_KEY,
      },
      body: JSON.stringify(renderPayload),
    });

    const renderData = await renderRes.json();

    if (!renderRes.ok) {
      console.error("Shotstack render error:", JSON.stringify(renderData));
      return new Response(
        JSON.stringify({ error: "Shotstack render failed", details: renderData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const renderId = renderData.response?.id;
    if (!renderId) {
      return new Response(
        JSON.stringify({ error: "No render ID returned", details: renderData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save clip record to DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: authHeader, apikey: anonKey },
        });
        if (userRes.ok) {
          const u = await userRes.json();
          userId = u.id;
        }
      } catch { /* ignore */ }
    }
    if (!userId && created_by && authHeader === `Bearer ${supabaseKey}`) {
      userId = created_by;
    }

    const clipRecord = {
      source_type,
      source_id: source_id || null,
      source_url,
      title: title || `Clip ${start_time}s-${end_time}s`,
      start_time,
      end_time,
      transcript_segment: subtitle_text || null,
      shotstack_render_id: renderId,
      render_status: "rendering",
      format,
      has_subtitles,
      created_by: userId,
    };

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/video_clips`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(clipRecord),
    });

    let savedClip = null;
    if (insertRes.ok) {
      const arr = await insertRes.json();
      savedClip = arr?.[0] || null;
    } else {
      console.error("DB insert error:", await insertRes.text());
    }

    return new Response(
      JSON.stringify({
        ok: true,
        render_id: renderId,
        clip_id: savedClip?.id || null,
        estimated_seconds: Math.max(30, clipDuration * 2),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-video-clip error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseSubtitleSegments(
  text: string,
  totalDuration: number
): { text: string; start: number; duration: number }[] {
  // Split text into sentences/phrases
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) {
    return [{ text, start: 0, duration: totalDuration }];
  }

  const segDuration = totalDuration / sentences.length;
  return sentences.map((s, i) => ({
    text: s.length > 80 ? s.substring(0, 77) + "..." : s,
    start: i * segDuration,
    duration: Math.min(segDuration, totalDuration - i * segDuration),
  }));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
