// Daily FX rates fetcher → accounting_fx_rates
// Source: frankfurter.app (free, no key). Fallback: exchangerate.host
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "USD";
const TARGETS = ["COP", "AED", "EUR", "MXN", "GBP", "BRL", "ARS", "CLP", "PEN"];

async function fetchRates(date: string) {
  // Frankfurter: USD-base on date
  try {
    const url = `https://api.frankfurter.app/${date}?from=${BASE}&to=${TARGETS.join(",")}`;
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      return j.rates as Record<string, number>;
    }
  } catch (_) { /* fallback */ }
  // Fallback exchangerate.host
  const url2 = `https://api.exchangerate.host/${date}?base=${BASE}&symbols=${TARGETS.join(",")}`;
  const r2 = await fetch(url2);
  if (!r2.ok) throw new Error(`FX fetch failed: ${r2.status}`);
  const j2 = await r2.json();
  return j2.rates as Record<string, number>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const date = (body?.date as string) || new Date().toISOString().slice(0, 10);

    const rates = await fetchRates(date);

    const rows: Array<Record<string, unknown>> = [];
    // USD → X
    for (const [cur, rate] of Object.entries(rates)) {
      rows.push({ currency_from: BASE, currency_to: cur, rate, rate_date: date, source: "frankfurter" });
      // Inverse X → USD
      if (rate && Number(rate) > 0) {
        rows.push({ currency_from: cur, currency_to: BASE, rate: 1 / Number(rate), rate_date: date, source: "frankfurter" });
      }
    }
    // USD → USD = 1
    rows.push({ currency_from: BASE, currency_to: BASE, rate: 1, rate_date: date, source: "manual" });

    const { error } = await supabase
      .from("accounting_fx_rates")
      .upsert(rows, { onConflict: "currency_from,currency_to,rate_date" });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, date, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
