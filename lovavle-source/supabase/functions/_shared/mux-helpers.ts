// Shared utilities for Mux Video integration (Academy module).
//
// Tres responsabilidades:
//   1) muxRequest()         — cliente HTTP autenticado a la API de Mux.
//   2) verifyMuxWebhook()   — valida la firma HMAC-SHA256 del webhook.
//   3) generateMuxJwt()     — firma JWT RS256 para playback signed URLs.
//
// Secrets requeridos en Lovable Cloud:
//   MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_WEBHOOK_SECRET,
//   MUX_SIGNING_KEY_ID, MUX_SIGNING_PRIVATE_KEY

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const ok = (b: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: true, ...b }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const err = (m: string, extra: Record<string, unknown> = {}, status = 200) =>
  new Response(JSON.stringify({ ok: false, error: m, ...extra }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });


// ============================================================================
// Mux API client
// ============================================================================
const MUX_API_BASE = "https://api.mux.com";

export async function muxRequest<T = unknown>(
  path: string,
  method: "GET" | "POST" | "DELETE" | "PUT" = "GET",
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const tokenId = Deno.env.get("MUX_TOKEN_ID");
  const tokenSecret = Deno.env.get("MUX_TOKEN_SECRET");
  if (!tokenId || !tokenSecret) {
    return { ok: false, status: 500, data: null, error: "Mux credentials missing" };
  }

  const auth = btoa(`${tokenId}:${tokenSecret}`);
  const res = await fetch(`${MUX_API_BASE}${path}`, {
    method,
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: T | null = null;
  try { data = await res.json() as T; } catch { /* ignore */ }

  return {
    ok: res.ok,
    status: res.status,
    data,
    error: !res.ok ? `Mux API ${res.status}` : undefined,
  };
}


// ============================================================================
// Webhook signature verification
// ============================================================================
// Mux firma con HMAC-SHA256 sobre `<timestamp>.<rawBody>` usando el webhook
// secret. El header llega como `Mux-Signature: t=<unix>,v1=<hex>`. Tolerancia
// de 5 minutos al timestamp para protegerse contra replays.
async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyMuxWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  tolerancesSeconds = 300,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const pairs: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    pairs[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  const timestamp = pairs["t"];
  const sig = pairs["v1"];
  if (!timestamp || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > tolerancesSeconds) return false;
  const computed = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return computed === sig;
}


// ============================================================================
// JWT RS256 signing for Mux signed playback URLs
// ============================================================================
// Mux acepta JWTs RS256 firmados con la signing key del environment. El JWT
// se pasa como `?token=...` a la URL del playback (HLS o thumbnail) para que
// solo usuarios autorizados puedan reproducir.
//
// Mux entrega la signing private key en formato PKCS#1 ("BEGIN RSA PRIVATE
// KEY"). crypto.subtle.importKey() solo acepta PKCS#8 ("BEGIN PRIVATE KEY"),
// así que convertimos PKCS#1 → PKCS#8 envolviendo los bytes DER en la
// estructura ASN.1 estándar de PKCS#8.

function base64UrlEncode(bytes: Uint8Array | string): string {
  const b64 = typeof bytes === "string"
    ? btoa(bytes)
    : btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Envuelve un PKCS#1 RSA private key DER en la estructura PKCS#8 que requiere
// crypto.subtle. La estructura PKCS#8 es:
//   SEQUENCE {
//     INTEGER 0                                -- version
//     SEQUENCE { OID rsaEncryption, NULL }     -- algorithm identifier
//     OCTET STRING { ...PKCS#1 contents... }   -- private key
//   }
// Para claves RSA 2048/4096, el tamaño cae en el rango que requiere longitud
// de 2 bytes (forma 0x82) en los wrappers OCTET STRING y SEQUENCE outer.
function pkcs1DerToPkcs8Der(pkcs1: Uint8Array): Uint8Array {
  // Algorithm identifier: SEQUENCE { OID rsaEncryption, NULL } — 15 bytes
  const algIdentifier = new Uint8Array([
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // 1.2.840.113549.1.1.1
    0x05, 0x00,
  ]);
  // OCTET STRING header con longitud larga (0x82 + 2 bytes BE).
  const octetHeader = new Uint8Array([
    0x04, 0x82,
    (pkcs1.length >> 8) & 0xff,
    pkcs1.length & 0xff,
  ]);
  // INTEGER version 0
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  // Inner content = version + algId + octetHeader + pkcs1
  const innerLen = version.length + algIdentifier.length + octetHeader.length + pkcs1.length;
  // Outer SEQUENCE header
  const outerHeader = new Uint8Array([
    0x30, 0x82,
    (innerLen >> 8) & 0xff,
    innerLen & 0xff,
  ]);

  const result = new Uint8Array(outerHeader.length + innerLen);
  let offset = 0;
  result.set(outerHeader, offset); offset += outerHeader.length;
  result.set(version, offset); offset += version.length;
  result.set(algIdentifier, offset); offset += algIdentifier.length;
  result.set(octetHeader, offset); offset += octetHeader.length;
  result.set(pkcs1, offset);
  return result;
}

async function importMuxPrivateKey(pem: string): Promise<CryptoKey> {
  const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
  const der = pemToDer(pem);
  const pkcs8 = isPkcs1 ? pkcs1DerToPkcs8Der(der) : der;
  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Genera un JWT RS256 firmado para una URL playback signed de Mux.
 *
 * @param playbackId  El playback_id del asset.
 * @param expiresInSeconds  Tiempo de vida del token (default 1 hora).
 * @param audience  Tipo de recurso: "v" para video HLS, "t" para thumbnail,
 *                  "g" para storyboard, "s" para subtitles.
 */
export async function generateMuxJwt(
  playbackId: string,
  expiresInSeconds = 3600,
  audience: "v" | "t" | "g" | "s" = "v",
): Promise<string> {
  const keyId = Deno.env.get("MUX_SIGNING_KEY_ID");
  const privatePem = Deno.env.get("MUX_SIGNING_PRIVATE_KEY");
  if (!keyId || !privatePem) {
    throw new Error("Mux signing credentials missing");
  }

  const header = { alg: "RS256", typ: "JWT", kid: keyId };
  const payload = {
    sub: playbackId,
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importMuxPrivateKey(privatePem);
  const sigBytes = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = base64UrlEncode(new Uint8Array(sigBytes));

  return `${signingInput}.${sigB64}`;
}
