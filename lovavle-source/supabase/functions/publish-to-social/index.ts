const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function refreshTokenIfNeeded(conn: any): Promise<any> {
  // Refresh if expired or expires within 5 minutes
  const expSoon =
    conn.expires_at && new Date(conn.expires_at).getTime() - Date.now() < 5 * 60 * 1000;
  if (!expSoon || !conn.refresh_token_encrypted) return conn;

  try {
    const refreshRes = await fetch(`${supabaseUrl}/functions/v1/social-auth-callback`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "refresh",
        platform: conn.platform,
        user_id: conn.user_id,
      }),
    });
    if (refreshRes.ok) {
      // Re-fetch updated connection
      const r = await fetch(
        `${supabaseUrl}/rest/v1/social_connections?id=eq.${conn.id}&select=*`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      const fresh = (await r.json())?.[0];
      return fresh || conn;
    }
  } catch (e) {
    console.error("Token refresh attempt failed:", e);
  }
  return conn;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { clip_id, social_connection_id, caption, scheduled_at, _from_scheduler, _existing_publication_id } = body;

    if (!clip_id || !social_connection_id) {
      return respond({ ok: false, error: "clip_id and social_connection_id are required" });
    }

    const clipRes = await fetch(
      `${supabaseUrl}/rest/v1/video_clips?id=eq.${clip_id}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const clips = await clipRes.json();
    const clip = clips?.[0];

    if (!clip || (clip.render_status !== "completed" && clip.render_status !== "ready") || !clip.output_url) {
      return respond({ ok: false, error: "Clip no está listo. El renderizado debe completarse primero." });
    }

    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/social_connections?id=eq.${social_connection_id}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    let conn = (await connRes.json())?.[0];

    if (!conn || conn.status !== "active") {
      return respond({ ok: false, error: "Conexión social no encontrada o inactiva. Reconecta la cuenta." });
    }

    // Auto-refresh token if expired/expiring
    conn = await refreshTokenIfNeeded(conn);

    if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
      return respond({ ok: false, error: "Token expirado y no se pudo refrescar. Reconecta la cuenta." });
    }

    let publication: any;

    if (_existing_publication_id) {
      // Re-use scheduled publication row created earlier
      const exRes = await fetch(
        `${supabaseUrl}/rest/v1/social_publications?id=eq.${_existing_publication_id}&select=*`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      publication = (await exRes.json())?.[0];
    } else {
      const pubData: any = {
        clip_id,
        social_connection_id,
        platform: conn.platform,
        caption: caption || clip.title || "",
        status: scheduled_at ? "scheduled" : "publishing",
        scheduled_at: scheduled_at || null,
        created_by: conn.user_id,
      };

      const pubRes = await fetch(`${supabaseUrl}/rest/v1/social_publications`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(pubData),
      });

      const pubArr = await pubRes.json();
      publication = pubArr?.[0];
    }

    if (!publication) {
      return respond({ ok: false, error: "No se pudo crear el registro de publicación" });
    }

    if (scheduled_at && !_from_scheduler) {
      return respond({
        ok: true,
        publication_id: publication.id,
        status: "scheduled",
        scheduled_at,
      });
    }

    let publishResult: { post_id?: string; post_url?: string; error?: string } = {};

    try {
      switch (conn.platform) {
        case "instagram":
          publishResult = await publishToInstagram(conn.access_token_encrypted, clip.output_url, caption || "");
          break;
        case "tiktok":
          publishResult = await publishToTikTok(conn.access_token_encrypted, clip.output_url, caption || "");
          break;
        case "youtube":
          publishResult = await publishToYouTube(conn.access_token_encrypted, clip.output_url, caption || "", clip.title || "Clip");
          break;
      }
    } catch (e) {
      publishResult = { error: e instanceof Error ? e.message : String(e) };
    }

    const updateData: any = publishResult.error
      ? { status: "failed" }
      : {
          status: "published",
          post_id: publishResult.post_id || null,
          post_url: publishResult.post_url || null,
          published_at: new Date().toISOString(),
        };

    await fetch(`${supabaseUrl}/rest/v1/social_publications?id=eq.${publication.id}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    await fetch(`${supabaseUrl}/rest/v1/video_studio_usage_log`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: conn.user_id,
        action: "publish",
        credits_used: 1,
        metadata: { platform: conn.platform, clip_id, publication_id: publication.id },
      }),
    });

    if (publishResult.error) {
      return respond({
        ok: false,
        error: publishResult.error,
        publication_id: publication.id,
      });
    }

    return respond({
      ok: true,
      publication_id: publication.id,
      post_id: publishResult.post_id,
      post_url: publishResult.post_url,
      platform: conn.platform,
    });
  } catch (error) {
    console.error("publish-to-social error:", error);
    return respond({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ── Platform publishers ──

async function publishToInstagram(
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<{ post_id?: string; post_url?: string; error?: string }> {
  const containerRes = await fetch(`https://graph.instagram.com/me/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: accessToken,
    }),
  });
  const container = await containerRes.json();
  if (!container.id) return { error: container.error?.message || "Failed to create IG container" };

  await new Promise((r) => setTimeout(r, 5000));

  const publishRes = await fetch(`https://graph.instagram.com/me/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: container.id,
      access_token: accessToken,
    }),
  });
  const published = await publishRes.json();
  if (!published.id) return { error: published.error?.message || "Failed to publish to IG" };

  return {
    post_id: published.id,
    post_url: `https://www.instagram.com/reel/${published.id}/`,
  };
}

async function publishToTikTok(
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<{ post_id?: string; post_url?: string; error?: string }> {
  const initRes = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: caption.substring(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    }
  );
  const initData = await initRes.json();

  if (initData.error?.code && initData.error.code !== "ok") {
    return { error: initData.error.message || "TikTok upload failed" };
  }

  return {
    post_id: initData.data?.publish_id || "pending",
    post_url: "https://www.tiktok.com",
  };
}

/**
 * YouTube upload — STREAMING approach to avoid 150MB edge function memory limit.
 * Uses HEAD to get size, then streams the video body directly to YouTube's resumable
 * upload URL without ever loading the file into memory.
 */
async function publishToYouTube(
  accessToken: string,
  videoUrl: string,
  caption: string,
  title: string
): Promise<{ post_id?: string; post_url?: string; error?: string }> {
  // Step 1: HEAD request to get content length
  const headRes = await fetch(videoUrl, { method: "HEAD" });
  if (!headRes.ok) return { error: "No se pudo verificar el video para YouTube" };
  const contentLength = headRes.headers.get("content-length");
  if (!contentLength) return { error: "El video no expone Content-Length, requerido por YouTube" };

  // Step 2: Initiate resumable upload
  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": contentLength,
      },
      body: JSON.stringify({
        snippet: {
          title: title.substring(0, 100),
          description: caption,
          categoryId: "22",
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    return { error: `YouTube init failed: ${errText.substring(0, 200)}` };
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) return { error: "No YouTube upload URL returned" };

  // Step 3: Stream the video directly from source to YouTube (no .blob())
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok || !videoRes.body) {
    return { error: "Failed to fetch source video for streaming upload" };
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": contentLength,
    },
    body: videoRes.body,
    // @ts-ignore — Deno required to stream a body
    duplex: "half",
  });

  let uploadData: any;
  try {
    uploadData = await uploadRes.json();
  } catch {
    const t = await uploadRes.text();
    return { error: `YouTube respondió no-JSON: ${t.substring(0, 200)}` };
  }

  if (!uploadData.id) {
    return { error: uploadData.error?.message || "YouTube upload failed" };
  }

  return {
    post_id: uploadData.id,
    post_url: `https://www.youtube.com/shorts/${uploadData.id}`,
  };
}
