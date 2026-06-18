// Sync completed tournament entry_fee payments into accounting_revenues
// House cut = tournaments.house_fee_pct (default 20%) of amount_usd.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve "Bullfy Tournament" revenue source
    const { data: src } = await supabase
      .from("accounting_revenue_sources")
      .select("id").eq("name", "Bullfy Tournament").maybeSingle();
    const sourceId = src?.id ?? null;

    // Find a system user for created_by (first global_admin)
    const { data: adminRole } = await supabase
      .from("user_roles").select("user_id").eq("role", "global_admin").limit(1).maybeSingle();
    const systemUser = adminRole?.user_id;
    if (!systemUser) {
      return new Response(JSON.stringify({ ok: false, error: "No system user found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pull completed entry_fee payments NOT yet synced
    const { data: synced } = await supabase
      .from("accounting_tournament_sync_log").select("tournament_order_id");
    const seen = new Set((synced ?? []).map((r: any) => r.tournament_order_id));

    const { data: payments, error: payErr } = await supabase
      .from("tournament_payments")
      .select("id, amount_usd, currency, created_at, tournament_id, tournaments(name, house_fee_pct)")
      .eq("type", "entry_fee")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(500);
    if (payErr) throw payErr;

    let inserted = 0;
    for (const p of payments ?? []) {
      if (seen.has(p.id)) continue;
      const t: any = p.tournaments;
      const housePct = Number(t?.house_fee_pct ?? 20);
      const houseAmount = Number(p.amount_usd) * (housePct / 100);
      const date = new Date(p.created_at).toISOString().slice(0, 10);

      const { data: rev, error: revErr } = await supabase
        .from("accounting_revenues")
        .insert({
          description: `Tournament fee · ${t?.name ?? p.tournament_id}`,
          revenue_date: date,
          amount_original: houseAmount,
          currency_original: (p.currency ?? "usd").toUpperCase(),
          source_id: sourceId,
          external_ref: p.id,
          created_by: systemUser,
          notes: `house_fee_pct=${housePct}% · gross=${p.amount_usd}`,
        })
        .select("id").single();
      if (revErr) {
        console.error("revenue insert error", revErr);
        continue;
      }

      await supabase.from("accounting_tournament_sync_log").insert({
        tournament_order_id: p.id,
        revenue_id: rev.id,
        amount_usd: houseAmount,
        notes: `entry_fee for ${t?.name ?? p.tournament_id}`,
      });
      inserted++;
    }

    return new Response(JSON.stringify({ ok: true, inserted, scanned: payments?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
