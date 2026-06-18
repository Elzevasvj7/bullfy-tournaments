// MLM Engine — Calculates and distributes commissions for a paid order
// Supports 3 modes:
//   - pool: legacy global pool % distributed across upline levels
//   - multi_product: per-product per-level % over each line_total
//   - business_partners (additive): % of total_usd to each active business partner
// Triggered when portal_orders.payment_status -> 'paid' (DB trigger or manual)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logFinancialEvent } from "../_shared/financial-log.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface MlmConfig {
  enabled: boolean;
  mlm_pool_percentage: number;
  refund_window_days: number;
  active_levels: number;
  commission_mode: "pool" | "multi_product";
  business_partners_enabled: boolean;
}

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body.order_id;

    if (!orderId || typeof orderId !== "string") {
      return jsonRes(400, { ok: false, error: "order_id is required" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Load order
    const { data: order, error: orderErr } = await supabase
      .from("portal_orders")
      .select("id, portal_id, partner_user_id, total_usd, payment_status, order_number, account_kind")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) return jsonRes(404, { ok: false, error: "Order not found" });

    // P7.3: las comisiones heredan el kind (real|demo) de la orden. Una orden
    // demo reparte comisiones demo a los wallets demo de la línea ascendente.
    const orderKind: string = order.account_kind === "demo" ? "demo" : "real";

    if (order.payment_status !== "paid") {
      return jsonRes(200, { ok: true, skipped: true, reason: `status=${order.payment_status}` });
    }

    // 2. Idempotency
    const { count: existing } = await supabase
      .from("portal_mlm_commissions")
      .select("*", { count: "exact", head: true })
      .eq("order_id", orderId);

    if ((existing ?? 0) > 0) {
      return jsonRes(200, { ok: true, skipped: true, reason: "Already processed" });
    }

    // 3. MLM config
    const { data: config } = await supabase
      .from("portal_mlm_config")
      .select("enabled, mlm_pool_percentage, refund_window_days, active_levels, commission_mode, business_partners_enabled")
      .eq("portal_id", order.portal_id)
      .maybeSingle();

    if (!config || !(config as any).enabled) {
      return jsonRes(200, { ok: true, skipped: true, reason: "MLM not enabled" });
    }
    const cfg = config as MlmConfig;

    // 4. Portal owner (for orphans)
    const { data: portal } = await supabase
      .from("partner_portals")
      .select("ib_id, ibs!inner(created_by)")
      .eq("id", order.portal_id)
      .maybeSingle();
    const portalOwnerUserId = (portal as any)?.ibs?.created_by ?? null;

    // 5. Upline chain
    const { data: uplineRows } = await supabase.rpc("get_user_upline", {
      _user_id: order.partner_user_id,
      _portal_id: order.portal_id,
      _max_levels: cfg.active_levels,
    });
    const uplineMap = new Map<number, string>();
    if (Array.isArray(uplineRows)) {
      for (const row of uplineRows as any[]) {
        // QA Fase 3: get_user_upline devuelve la columna `level_number`, NO `level`.
        // Antes se leía row.level (siempre undefined) → uplineMap quedaba vacío →
        // TODAS las comisiones MLM caían a portal_owner/huérfano y la red nunca cobraba.
        const lvl = row?.level_number ?? row?.level;
        if (lvl != null && row?.upline_user_id) {
          uplineMap.set(Number(lvl), String(row.upline_user_id));
        }
      }
    }

    const totalUsd = Number(order.total_usd) || 0;
    const refundDays = Number(cfg.refund_window_days) || 7;
    const availableAt = new Date(Date.now() + refundDays * 24 * 60 * 60 * 1000).toISOString();

    const commissionsToInsert: any[] = [];
    let totalDistributed = 0;

    // ============================================================
    // MODE: pool (legacy)
    // ============================================================
    if (cfg.commission_mode === "pool") {
      const { data: levels } = await supabase
        .from("portal_mlm_levels")
        .select("level_number, percentage")
        .eq("portal_id", order.portal_id)
        .lte("level_number", cfg.active_levels)
        .order("level_number", { ascending: true });

      if (levels && levels.length > 0) {
        const poolBase = +(totalUsd * (Number(cfg.mlm_pool_percentage) / 100)).toFixed(2);
        for (const lvl of levels as any[]) {
          const pct = Number(lvl.percentage);
          if (pct <= 0) continue;
          const amount = +(poolBase * (pct / 100)).toFixed(2);
          if (amount <= 0) continue;
          const upUser = uplineMap.get(lvl.level_number);
          const isOrphan = !upUser;
          commissionsToInsert.push({
            portal_id: order.portal_id,
            order_id: order.id,
            beneficiary_user_id: isOrphan ? null : upUser,
            beneficiary_type: isOrphan ? "portal_owner" : "partner_user",
            source_user_id: order.partner_user_id,
            level_number: lvl.level_number,
            percentage: pct,
            base_amount: poolBase,
            commission_amount: amount,
            currency: "USDT",
            status: "pending",
            available_at: availableAt,
          });
          totalDistributed += amount;
        }
      }
    }

    // ============================================================
    // MODE: multi_product (per-product per-level)
    // ============================================================
    if (cfg.commission_mode === "multi_product") {
      const { data: items } = await supabase
        .from("portal_order_items")
        .select("id, product_id, unit_price, quantity")
        .eq("order_id", order.id);

      for (const item of (items ?? []) as any[]) {
        const lineTotal = +(Number(item.unit_price) * Number(item.quantity)).toFixed(2);
        if (lineTotal <= 0) continue;

        const { data: prodLevels } = await supabase
          .from("portal_product_commission_levels")
          .select("level_number, percentage")
          .eq("product_id", item.product_id)
          .lte("level_number", cfg.active_levels)
          .order("level_number", { ascending: true });

        if (!prodLevels || prodLevels.length === 0) continue;

        for (const lvl of prodLevels as any[]) {
          const pct = Number(lvl.percentage);
          if (pct <= 0) continue;
          const amount = +(lineTotal * (pct / 100)).toFixed(2);
          if (amount <= 0) continue;
          const upUser = uplineMap.get(lvl.level_number);
          const isOrphan = !upUser;
          commissionsToInsert.push({
            portal_id: order.portal_id,
            order_id: order.id,
            beneficiary_user_id: isOrphan ? null : upUser,
            beneficiary_type: isOrphan ? "portal_owner" : "partner_user",
            source_user_id: order.partner_user_id,
            level_number: lvl.level_number,
            percentage: pct,
            base_amount: lineTotal,
            commission_amount: amount,
            currency: "USDT",
            status: "pending",
            available_at: availableAt,
          });
          totalDistributed += amount;
        }
      }
    }

    // ============================================================
    // ADDITIVE: business_partners (independent % over total_usd)
    // ============================================================
    let businessPartnerCount = 0;
    if (cfg.business_partners_enabled && totalUsd > 0) {
      const { data: partners } = await supabase
        .from("portal_business_partners")
        .select("partner_user_id, percentage")
        .eq("portal_id", order.portal_id)
        .eq("active", true);

      // Re-chequeo de elegibilidad (QA #5): solo reparte a BPs cuyo partner_user
      // sigue marcado can_be_business_partner=true. Defensa adicional al trigger
      // que desactiva los BPs al perder elegibilidad.
      const bpIds = (partners ?? []).map((p: any) => p.partner_user_id);
      let eligibleBp = new Set<string>();
      if (bpIds.length > 0) {
        const { data: elig } = await supabase
          .from("partner_users")
          .select("id")
          .in("id", bpIds)
          .eq("can_be_business_partner", true);
        eligibleBp = new Set(((elig ?? []) as any[]).map((u) => u.id));
      }

      for (const bp of (partners ?? []) as any[]) {
        if (!eligibleBp.has(bp.partner_user_id)) continue;
        const pct = Number(bp.percentage);
        if (pct <= 0) continue;
        const amount = +(totalUsd * (pct / 100)).toFixed(2);
        if (amount <= 0) continue;
        commissionsToInsert.push({
          portal_id: order.portal_id,
          order_id: order.id,
          beneficiary_user_id: bp.partner_user_id,
          beneficiary_type: "business_partner",
          source_user_id: order.partner_user_id,
          level_number: null,
          percentage: pct,
          base_amount: totalUsd,
          commission_amount: amount,
          currency: "USDT",
          status: "pending",
          available_at: availableAt,
        });
        totalDistributed += amount;
        businessPartnerCount++;
      }
    }

    if (commissionsToInsert.length === 0) {
      return jsonRes(200, { ok: true, skipped: true, reason: "Nothing to distribute" });
    }

    // Insert all commissions (heredan el kind de la orden)
    const { data: inserted, error: insErr } = await supabase
      .from("portal_mlm_commissions")
      .insert(commissionsToInsert.map((c) => ({ ...c, account_kind: orderKind })))
      .select("id, beneficiary_user_id, beneficiary_type, commission_amount");

    if (insErr) {
      console.error("Insert commissions failed:", insErr);
      await logFinancialEvent(supabase, {
        function_name: "mlm-engine", event_type: "commissions_failed",
        portal_id: order.portal_id, order_id: order.id, partner_user_id: order.partner_user_id,
        amount: +totalDistributed.toFixed(2), currency: "usd",
        result: "failed", error_message: insErr.message,
        payload: { mode: cfg.commission_mode },
      });
      return jsonRes(500, { ok: false, error: insErr.message });
    }

    // Wallet pending credits for partner_user + business_partner beneficiaries
    for (const c of inserted ?? []) {
      if (
        (c.beneficiary_type === "partner_user" || c.beneficiary_type === "business_partner") &&
        c.beneficiary_user_id
      ) {
        // Fase 3 / P2: acreditación ATÓMICA vía RPC SECURITY DEFINER (incremento
        // atómico de pending/total + asiento de ledger en una sola transacción).
        // Antes era read-modify-write en 3 llamadas sueltas → estado inconsistente
        // si fallaba a mitad y lost-update bajo concurrencia. Además el insert del
        // ledger con 'business_partner_commission_pending' fallaba por el CHECK.
        const { error: credErr } = await supabase.rpc("credit_commission_to_wallet", {
          _portal_id: order.portal_id,
          _user_id: c.beneficiary_user_id,
          _amount: Number(c.commission_amount),
          _txn_type:
            c.beneficiary_type === "business_partner"
              ? "business_partner_commission_pending"
              : "commission_pending",
          _reference_id: c.id,
          _description:
            c.beneficiary_type === "business_partner"
              ? `Comisión Socio del Portal — Orden ${order.order_number}`
              : `Comisión MLM pendiente — Orden ${order.order_number}`,
          _metadata: { order_id: order.id, order_number: order.order_number, mode: cfg.commission_mode },
          _account_kind: orderKind,
        });
        if (credErr) console.error("credit_commission_to_wallet failed", c.id, credErr);
      }
    }

    // P6: trazar la distribución de comisiones de la orden.
    await logFinancialEvent(supabase, {
      function_name: "mlm-engine", event_type: "commissions_distributed",
      portal_id: order.portal_id, order_id: order.id, partner_user_id: order.partner_user_id,
      amount: +totalDistributed.toFixed(2), currency: "usd", result: "success",
      payload: { mode: cfg.commission_mode, commissions_created: inserted?.length ?? 0 },
    });

    return jsonRes(200, {
      ok: true,
      order_id: order.id,
      order_number: order.order_number,
      mode: cfg.commission_mode,
      total_distributed: +totalDistributed.toFixed(2),
      commissions_created: inserted?.length ?? 0,
      business_partner_payouts: businessPartnerCount,
      portal_owner_user_id: portalOwnerUserId,
      available_at: availableAt,
    });
  } catch (err) {
    console.error("mlm-engine error:", err);
    return jsonRes(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
