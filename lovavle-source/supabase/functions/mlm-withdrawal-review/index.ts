// Revisión de retiros por el ADMIN (gate de aprobación en la app).
//   action 'approve' → marca approved_at/approved_by y dispara el procesador (crea el
//                       batch de payout en NOWPayments, que queda WAITING).
//   action 'reject'  → refund_withdrawal (reintegra el saldo del IB, marca failed).
// Solo admin/global_admin. Los retiros REALES no se procesan sin pasar por aquí.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { action, withdrawal_id, reason } = await req.json().catch(() => ({}));

    // Auth: requiere admin o global_admin.
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ ok: false, error: "No autorizado" }, 401);

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "global_admin"]);
    if (!roles || roles.length === 0) return json({ ok: false, error: "Permisos insuficientes" }, 403);

    // Listado de retiros REALES pendientes de aprobación (para el panel admin).
    if (action === "list") {
      const { data: rows, error: listErr } = await supabase
        .from("portal_withdrawal_requests")
        .select("id, request_number, portal_id, user_id, amount_requested, fee_amount, amount_net, currency, network, destination_address, payout_method, status, created_at, partner_users:user_id(nombre, email), partner_portals:portal_id(nombre_portal)")
        .eq("status", "pending")
        .eq("account_kind", "real")
        .order("created_at", { ascending: true })
        .limit(100);
      if (listErr) throw listErr;
      return json({ ok: true, withdrawals: rows ?? [] });
    }

    if (!withdrawal_id) return json({ ok: false, error: "withdrawal_id requerido" }, 400);

    const { data: w } = await supabase
      .from("portal_withdrawal_requests")
      .select("id, status, account_kind")
      .eq("id", withdrawal_id)
      .maybeSingle();
    if (!w) return json({ ok: false, error: "Retiro no encontrado" }, 404);
    if (w.status !== "pending") return json({ ok: false, error: `El retiro no está pendiente (${w.status})` }, 409);

    if (action === "approve") {
      // Marca aprobado y dispara el procesador (crea el batch en NOWPayments).
      const { error: updErr } = await supabase
        .from("portal_withdrawal_requests")
        .update({ approved_at: new Date().toISOString(), approved_by: user.id })
        .eq("id", withdrawal_id)
        .eq("status", "pending");
      if (updErr) throw updErr;

      const { data: procRes, error: procErr } = await supabase.functions.invoke("mlm-withdrawal-process", {
        body: { withdrawal_id },
      });
      if (procErr) {
        // Si el procesador no se pudo invocar, no dejamos la solicitud aprobada en limbo:
        // queda 'pending' aprobada y un reintento (o el polling) la tomará.
        console.error("mlm-withdrawal-process invoke failed", withdrawal_id, procErr);
        return json({ ok: true, approved: true, processed: false, warning: "Aprobado; el procesamiento se reintentará." });
      }
      return json({ ok: true, approved: true, processed: true, result: procRes });
    }

    if (action === "reject") {
      const { data: res, error } = await supabase.rpc("refund_withdrawal", {
        _withdrawal_id: withdrawal_id,
        _reason: reason || "Rechazado por el administrador",
      });
      if (error) throw error;
      return json({ ok: true, rejected: true, result: res });
    }

    return json({ ok: false, error: "Acción no reconocida (approve|reject)" }, 400);
  } catch (err: any) {
    return json({ ok: false, error: err.message }, 500);
  }
});
