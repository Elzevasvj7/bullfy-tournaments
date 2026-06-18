// Devuelve estado y movimientos en vivo de la cuenta MT5 del participante.
// Si la cuenta ya fue eliminada (mt5_deleted_at), sirve el snapshot histórico.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser, bridgeCall } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { participant_id } = await req.json();
    if (!participant_id) return err("participant_id requerido");

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { data: p } = await supa.from("tournament_participants")
      .select("id, user_id, mt5_login, mt5_server, mt5_suspended, mt5_deleted_at, final_balance, final_equity, final_pnl, final_pnl_pct, closed_at")
      .eq("id", participant_id).maybeSingle();
    if (!p) return err("Participante no encontrado");
    if (p.user_id !== user.id) return err("No autorizado");
    if (!p.mt5_login) return ok({ provisioned: false });

    // Cuenta ya borrada → servir snapshot histórico
    if (p.mt5_deleted_at) {
      const { data: snap } = await supa.from("tournament_deals_snapshot")
        .select("account_state, deals, positions, taken_at")
        .eq("participant_id", participant_id).maybeSingle();
      const dealsArr = Array.isArray(snap?.deals) ? snap?.deals : (snap?.deals as any)?.deals || [];
      return ok({
        provisioned: true,
        from_snapshot: true,
        suspended: true,
        deleted_at: p.mt5_deleted_at,
        final: {
          balance: p.final_balance, equity: p.final_equity,
          pnl: p.final_pnl, pnl_pct: p.final_pnl_pct, closed_at: p.closed_at,
        },
        account: snap?.account_state || null,
        deals: Array.isArray(dealsArr) ? dealsArr.slice(0, 50) : [],
        positions: snap?.positions || [],
        snapshot_taken_at: snap?.taken_at || null,
      });
    }

    const [acct, deals, positions] = await Promise.all([
      bridgeCall("GET", `/accounts/${p.mt5_login}`),
      bridgeCall("GET", `/users/${p.mt5_login}/deals`),
      bridgeCall("GET", `/users/${p.mt5_login}/positions`),
    ]);

    return ok({
      provisioned: true,
      from_snapshot: false,
      suspended: !!p.mt5_suspended,
      account: acct.ok ? acct.data : null,
      deals: deals.ok ? (Array.isArray(deals.data) ? deals.data.slice(0, 50) : deals.data) : [],
      positions: positions.ok ? positions.data : [],
    });
  } catch (e) {
    return err((e as Error).message);
  }
});
