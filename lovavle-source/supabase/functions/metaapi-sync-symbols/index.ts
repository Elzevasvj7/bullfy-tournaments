// MetaAPI symbol sync — activates account, fetches symbols, saves to DB, deactivates account
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const METAAPI_TOKEN = Deno.env.get("METAAPI_TOKEN") ?? "";
const METAAPI_ACCOUNT_ID = Deno.env.get("METAAPI_ACCOUNT_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Categorize symbol heuristically
function categorize(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const fxMajors = ["EUR", "USD", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"];
  if (s.includes("XAU") || s.includes("GOLD")) return "metales";
  if (s.includes("XAG") || s.includes("SILVER")) return "metales";
  if (s.includes("XPT") || s.includes("XPD")) return "metales";
  if (s.includes("BTC") || s.includes("ETH") || s.includes("XRP") || s.includes("LTC")) return "crypto";
  if (s.includes("OIL") || s.includes("WTI") || s.includes("BRENT") || s.includes("NGAS")) return "energia";
  if (s.includes("US30") || s.includes("US500") || s.includes("NAS") || s.includes("SPX") || s.includes("DAX") || s.includes("FTSE") || s.includes("NIKKEI") || s.includes("JPN225")) return "indices";
  if (s.length >= 6 && fxMajors.includes(s.slice(0, 3)) && fxMajors.includes(s.slice(3, 6))) return "forex";
  if (s.length === 6 && /^[A-Z]{6}$/.test(s)) return "forex";
  return "otros";
}

async function metaapiFetch(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "auth-token": METAAPI_TOKEN,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`MetaAPI ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

async function getAccountInfo() {
  // MetaAPI provisioning host
  return await metaapiFetch(
    `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${METAAPI_ACCOUNT_ID}`,
  );
}

async function deployAccount() {
  return await metaapiFetch(
    `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${METAAPI_ACCOUNT_ID}/deploy`,
    { method: "POST" },
  );
}

async function undeployAccount() {
  return await metaapiFetch(
    `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${METAAPI_ACCOUNT_ID}/undeploy`,
    { method: "POST" },
  );
}

async function waitForConnected(maxSeconds = 90) {
  const started = Date.now();
  while ((Date.now() - started) / 1000 < maxSeconds) {
    const info = await getAccountInfo();
    const conn = info?.connectionStatus || info?.state;
    if (conn === "CONNECTED" || info?.state === "DEPLOYED") {
      // Even if DEPLOYED, MetaApi may still need a moment for connection
      if (info?.connectionStatus === "CONNECTED") return info;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  // Return whatever we have — caller will try regardless
  return await getAccountInfo();
}

async function getRegion(): Promise<string> {
  const info = await getAccountInfo();
  // MetaApi accounts have a region (e.g., 'new-york', 'london')
  return info?.region || "new-york";
}

async function getSymbols(region: string): Promise<string[]> {
  // MetaApi REST client API — get symbols
  const url = `https://mt-client-api-v1.${region}.agiliumtrade.ai/users/current/accounts/${METAAPI_ACCOUNT_ID}/symbols`;
  return await metaapiFetch(url);
}

async function getSymbolSpec(region: string, symbol: string) {
  const url = `https://mt-client-api-v1.${region}.agiliumtrade.ai/users/current/accounts/${METAAPI_ACCOUNT_ID}/symbols/${encodeURIComponent(symbol)}/specification`;
  try {
    return await metaapiFetch(url);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Identify caller for the log
  let userId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const jwt = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(jwt);
      userId = data?.user?.id ?? null;
    }
  } catch { /* ignore */ }

  if (!METAAPI_TOKEN || !METAAPI_ACCOUNT_ID) {
    return new Response(
      JSON.stringify({ ok: false, error: "Faltan secrets METAAPI_TOKEN o METAAPI_ACCOUNT_ID" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let inserted = 0;
  let updated = 0;
  let total = 0;
  let logStatus = "success";
  let errorMessage: string | null = null;

  try {
    // 1) Activate account (deploy)
    try {
      await deployAccount();
    } catch (e) {
      // Already deployed is fine
      console.log("deploy warning:", (e as Error).message);
    }

    // 2) Wait until connected
    const info = await waitForConnected(120);
    const region = info?.region || (await getRegion());

    // 3) Fetch symbols list
    const symbols: string[] = await getSymbols(region);
    total = symbols.length;

    // 4) Fetch specs in batches and upsert
    const BATCH = 15;
    for (let i = 0; i < symbols.length; i += BATCH) {
      const slice = symbols.slice(i, i + BATCH);
      const specs = await Promise.all(slice.map((s) => getSymbolSpec(region, s)));

      const rows = slice.map((sym, idx) => {
        const spec = specs[idx] || {};
        return {
          symbol: sym,
          description: spec.description ?? null,
          category: categorize(sym),
          base_currency: spec.baseCurrency ?? null,
          quote_currency: spec.quoteCurrency ?? null,
          digits: spec.digits ?? null,
          contract_size: spec.contractSize ?? null,
          min_volume: spec.minVolume ?? null,
          max_volume: spec.maxVolume ?? null,
          volume_step: spec.volumeStep ?? null,
          tick_size: spec.tickSize ?? null,
          tick_value: spec.tickValue ?? null,
          enabled: true,
          raw_data: spec,
          last_synced_at: new Date().toISOString(),
        };
      });

      // Upsert by symbol
      const { error } = await supabase
        .from("broker_symbols")
        .upsert(rows, { onConflict: "symbol", ignoreDuplicates: false });

      if (error) throw new Error(`DB upsert error: ${error.message}`);
      inserted += rows.length;
    }

    updated = inserted; // upsert covers both
  } catch (e) {
    logStatus = "error";
    errorMessage = (e as Error).message;
    console.error("Sync error:", errorMessage);
  } finally {
    // Always deactivate account to save MetaAPI quota
    try {
      await undeployAccount();
    } catch (e) {
      console.log("undeploy warning:", (e as Error).message);
    }
  }

  // Insert log
  await supabase.from("broker_symbols_sync_log").insert({
    triggered_by: userId,
    status: logStatus,
    symbols_count: total,
    inserted_count: inserted,
    updated_count: updated,
    error_message: errorMessage,
    duration_ms: Date.now() - startedAt,
  });

  return new Response(
    JSON.stringify({
      ok: logStatus === "success",
      total,
      inserted,
      updated,
      error: errorMessage,
      duration_ms: Date.now() - startedAt,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
