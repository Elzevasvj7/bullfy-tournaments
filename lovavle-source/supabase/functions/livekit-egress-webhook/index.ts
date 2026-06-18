import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyLiveKitJwt(token: string, apiKey: string, apiSecret: string, body: string): Promise<boolean> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify("HMAC", key, base64urlDecode(s), enc.encode(`${h}.${p}`));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(p)));
    if (payload.iss && payload.iss !== apiKey) return false;
    // Verify body sha256 hash matches
    if (payload.sha256) {
      const digest = await crypto.subtle.digest("SHA-256", enc.encode(body));
      const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
      if (b64 !== payload.sha256) return false;
    }
    return true;
  } catch (e) {
    console.error("JWT verify failed:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim() || authHeader.trim();

    const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
    const verified = await verifyLiveKitJwt(token, apiKey, apiSecret, rawBody);
    if (!verified) {
      console.warn("Webhook signature invalid - rejecting");
      return new Response(JSON.stringify({ ok: false, error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(rawBody);
    console.log("LiveKit webhook event:", event.event, event.egressInfo?.egressId || event.egress_info?.egress_id);

    const eventType = event.event;
    if (eventType !== "egress_ended" && eventType !== "egress_updated") {
      return new Response(JSON.stringify({ ok: true, ignored: eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const egressInfo = event.egressInfo || event.egress_info || {};
    const egressId = egressInfo.egressId || egressInfo.egress_id;
    const status = egressInfo.status;

    // EGRESS_COMPLETE = 2 in proto enum, or string "EGRESS_COMPLETE"
    const isComplete = status === "EGRESS_COMPLETE" || status === 2;
    if (eventType === "egress_updated" && !isComplete) {
      return new Response(JSON.stringify({ ok: true, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!egressId) {
      return new Response(JSON.stringify({ ok: false, error: "No egressId" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Find room by egress_id
    const { data: room } = await adminClient
      .from("live_rooms")
      .select("id, host_id")
      .eq("egress_id", egressId)
      .maybeSingle();

    if (!room) {
      console.warn("No room found for egress_id:", egressId);
      return new Response(JSON.stringify({ ok: true, warning: "no matching room" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract file info — LiveKit may use fileResults array or single file field
    const fileResults = egressInfo.fileResults || egressInfo.file_results || [];
    const fileInfo = fileResults[0] || egressInfo.file || {};
    const filename = fileInfo.filename || fileInfo.location || "";
    const fileSize = Number(fileInfo.size || 0);
    const durationNs = Number(fileInfo.duration || egressInfo.duration || 0);
    const durationSeconds = durationNs > 0 ? Math.round(durationNs / 1_000_000_000) : 0;

    // Build public R2 URL (filename is the S3 key)
    const r2Bucket = Deno.env.get("EGRESS_S3_BUCKET") || "";
    const r2Endpoint = (Deno.env.get("EGRESS_S3_ENDPOINT") || "").replace(/\/$/, "");
    const filePath = filename.startsWith("http")
      ? filename
      : `${r2Endpoint}/${r2Bucket}/${filename}`;

    // Insert recording row
    const { data: recording, error: recErr } = await adminClient
      .from("live_recordings")
      .insert({
        room_id: room.id,
        file_path: filePath,
        file_size: fileSize || null,
        duration_seconds: durationSeconds || null,
        recorded_by: "egress",
      })
      .select("id")
      .single();

    if (recErr) {
      console.error("Insert recording failed:", recErr);
      return new Response(JSON.stringify({ ok: false, error: recErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Recording row created:", recording?.id, "→ triggering auto-clip");

    // Fire-and-forget auto-clip
    fetch(`${supabaseUrl}/functions/v1/auto-clip-post-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      },
      body: JSON.stringify({ room_id: room.id, host_id: room.host_id }),
    }).catch((e) => console.error("auto-clip trigger failed:", e));

    return new Response(JSON.stringify({ ok: true, recordingId: recording?.id, filePath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("livekit-egress-webhook error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
