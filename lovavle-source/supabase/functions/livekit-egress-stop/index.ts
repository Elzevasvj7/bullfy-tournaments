import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { roomId, egressId } = await req.json();

    if (!roomId) {
      return new Response(JSON.stringify({ ok: false, error: "roomId required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // If client didn't send egressId, try to recover it from DB.
    let effectiveEgressId = egressId;
    if (!effectiveEgressId) {
      const { data: room } = await adminClient
        .from("live_rooms")
        .select("egress_id")
        .eq("id", roomId)
        .maybeSingle();
      effectiveEgressId = room?.egress_id || null;
    }

    let lkWarning: string | null = null;
    if (effectiveEgressId) {
      try {
        const livekitUrl = Deno.env.get("LIVEKIT_URL")!;
        const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
        const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
        const basicAuth = await createLiveKitAdminToken(apiKey, apiSecret);
        const apiUrl = livekitUrl.replace(/^wss?:\/\//, "https://").replace(/\/$/, "");

        const stopRes = await fetch(`${apiUrl}/twirp/livekit.Egress/StopEgress`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${basicAuth}`,
          },
          body: JSON.stringify({ egress_id: effectiveEgressId }),
        });

        if (!stopRes.ok) {
          const txt = await stopRes.text();
          console.error("LiveKit StopEgress non-OK:", stopRes.status, txt);
          lkWarning = `LiveKit StopEgress devolvió ${stopRes.status}`;
        } else {
          await stopRes.text();
        }
      } catch (e: any) {
        console.error("LiveKit StopEgress threw:", e);
        lkWarning = e?.message || String(e);
      }
    } else {
      lkWarning = "No había egress_id activo";
    }

    // Clear recording flag but KEEP egress_id so the webhook can find this room
    // when LiveKit sends the egress_ended event (needed for auto-clip pipeline).
    await adminClient
      .from("live_rooms")
      .update({ recording_enabled: false })
      .eq("id", roomId);

    return new Response(
      JSON.stringify({ ok: true, egressId: effectiveEgressId, warning: lkWarning }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("livekit-egress-stop error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
