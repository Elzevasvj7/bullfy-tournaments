// MLM Release Commissions — Cron job
// Moves commissions from 'pending' to 'available' when refund window expires.
// For each released commission: decrements wallet.pending_balance, increments wallet.available_balance,
// and writes a 'release_to_available' transaction in the ledger.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logFinancialEvent } from "../_shared/financial-log.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch ALL pending commissions whose refund window has expired (batched)
    const BATCH = 500;
    const { data: due, error: dueErr } = await supabase
      .from("portal_mlm_commissions")
      .select(
        "id, portal_id, beneficiary_user_id, beneficiary_type, commission_amount, order_id"
      )
      .eq("status", "pending")
      .lte("available_at", new Date().toISOString())
      .limit(BATCH);

    if (dueErr) {
      console.error("Failed to fetch due commissions:", dueErr);
      return jsonRes(500, { ok: false, error: dueErr.message });
    }

    if (!due || due.length === 0) {
      return jsonRes(200, {
        ok: true,
        processed: 0,
        message: "No commissions to release",
      });
    }

    let releasedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const c of due) {
      try {
        // Fase 3 / P2: liberación ATÓMICA vía RPC SECURITY DEFINER. El flip de
        // status + el movimiento pending→available + el asiento de ledger van en
        // UNA transacción con FOR UPDATE de la comisión. Antes eran 3 llamadas
        // sueltas: un fallo a mitad dejaba la comisión 'available' con el saldo
        // sin mover (dinero atrapado en pending para siempre).
        const { data: result, error: relErr } = await supabase.rpc("release_commission", {
          _commission_id: c.id,
        });
        if (relErr) {
          errors.push(`commission ${c.id}: ${relErr.message}`);
          continue;
        }
        if (result === "released") releasedCount++;
        else if (result === "marked_no_wallet") skippedCount++;
        // 'skipped' = ya procesada por otra corrida; no se cuenta.
      } catch (loopErr) {
        errors.push(
          `commission ${c.id}: ${
            loopErr instanceof Error ? loopErr.message : String(loopErr)
          }`
        );
      }
    }

    // P6: trazar la corrida del cron de liberación (resumen del batch).
    await logFinancialEvent(supabase, {
      function_name: "mlm-release-commissions",
      event_type: "commissions_released",
      currency: "usd",
      result: errors.length > 0 ? "failed" : "success",
      error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      payload: { processed: due.length, released: releasedCount, marked: skippedCount, errors: errors.length },
    });

    return jsonRes(200, {
      ok: true,
      processed: due.length,
      released: releasedCount,
      portal_owner_marked: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      has_more: due.length === BATCH,
    });
  } catch (err) {
    console.error("mlm-release-commissions error:", err);
    return jsonRes(500, {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
