// F9 — Procesa entregas pendientes de webhooks de leads con HMAC-SHA256 y reintentos exponenciales.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_ATTEMPTS = 5;

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pending } = await supa
      .from("lead_webhook_deliveries")
      .select("id, webhook_id, event, payload, attempts, lead_webhooks!inner(url, secret, is_active)")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .limit(50);

    let ok = 0, failed = 0, dead = 0;
    for (const d of (pending ?? []) as any[]) {
      const wh = d.lead_webhooks;
      if (!wh?.is_active) {
        await supa.from("lead_webhook_deliveries").update({ status: "cancelled" }).eq("id", d.id);
        continue;
      }
      const body = JSON.stringify({ event: d.event, payload: d.payload, delivered_at: new Date().toISOString() });
      const headers: Record<string, string> = { "Content-Type": "application/json", "X-Bullfy-Event": d.event };
      if (wh.secret) headers["X-Bullfy-Signature"] = `sha256=${await hmacSha256Hex(wh.secret, body)}`;

      let respStatus = 0, respBody = "", errMsg: string | null = null;
      try {
        const r = await fetch(wh.url, { method: "POST", headers, body });
        respStatus = r.status;
        respBody = (await r.text().catch(() => "")).slice(0, 2000);
      } catch (e) { errMsg = (e as Error).message; }

      const success = respStatus >= 200 && respStatus < 300;
      const attempts = (d.attempts ?? 0) + 1;

      if (success) {
        await supa.from("lead_webhook_deliveries").update({
          status: "delivered", attempts, response_status: respStatus, response_body: respBody,
          delivered_at: new Date().toISOString(), last_error: null,
        }).eq("id", d.id);
        ok++;
      } else if (attempts >= MAX_ATTEMPTS) {
        await supa.from("lead_webhook_deliveries").update({
          status: "failed", attempts, response_status: respStatus, response_body: respBody, last_error: errMsg,
        }).eq("id", d.id);
        dead++;
      } else {
        const backoffMin = Math.pow(2, attempts) * 2; // 4, 8, 16, 32 min
        await supa.from("lead_webhook_deliveries").update({
          attempts, response_status: respStatus, response_body: respBody, last_error: errMsg,
          next_attempt_at: new Date(Date.now() + backoffMin * 60 * 1000).toISOString(),
        }).eq("id", d.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: (pending ?? []).length, delivered: ok, retrying: failed, dead }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[lead-webhook-dispatch]", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
