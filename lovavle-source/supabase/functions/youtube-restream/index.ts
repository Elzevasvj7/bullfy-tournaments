import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body ONCE
    const body = await req.json();
    const { action, roomName, streamKey, egressId } = body;

    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY")!;
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
    const livekitUrl = Deno.env.get("LIVEKIT_URL")!;

    const lkHost = livekitUrl.replace("wss://", "https://");

    if (action === "start") {
      if (!streamKey || !roomName) {
        return new Response(
          JSON.stringify({ error: "streamKey and roomName are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const projectUrl = Deno.env.get("EGRESS_COMPOSITOR_URL") || "https://bullfyibsystem.lovable.app";
      const egressUrl = `${projectUrl}/live-egress/${encodeURIComponent(roomName)}`;

      const rtmpUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;

      console.log("Starting Web Egress:", { egressUrl, rtmpUrl, roomName });

      const apiToken = await createLKApiToken(livekitApiKey, livekitApiSecret);

      const egressBody = {
        url: egressUrl,
        audio_only: false,
        video_only: false,
        stream_outputs: [{
          protocol: 1,
          urls: [rtmpUrl],
        }],
        options: {
          width: 1920,
          height: 1080,
          depth: 24,
          framerate: 30,
          audio_frequency: 44100,
          audio_channels: 2,
          video_bitrate: 4500,
        },
      };

      console.log("Egress request body:", JSON.stringify(egressBody));

      const egressRes = await fetch(`${lkHost}/twirp/livekit.Egress/StartWebEgress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(egressBody),
      });

      const egressText = await egressRes.text();
      console.log("Egress API response status:", egressRes.status, "body:", egressText);

      if (!egressRes.ok) {
        let errorMsg = "Failed to start egress";
        try {
          const egressData = JSON.parse(egressText);
          errorMsg = egressData.message || egressData.msg || errorMsg;
        } catch (_) { /* not JSON */ }
        return new Response(
          JSON.stringify({ error: errorMsg, details: egressText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const egressData = JSON.parse(egressText);
      return new Response(
        JSON.stringify({ egressId: egressData.egress_id, status: "started" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "stop") {
      const apiToken = await createLKApiToken(livekitApiKey, livekitApiSecret);

      if (egressId) {
        // Stop specific egress
        const stopRes = await fetch(`${lkHost}/twirp/livekit.Egress/StopEgress`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ egress_id: egressId }),
        });
        const stopText = await stopRes.text();
        console.log("Stop egress response:", stopRes.status, stopText);

        return new Response(
          JSON.stringify({ status: "stopped" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Stop all active egresses for this room
      const listRes = await fetch(`${lkHost}/twirp/livekit.Egress/ListEgress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ room_name: roomName }),
      });
      const listData = await listRes.json();
      const activeItems = (listData.items || []).filter(
        (e: any) => e.status === 0 || e.status === 1
      );
      for (const item of activeItems) {
        await fetch(`${lkHost}/twirp/livekit.Egress/StopEgress`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ egress_id: item.egress_id }),
        });
      }
      return new Response(
        JSON.stringify({ status: "stopped", count: activeItems.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'start' or 'stop'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("youtube-restream error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── JWT helpers for LiveKit Server API ──

function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createLKApiToken(apiKey: string, apiSecret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: apiKey,
    sub: "egress-api",
    jti: "egress-api",
    nbf: now,
    exp: now + 600,
    video: {
      roomCreate: true,
      roomList: true,
      roomAdmin: true,
      roomRecord: true,
    },
  };
  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(sig))}`;
}
