const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
function awsEncodePath(path: string): string {
  return path.split("/").map(awsEncode).join("/");
}
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmac(key: ArrayBuffer | Uint8Array | string, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const rawKey = typeof key === "string" ? enc.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
}

async function presignR2Url(filePath: string, expires = 3600): Promise<string | null> {
  const endpoint = (Deno.env.get("EGRESS_S3_ENDPOINT") || "").replace(/\/$/, "");
  const bucket = Deno.env.get("EGRESS_S3_BUCKET") || "";
  const accessKey = Deno.env.get("EGRESS_S3_ACCESS_KEY") || "";
  const secretKey = Deno.env.get("EGRESS_S3_SECRET") || "";
  const region = Deno.env.get("EGRESS_S3_REGION") || "auto";
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;

  let key = filePath;
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    const parsed = new URL(filePath);
    const prefix = `/${bucket}/`;
    key = parsed.pathname.startsWith(prefix) ? parsed.pathname.slice(prefix.length) : parsed.pathname.replace(/^\//, "");
  }
  key = decodeURIComponent(key.replace(/^\//, "").replace(new RegExp(`^${bucket}/`), ""));

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const host = new URL(endpoint).host;
  const canonicalUri = `/${bucket}/${awsEncodePath(key)}`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params).sort().map((k) => `${awsEncode(k)}=${awsEncode(params[k])}`).join("&");
  const canonicalRequest = ["GET", canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest)))].join("\n");
  const kDate = await hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));
  return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Missing auth" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recording_id } = await req.json();
    if (!recording_id) {
      return new Response(JSON.stringify({ ok: false, error: "recording_id required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: rec, error: recErr } = await admin
      .from("live_recordings")
      .select("id, file_path")
      .eq("id", recording_id)
      .maybeSingle();

    if (recErr || !rec?.file_path) {
      return new Response(JSON.stringify({ ok: false, error: "Recording not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If file_path is a R2 URL, presign it. Otherwise fall back to Supabase storage.
    const isR2 = rec.file_path.includes("cloudflarestorage.com") || rec.file_path.startsWith("http");
    let signedUrl: string | null = null;

    if (isR2) {
      signedUrl = await presignR2Url(rec.file_path, 3600);
    } else {
      const { data: signed } = await admin.storage.from("live-recordings").createSignedUrl(rec.file_path, 3600);
      signedUrl = signed?.signedUrl || null;
    }

    if (!signedUrl) {
      return new Response(JSON.stringify({ ok: false, error: "No se pudo firmar la URL (revisa credenciales R2)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, url: signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
