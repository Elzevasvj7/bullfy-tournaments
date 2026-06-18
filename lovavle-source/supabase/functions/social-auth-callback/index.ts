const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { action, platform, code, redirect_uri, user_id } = await req.json();

    if (!platform || !["instagram", "tiktok", "youtube"].includes(platform)) {
      return new Response(
        JSON.stringify({ error: "Invalid platform. Use: instagram, tiktok, youtube" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: get_auth_url → return OAuth URL for the user to authorize
    if (action === "get_auth_url") {
      const authUrl = buildAuthUrl(platform, redirect_uri || "");
      if (!authUrl) {
        return new Response(
          JSON.stringify({ error: `OAuth not configured for ${platform}. Admin must set API keys.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ ok: true, auth_url: authUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: exchange_code → exchange OAuth code for tokens
    if (action === "exchange_code") {
      if (!code || !user_id) {
        return new Response(
          JSON.stringify({ error: "code and user_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens = await exchangeCodeForTokens(platform, code, redirect_uri || "");
      if (!tokens) {
        return new Response(
          JSON.stringify({ error: "Failed to exchange OAuth code" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get platform user info
      const platformUser = await getPlatformUserInfo(platform, tokens.access_token);

      // Upsert social connection
      const connectionData = {
        user_id,
        platform,
        access_token_encrypted: tokens.access_token,
        refresh_token_encrypted: tokens.refresh_token || null,
        platform_user_id: platformUser?.id || null,
        platform_username: platformUser?.username || null,
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        status: "active",
      };

      // Upsert (user_id + platform is unique)
      const upsertRes = await fetch(
        `${supabaseUrl}/rest/v1/social_connections?on_conflict=user_id,platform`,
        {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=representation,resolution=merge-duplicates",
          },
          body: JSON.stringify(connectionData),
        }
      );

      if (!upsertRes.ok) {
        console.error("DB upsert error:", await upsertRes.text());
        return new Response(
          JSON.stringify({ error: "Failed to save connection" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const saved = await upsertRes.json();

      return new Response(
        JSON.stringify({
          ok: true,
          connection: {
            id: saved[0]?.id,
            platform,
            platform_username: platformUser?.username || null,
            status: "active",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: disconnect → remove connection
    if (action === "disconnect") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await fetch(
        `${supabaseUrl}/rest/v1/social_connections?user_id=eq.${user_id}&platform=eq.${platform}`,
        {
          method: "DELETE",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );

      return new Response(
        JSON.stringify({ ok: true, message: `${platform} disconnected` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: refresh → refresh expired tokens
    if (action === "refresh") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const connRes = await fetch(
        `${supabaseUrl}/rest/v1/social_connections?user_id=eq.${user_id}&platform=eq.${platform}&select=*`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      const conns = await connRes.json();
      const conn = conns?.[0];

      if (!conn?.refresh_token_encrypted) {
        return new Response(
          JSON.stringify({ error: "No refresh token available. Reconnect the account." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newTokens = await refreshAccessToken(platform, conn.refresh_token_encrypted);
      if (!newTokens) {
        // Mark as expired
        await fetch(
          `${supabaseUrl}/rest/v1/social_connections?id=eq.${conn.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "expired" }),
          }
        );
        return new Response(
          JSON.stringify({ error: "Token refresh failed. Please reconnect." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await fetch(
        `${supabaseUrl}/rest/v1/social_connections?id=eq.${conn.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token_encrypted: newTokens.access_token,
            refresh_token_encrypted: newTokens.refresh_token || conn.refresh_token_encrypted,
            expires_at: newTokens.expires_in
              ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
              : conn.expires_at,
            status: "active",
          }),
        }
      );

      return new Response(
        JSON.stringify({ ok: true, message: "Token refreshed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: get_auth_url, exchange_code, disconnect, refresh" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("social-auth-callback error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── OAuth URL builders ──

function buildAuthUrl(platform: string, redirectUri: string): string | null {
  switch (platform) {
    case "instagram": {
      const clientId = Deno.env.get("INSTAGRAM_CLIENT_ID");
      if (!clientId) return null;
      return `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user_profile,user_media&response_type=code`;
    }
    case "tiktok": {
      const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
      if (!clientKey) return null;
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user.info.basic,video.upload,video.publish&response_type=code`;
    }
    case "youtube": {
      const clientId = Deno.env.get("YOUTUBE_CLIENT_ID");
      if (!clientId) return null;
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube&response_type=code&access_type=offline&prompt=consent`;
    }
    default:
      return null;
  }
}

// ── Token exchange ──

async function exchangeCodeForTokens(
  platform: string,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  try {
    switch (platform) {
      case "instagram": {
        const res = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: Deno.env.get("INSTAGRAM_CLIENT_ID") || "",
            client_secret: Deno.env.get("INSTAGRAM_CLIENT_SECRET") || "",
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
          }),
        });
        const data = await res.json();
        if (!data.access_token) return null;
        // Exchange for long-lived token
        const longRes = await fetch(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${Deno.env.get("INSTAGRAM_CLIENT_SECRET")}&access_token=${data.access_token}`
        );
        const longData = await longRes.json();
        return {
          access_token: longData.access_token || data.access_token,
          expires_in: longData.expires_in || 5184000,
        };
      }
      case "tiktok": {
        const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: Deno.env.get("TIKTOK_CLIENT_KEY") || "",
            client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET") || "",
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
        });
        const data = await res.json();
        return {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
        };
      }
      case "youtube": {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: Deno.env.get("YOUTUBE_CLIENT_ID") || "",
            client_secret: Deno.env.get("YOUTUBE_CLIENT_SECRET") || "",
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
        });
        const data = await res.json();
        return {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
        };
      }
      default:
        return null;
    }
  } catch (e) {
    console.error(`Token exchange error for ${platform}:`, e);
    return null;
  }
}

// ── Platform user info ──

async function getPlatformUserInfo(
  platform: string,
  accessToken: string
): Promise<{ id: string; username: string } | null> {
  try {
    switch (platform) {
      case "instagram": {
        const res = await fetch(
          `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
        );
        const data = await res.json();
        return { id: data.id, username: data.username };
      }
      case "tiktok": {
        const res = await fetch(
          "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        return {
          id: data.data?.user?.open_id || "",
          username: data.data?.user?.display_name || "",
        };
      }
      case "youtube": {
        const res = await fetch(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        const ch = data.items?.[0];
        return {
          id: ch?.id || "",
          username: ch?.snippet?.title || "",
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ── Token refresh ──

async function refreshAccessToken(
  platform: string,
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  try {
    switch (platform) {
      case "instagram": {
        const res = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`
        );
        const data = await res.json();
        return data.access_token ? { access_token: data.access_token, expires_in: data.expires_in } : null;
      }
      case "tiktok": {
        const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: Deno.env.get("TIKTOK_CLIENT_KEY") || "",
            client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET") || "",
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        });
        const data = await res.json();
        return data.access_token ? { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in } : null;
      }
      case "youtube": {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: Deno.env.get("YOUTUBE_CLIENT_ID") || "",
            client_secret: Deno.env.get("YOUTUBE_CLIENT_SECRET") || "",
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        });
        const data = await res.json();
        return data.access_token ? { access_token: data.access_token, expires_in: data.expires_in } : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
