// Owner/officer del clan defensor responde: accept (crea torneo privado clan_war) | reject.
// PR #7 — A1: en accept, lockea el stake del defender antes de crear el torneo.
//             En reject/expired, el trigger SQL tournament_clan_war_unlock_trigger
//             desbloquea automáticamente el stake del challenger.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { war_id, decision } = await req.json();
    if (!war_id || !["accept","reject"].includes(decision)) return err("Datos inválidos");

    const { data: war } = await supa.from("tournament_clan_wars").select("*").eq("id", war_id).maybeSingle();
    if (!war) return err("Reto no encontrado");
    if (war.status !== "pending") return err("Ya respondido");
    if (new Date(war.accept_deadline) < new Date()) {
      // A1: el trigger desbloquea el stake del challenger al pasar a 'expired'.
      await supa.from("tournament_clan_wars").update({ status: "expired" }).eq("id", war_id);
      return err("Reto expirado");
    }

    const { data: actor } = await supa.from("tournament_clan_members")
      .select("clan_id, role").eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (!actor || actor.clan_id !== war.defender_clan_id) return err("No perteneces al clan defensor");
    if (!["owner","officer"].includes(actor.role)) return err("Sin permisos");

    const { data: chal } = await supa.from("tournament_clans").select("name").eq("id", war.challenger_clan_id).single();
    const { data: def } = await supa.from("tournament_clans").select("name").eq("id", war.defender_clan_id).single();

    if (decision === "reject") {
      // A1: trigger desbloquea automáticamente el stake del challenger al pasar a 'rejected'.
      await supa.from("tournament_clan_wars").update({ status: "rejected" }).eq("id", war_id);
      // Notificar al retador
      await supa.rpc("tournament_notify", {
        _user_id: war.created_by_user_id, _type: "clan_war_response",
        _title: `Reto rechazado`, _message: `${def.name} rechazó tu reto de clan.`,
        _link: `/tournament/clans/${war.challenger_clan_id}`,
        _ref_type: "clan_war", _ref_id: war_id,
      });
      return ok({});
    }

    // ACCEPT — A1: lock del stake del defender ANTES de crear el torneo.
    // Sin esto, settle pagaba stake*2/N a los ganadores desde balance sin que
    // ningún wallet hubiera sido debitado (emisión monetaria a voluntad).
    const stake = Number(war.stake_usd || 0);
    if (stake > 0) {
      const { data: w } = await supa.from("tournament_wallets")
        .select("balance_usd").eq("user_id", user.id).maybeSingle();
      if (Number(w?.balance_usd ?? 0) < stake) {
        return err("Saldo USDT insuficiente para igualar la apuesta del clan");
      }
      const debit = await supa.rpc("tournament_wallet_debit", {
        p_user_id: user.id, p_usd: stake, p_bmoney: 0,
        p_lock_usd: true, p_lock_bmoney: false,
      });
      if (debit.error || debit.data === false) return err("No se pudo lockear stake del defender");
    }

    // ACCEPT — crear torneo privado
    const duration = Number((war.metadata?.duration_minutes ?? 1440));
    const starts = new Date(Date.now() + 5 * 60 * 1000); // 5 min para que se inscriban
    const ends = new Date(starts.getTime() + duration * 60 * 1000);
    const slug = `clanwar-${war_id.slice(0, 8)}`;
    const { data: cfg } = await supa.from("tournament_global_config").select("*").eq("id", 1).single();

    const { data: t, error: tErr } = await supa.from("tournaments").insert({
      slug, name: `Clan War: ${chal.name} vs ${def.name}`,
      description: war.message || "Guerra de clanes",
      type: "clan_war", modality: "standard", status: "scheduled", approval_status: "approved",
      created_by_user_id: war.created_by_user_id, approved_at: new Date().toISOString(),
      starts_at: starts.toISOString(), registration_closes_at: starts.toISOString(), ends_at: ends.toISOString(),
      max_participants: 200, min_participants: war.min_participants * 2,
      league: "bmoney", entry_fee_usd: 0, entry_fee_bmoney: 0,
      starting_balance_usd: cfg?.default_starting_balance || 10000,
      group_size: 50, advance_per_group: 50, total_rounds: 1,
      round_duration_minutes: duration,
      house_fee_pct: 0,
      prize_distribution: [100],
      scoring_weights: cfg?.default_scoring_weights || { profit_pct: 0.5, winrate: 0.2, profit_factor: 0.15, sharpe: 0.1, max_drawdown: 0.05 },
      trading_rules: cfg?.default_trading_rules || {},
      bullfy_points_pool: 500,
      prize_pool_usd: stake * 2,
      clan_war_id: war_id, is_private: true,
    }).select("id, slug").single();
    if (tErr) {
      // Rollback: desbloquear el stake del defender. El stake del challenger
      // se mantiene lockeado porque el war sigue en 'pending'; si el caller
      // luego rechaza/deja expirar, el trigger lo libera.
      if (stake > 0) {
        await supa.rpc("tournament_wallet_unlock", { p_user_id: user.id, p_usd: stake });
      }
      return err("Error creando torneo: " + tErr.message);
    }

    // Guardar accepted_by_user_id en metadata para que settle sepa quién
    // pagó el stake del defender y consuma su locked al liquidar.
    const newMetadata = { ...(war.metadata || {}), accepted_by_user_id: user.id };
    await supa.from("tournament_clan_wars").update({
      status: "accepted", tournament_id: t.id,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      metadata: newMetadata,
    }).eq("id", war_id);

    // Notificar a todos los miembros de ambos clanes
    const { data: members } = await supa.from("tournament_clan_members")
      .select("user_id").in("clan_id", [war.challenger_clan_id, war.defender_clan_id]).is("left_at", null);
    for (const m of (members || [])) {
      await supa.rpc("tournament_notify", {
        _user_id: m.user_id, _type: "clan_war_response",
        _title: `¡Clan War aceptada!`,
        _message: `${chal.name} vs ${def.name} — inscríbete antes del inicio.`,
        _link: `/tournament/t/${t.slug}`,
        _ref_type: "clan_war", _ref_id: war_id,
      });
    }

    return ok({ tournament_slug: t.slug });
  } catch (e) { return err((e as Error).message); }
});
