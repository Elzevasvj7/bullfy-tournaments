import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createLiveKitAdminToken(apiKey: string, apiSecret: string, ttlSeconds = 600): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: apiKey,
    sub: apiKey,
    nbf: now,
    exp: now + ttlSeconds,
    video: { roomRecord: true, roomAdmin: true, room: "*" },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId, livekitRoomName } = await req.json();

    if (!roomId || !livekitRoomName) {
      return new Response(JSON.stringify({ ok: false, error: "roomId and livekitRoomName required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is authenticated and has access to this room
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check feature access
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: access } = await adminClient.rpc("has_live_feature_access", {
      _user_id: user.id,
      _feature_key: "recording_egress",
    });
    if (!access) {
      return new Response(JSON.stringify({ ok: false, error: "No tienes permiso para grabar en servidor" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const livekitUrl = Deno.env.get("LIVEKIT_URL")!;
    const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;

    // Build egress request — Composite recording (room composite) to Supabase Storage (S3-compatible)
    const fileName = `egress-${roomId}-${Date.now()}.mp4`;
    const filepath = `recordings/${roomId}/${fileName}`;

    const s3Bucket = Deno.env.get("EGRESS_S3_BUCKET");
    if (!s3Bucket) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Server-side recording (Egress) requires S3 storage configuration. Use the in-browser 'Grabar' button instead, or configure EGRESS_S3_* secrets."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build LiveKit Egress API call (Twirp expects camelCase OR snake_case; we use snake_case proto names)
    const egressBody = {
      room_name: livekitRoomName,
      layout: "speaker",
      audio_only: false,
      video_only: false,
      file_outputs: [
        {
          file_type: "MP4",
          filepath,
          s3: {
            access_key: Deno.env.get("EGRESS_S3_ACCESS_KEY") || "",
            secret: Deno.env.get("EGRESS_S3_SECRET") || "",
            region: Deno.env.get("EGRESS_S3_REGION") || "us-east-1",
            bucket: s3Bucket,
            endpoint: Deno.env.get("EGRESS_S3_ENDPOINT") || "",
            force_path_style: true,
          },
        },
      ],
    };

    // LiveKit Twirp requires a Bearer JWT with roomRecord grant
    const adminJwt = await createLiveKitAdminToken(apiKey, apiSecret);
    const apiUrl = livekitUrl.replace(/^wss?:\/\//, "https://").replace(/\/$/, "");

    const egressRes = await fetch(`${apiUrl}/twirp/livekit.Egress/StartRoomCompositeEgress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify(egressBody),
    });

    const rawBody = await egressRes.text();
    let egressJson: any = {};
    try { egressJson = rawBody ? JSON.parse(rawBody) : {}; } catch { egressJson = { message: rawBody }; }

    if (!egressRes.ok) {
      console.error("LiveKit Egress error:", egressRes.status, rawBody);
      return new Response(JSON.stringify({ ok: false, error: egressJson.message || rawBody || "Egress failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const egressId = egressJson.egress_id || egressJson.egressId;
    if (!egressId) {
      return new Response(JSON.stringify({ ok: false, error: "LiveKit no devolvió egress_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist on room
    await adminClient
      .from("live_rooms")
      .update({ egress_id: egressId, recording_enabled: true })
      .eq("id", roomId);

    return new Response(JSON.stringify({ ok: true, egressId, filepath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("livekit-egress-start error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
