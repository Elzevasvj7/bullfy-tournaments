// Oponente responde: accept (crea torneo privado e inscribe a ambos) o reject (devuelve stake).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { versus_id, decision } = await req.json();
    if (!versus_id || !["accept","reject","cancel"].includes(decision)) return err("Datos inválidos");

    const { data: v } = await supa.from("tournament_versus").select("*").eq("id", versus_id).maybeSingle();
    if (!v) return err("Reto no encontrado");
    if (v.status !== "pending") return err("Reto ya respondido");

    if (decision === "cancel") {
      if (v.challenger_id !== user.id) return err("Solo el retador puede cancelar");
      if (Number(v.stake_usd) > 0) {
        // unlock
        const { data: w } = await supa.from("tournament_wallets").select("locked_usd, balance_usd").eq("user_id", v.challenger_id).single();
        await supa.from("tournament_wallets").update({
          locked_usd: Math.max(0, Number(w.locked_usd) - Number(v.stake_usd)),
          balance_usd: Number(w.balance_usd) + Number(v.stake_usd),
        }).eq("user_id", v.challenger_id);
      }
      await supa.from("tournament_versus").update({ status: "cancelled" }).eq("id", versus_id);
      return ok({});
    }

    if (v.opponent_id !== user.id) return err("Solo el retado puede responder");

    if (decision === "reject") {
      // refund challenger
      if (Number(v.stake_usd) > 0) {
        const { data: w } = await supa.from("tournament_wallets").select("locked_usd, balance_usd").eq("user_id", v.challenger_id).single();
        await supa.from("tournament_wallets").update({
          locked_usd: Math.max(0, Number(w.locked_usd) - Number(v.stake_usd)),
          balance_usd: Number(w.balance_usd) + Number(v.stake_usd),
        }).eq("user_id", v.challenger_id);
      }
      await supa.from("tournament_versus").update({ status: "rejected" }).eq("id", versus_id);
      await supa.rpc("tournament_notify", {
        _user_id: v.challenger_id, _type: "versus_response",
        _title: `Reto rechazado`, _message: `${user.full_name} rechazó tu reto 1v1.`,
        _link: `/tournament/versus`, _ref_type: "versus", _ref_id: versus_id,
      });
      return ok({});
    }

    // ACCEPT — opponent debe lockear su stake también
    if (Number(v.stake_usd) > 0) {
      const { data: w } = await supa.from("tournament_wallets").select("balance_usd").eq("user_id", user.id).maybeSingle();
      if (Number(w?.balance_usd ?? 0) < Number(v.stake_usd)) return err("Saldo USDT insuficiente para igualar la apuesta");
      const debit = await supa.rpc("tournament_wallet_debit", {
        p_user_id: user.id, p_usd: Number(v.stake_usd), p_bmoney: 0, p_lock_usd: true, p_lock_bmoney: false,
      });
      if (debit.error || debit.data === false) return err("No se pudo lockear stake");
    }

    // Crear torneo privado tipo versus
    const starts = new Date(Date.now() + 60 * 1000); // arranca en 1 min
    const ends = new Date(starts.getTime() + Number(v.duration_minutes) * 60 * 1000);
    const slug = `versus-${versus_id.slice(0, 8)}`;
    const { data: cfg } = await supa.from("tournament_global_config").select("*").eq("id", 1).single();

    const { data: t, error: tErr } = await supa.from("tournaments").insert({
      slug, name: `Versus 1v1`, description: "Reto directo entre traders",
      type: "versus", modality: "standard", status: "scheduled", approval_status: "approved",
      created_by_user_id: v.challenger_id, approved_at: new Date().toISOString(),
      starts_at: starts.toISOString(), registration_closes_at: starts.toISOString(), ends_at: ends.toISOString(),
      max_participants: 2, min_participants: 2,
      league: "bmoney", entry_fee_usd: 0, entry_fee_bmoney: 0,
      starting_balance_usd: cfg?.default_starting_balance || 10000,
      group_size: 2, advance_per_group: 1, total_rounds: 1,
      round_duration_minutes: Number(v.duration_minutes),
      house_fee_pct: 0,
      prize_distribution: [100],
      scoring_weights: cfg?.default_scoring_weights || { profit_pct: 0.5, winrate: 0.2, profit_factor: 0.15, sharpe: 0.1, max_drawdown: 0.05 },
      trading_rules: cfg?.default_trading_rules || {},
      bullfy_points_pool: 100,
      prize_pool_usd: Number(v.stake_usd) * 2,
      versus_id, is_private: true,
    }).select("id, slug").single();
    if (tErr) return err("Error creando torneo: " + tErr.message);

    // Auto-inscribir ambos. Si falla alguno se loguea explícitamente — antes
    // se silenciaba con `.then(()=>{},()=>{})` lo que dejaba el torneo creado
    // sin participantes y sin trazabilidad.
    for (const uid of [v.challenger_id, user.id]) {
      const { error: pErr } = await supa.from("tournament_participants").insert({
        tournament_id: t.id, user_id: uid, mt5_kind: "demo",
      });
      if (pErr) {
        console.error("versus-respond: auto-enroll falló", { tournament_id: t.id, user_id: uid, error: pErr.message });
      }
    }

    await supa.from("tournament_versus").update({
      status: "accepted", tournament_id: t.id,
      accepted_at: new Date().toISOString(),
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    }).eq("id", versus_id);

    // Notificar al retador que se aceptó
    await supa.rpc("tournament_notify", {
      _user_id: v.challenger_id, _type: "versus_response",
      _title: `¡Reto aceptado!`,
      _message: `${user.full_name} aceptó tu duelo. Arranca en 1 minuto.`,
      _link: `/tournament/t/${t.slug}`, _ref_type: "versus", _ref_id: versus_id,
    });

    return ok({ tournament_slug: t.slug });
  } catch (e) { return err((e as Error).message); }
});
