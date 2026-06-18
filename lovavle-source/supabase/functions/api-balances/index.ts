import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ─── Individual provider checks ───
async function checkTwilio() {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_API_KEY_SECRET") ?? Deno.env.get("TWILIO_AUTH_TOKEN");
  const keySid = Deno.env.get("TWILIO_API_KEY_SID");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  // Try gateway first
  try {
    if (LOVABLE_API_KEY && TWILIO_API_KEY) {
      const res = await fetch("https://connector-gateway.lovable.dev/twilio/Balance.json", {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
        },
      });
      const d = await res.json();
      if (res.ok) {
        return {
          ok: true,
          balance: parseFloat(d.balance ?? "0"),
          currency: d.currency ?? "USD",
          unit: "USD",
        };
      }
    }
    if (sid && token) {
      const auth = btoa(`${keySid ?? sid}:${token}`);
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      const d = await res.json();
      if (res.ok) {
        return {
          ok: true,
          balance: parseFloat(d.balance ?? "0"),
          currency: d.currency ?? "USD",
          unit: "USD",
        };
      }
      return { ok: false, error: d.message ?? "Error consultando saldo" };
    }
    return { ok: false, error: "No configurado" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkFirecrawl() {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return { ok: false, error: "No configurado" };
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const d = await res.json();
    if (!res.ok) return { ok: false, error: d.error ?? `HTTP ${res.status}` };
    const remaining = d?.data?.remaining_credits ?? d?.remaining_credits ?? 0;
    return { ok: true, balance: remaining, currency: "credits", unit: "credits" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkTwelveData() {
  const key = Deno.env.get("TWELVEDATA_API_KEY");
  if (!key) return { ok: false, error: "No configurado" };
  try {
    const res = await fetch(`https://api.twelvedata.com/api_usage?apikey=${key}`);
    const d = await res.json();
    if (d.code && d.code !== 200) return { ok: false, error: d.message ?? "Error" };
    const used = d?.current_usage ?? 0;
    const limit = d?.plan_daily_limit ?? d?.daily_limit ?? 800;
    return {
      ok: true,
      balance: limit - used,
      currency: "calls/día",
      unit: "calls",
      meta: { used, limit, plan: d?.plan_category ?? "Basic" },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkBannerbear() {
  const key = Deno.env.get("BANNERBEAR_API_KEY");
  if (!key) return { ok: false, error: "No configurado" };
  try {
    const res = await fetch("https://api.bannerbear.com/v2/account", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const d = await res.json();
    if (!res.ok) return { ok: false, error: d.message ?? `HTTP ${res.status}` };
    const used = d?.image_api_quota_used ?? 0;
    const limit = d?.image_api_quota ?? 1000;
    return {
      ok: true,
      balance: limit - used,
      currency: "imágenes/mes",
      unit: "images",
      meta: { used, limit, plan: d?.plan_name ?? "Automate" },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkElevenLabs() {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) return { ok: false, error: "No configurado" };
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": key },
    });
    const d = await res.json();
    if (!res.ok) {
      return { ok: false, error: d?.detail?.message ?? d?.detail ?? `HTTP ${res.status}` };
    }
    const used = d?.character_count ?? 0;
    const limit = d?.character_limit ?? 0;
    return {
      ok: true,
      balance: limit - used,
      currency: "caracteres",
      unit: "chars",
      meta: { used, limit, tier: d?.tier ?? "free" },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkResend() {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "No configurado" };
  try {
    // Resend no expone endpoint público de saldo. Verificamos validez del key listando dominios.
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { ok: false, error: d?.message ?? `HTTP ${res.status}` };
    }
    const d = await res.json();
    const domains = Array.isArray(d?.data) ? d.data.length : 0;
    return {
      ok: true,
      balance: domains,
      currency: "dominios activos",
      unit: "domains",
      meta: { note: "Resend no expone saldo vía API. Mostrando dominios verificados." },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkShotstack() {
  const key = Deno.env.get("SHOTSTACK_API_KEY");
  if (!key) return { ok: false, error: "No configurado" };
  // Shotstack no expone saldo vía API pública
  return {
    ok: true,
    balance: null,
    currency: "—",
    unit: "—",
    meta: { note: "Shotstack no expone saldo vía API. Revisar dashboard." },
    dashboardUrl: "https://dashboard.shotstack.io/usage",
  };
}

async function checkLiveKit() {
  // LiveKit Cloud no expone billing vía API pública
  const url = Deno.env.get("LIVEKIT_URL");
  if (!url) return { ok: false, error: "No configurado" };
  return {
    ok: true,
    balance: null,
    currency: "—",
    unit: "—",
    meta: { note: "LiveKit Cloud no expone uso/saldo vía API. Revisar dashboard." },
    dashboardUrl: "https://cloud.livekit.io",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Unauthorized" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ ok: false, error: "Unauthorized" });

    const [twilio, firecrawl, twelvedata, bannerbear, elevenlabs, resend, shotstack, livekit] =
      await Promise.all([
        checkTwilio(),
        checkFirecrawl(),
        checkTwelveData(),
        checkBannerbear(),
        checkElevenLabs(),
        checkResend(),
        checkShotstack(),
        checkLiveKit(),
      ]);

    return json({
      ok: true,
      checked_at: new Date().toISOString(),
      providers: {
        twilio: { name: "Twilio", category: "SMS / Voz", dashboardUrl: "https://console.twilio.com/us1/billing/manage-billing/recharge", ...twilio },
        firecrawl: { name: "Firecrawl", category: "Web Scraping", dashboardUrl: "https://www.firecrawl.dev/app/billing", ...firecrawl },
        twelvedata: { name: "Twelve Data", category: "Market Data", dashboardUrl: "https://twelvedata.com/account/dashboard", ...twelvedata },
        bannerbear: { name: "Bannerbear", category: "Generación de imágenes", dashboardUrl: "https://app.bannerbear.com/account/billing", ...bannerbear },
        elevenlabs: { name: "ElevenLabs", category: "Voz IA / TTS", dashboardUrl: "https://elevenlabs.io/app/subscription", ...elevenlabs },
        resend: { name: "Resend", category: "Email", dashboardUrl: "https://resend.com/settings/billing", ...resend },
        shotstack: { name: "Shotstack", category: "Video Render", dashboardUrl: "https://dashboard.shotstack.io/usage", ...shotstack },
        livekit: { name: "LiveKit", category: "Streaming WebRTC", dashboardUrl: "https://cloud.livekit.io", ...livekit },
      },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" });
  }
});
