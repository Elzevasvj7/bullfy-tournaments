import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Minimal JWT builder for LiveKit Server API admin tokens ──
function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createAdminToken(apiKey: string, apiSecret: string, roomName: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: apiKey,
    sub: apiKey,
    nbf: now,
    exp: now + 600, // 10 min
    video: {
      roomAdmin: true,
      room: roomName,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { roomName, targetIdentity } = await req.json();
    console.log("[REVOKE-EDGE] Request received:", { roomName, targetIdentity });
    if (!roomName || !targetIdentity) {
      console.warn("[REVOKE-EDGE] Missing required fields");
      return new Response(
        JSON.stringify({ error: "roomName and targetIdentity are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Auth: verify caller is logged in and is the host of this room ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("[REVOKE-EDGE] No bearer token in Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    console.log("[REVOKE-EDGE] Auth result:", { userId: user?.id, error: userErr?.message });
    if (userErr || !user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roomRow, error: roomErr } = await adminDb
      .from("live_rooms")
      .select("id, host_id, livekit_room_name")
      .eq("livekit_room_name", roomName)
      .maybeSingle();
    console.log("[REVOKE-EDGE] Room lookup:", {
      roomName,
      found: !!roomRow,
      hostId: roomRow?.host_id,
      callerUserId: user.id,
      isHost: roomRow?.host_id === user.id,
      error: roomErr?.message,
    });
    if (!roomRow || roomRow.host_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the host can revoke co-streamers" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build admin JWT and call LiveKit Server APIs ──
    const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
    const livekitUrl = Deno.env.get("LIVEKIT_URL")!;
    // Convert wss://… to https://…
    const httpUrl = livekitUrl.replace(/^wss?:\/\//, "https://");
    const adminToken = await createAdminToken(apiKey, apiSecret, roomName);

    // 1) Update permissions: remove canPublish
    const updateRes = await fetch(`${httpUrl}/twirp/livekit.RoomService/UpdateParticipant`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: roomName,
        identity: targetIdentity,
        permission: {
          canPublish: false,
          canSubscribe: true,
          canPublishData: true,
        },
      }),
    });
    console.log("[REVOKE-EDGE] UpdateParticipant status:", updateRes.status);
    if (!updateRes.ok) {
      const txt = await updateRes.text();
      console.error("[REVOKE-EDGE] UpdateParticipant failed:", txt);
      return new Response(
        JSON.stringify({ error: "Failed to revoke publisher", details: txt }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[REVOKE-EDGE] UpdateParticipant OK — permissions revoked");

    // 2) Fetch participant to get track sids, then mute all published tracks (best effort)
    try {
      const partRes = await fetch(`${httpUrl}/twirp/livekit.RoomService/GetParticipant`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomName, identity: targetIdentity }),
      });
      if (partRes.ok) {
        const part = await partRes.json();
        const tracks: any[] = part?.tracks || [];
        for (const tr of tracks) {
          if (!tr?.sid) continue;
          await fetch(`${httpUrl}/twirp/livekit.RoomService/MutePublishedTrack`, {
            method: "POST",
            headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              room: roomName,
              identity: targetIdentity,
              track_sid: tr.sid,
              muted: true,
            }),
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Mute tracks step failed (non-fatal):", e);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("livekit-revoke-publisher error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
