// Settlement automático para torneos tipo versus y clan_war.
// Se ejecuta vía pg_cron cada minuto. Cuando un torneo de estos tipos pasa su ends_at:
// - calcula el winner (versus por mayor score; clan_war por fórmula ponderada)
// - paga stakes desde locked, actualiza rating Elo del clan, otorga BP
// - finaliza el torneo (status='finished') para que el engine no lo procese de nuevo
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireServiceRole } from "../_shared/tournament-helpers.js";

const K_ELO = 25;

function eloDelta(ratingA: number, ratingB: number, winnerIsA: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const score = winnerIsA ? 1 : 0;
  return Math.round(K_ELO * (score - expected));
}

async function settleStakeToWinner(supa: any, loserUserId: string, winnerUserId: string, stake: number) {
  if (stake <= 0) return;
  // Loser: consume locked (sus fondos lockeados desaparecen — perdió).
  await supa.rpc("tournament_wallet_consume_locked", { p_user_id: loserUserId, p_usd: stake });
  // Winner: unlock su propio stake (locked → balance) y luego credit del stake del loser.
  // Resultado neto: -stake locked, +2*stake balance.
  await supa.rpc("tournament_wallet_unlock", { p_user_id: winnerUserId, p_usd: stake });
  await supa.rpc("tournament_wallet_credit", { p_user_id: winnerUserId, p_usd: stake, p_bmoney: 0 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Solo cron jobs o callers con service-role. Sin esto, cualquiera con la
  // URL pública del endpoint podía forzar liquidaciones y duplicar pagos.
  if (!requireServiceRole(req)) return err("No autorizado", {}, 403);
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString();

    // ===== VERSUS =====
    const { data: vTournaments } = await supa.from("tournaments")
      .select("id, slug, versus_id, ends_at, status")
      .eq("type", "versus").in("status", ["scheduled","live"]).lte("ends_at", now).limit(50);

    let versusProcessed = 0;
    for (const t of (vTournaments || [])) {
      // Sumar scores por participante
      const { data: parts } = await supa.from("tournament_participants")
        .select("user_id, current_score").eq("tournament_id", t.id);
      if (!parts || parts.length < 2) {
        await supa.from("tournaments").update({ status: "finished" })
          .eq("id", t.id).neq("status", "finished");
        continue;
      }
      const sorted = [...parts].sort((a, b) => Number(b.current_score || 0) - Number(a.current_score || 0));
      const winner = sorted[0];
      const loser = sorted[1];
      const { data: v } = await supa.from("tournament_versus").select("*").eq("id", t.versus_id).single();
      if (v) {
        // Lock idempotente: marcar el versus 'finished' PRIMERO con condición
        // de que aún no esté finished. Solo el caller que gana el lock pasa a
        // pagar el stake y notificar — previene doble pago si esta función
        // se ejecuta concurrentemente (race del cron + manual + retry).
        const { data: locked } = await supa.from("tournament_versus").update({
          status: "finished", winner_id: winner.user_id,
          challenger_score: parts.find((p: any) => p.user_id === v.challenger_id)?.current_score ?? 0,
          opponent_score: parts.find((p: any) => p.user_id === v.opponent_id)?.current_score ?? 0,
        }).eq("id", v.id).neq("status", "finished").select("id");

        if (locked && locked.length > 0) {
          await settleStakeToWinner(supa, loser.user_id, winner.user_id, Number(v.stake_usd));
          await supa.rpc("tournament_award_points", {
            _user_id: winner.user_id, _amount: 50, _reason: "versus_won",
            _ref_type: "versus", _ref_id: v.id,
          });
          await supa.rpc("tournament_notify", {
            _user_id: winner.user_id, _type: "versus_result",
            _title: "¡Ganaste el Versus!",
            _message: Number(v.stake_usd) > 0 ? `+$${(Number(v.stake_usd) * 2).toFixed(2)} USDT y +50 BP.` : `+50 BP.`,
            _link: `/tournament/versus`, _ref_type: "versus", _ref_id: v.id,
          });
          await supa.rpc("tournament_notify", {
            _user_id: loser.user_id, _type: "versus_result",
            _title: "Perdiste el Versus",
            _message: `Tu rival se llevó la victoria. Revancha cuando quieras.`,
            _link: `/tournament/versus`, _ref_type: "versus", _ref_id: v.id,
          });
        } else {
          console.warn("versus-settle: lock perdido o ya finalizado", { versus_id: v.id, tournament_id: t.id });
        }
      }
      await supa.from("tournaments").update({ status: "finished" })
        .eq("id", t.id).neq("status", "finished");
      versusProcessed++;
    }

    // ===== CLAN WARS =====
    const { data: wTournaments } = await supa.from("tournaments")
      .select("id, slug, clan_war_id, ends_at, status")
      .eq("type", "clan_war").in("status", ["scheduled","live"]).lte("ends_at", now).limit(20);

    let warsProcessed = 0;
    for (const t of (wTournaments || [])) {
      const { data: war } = await supa.from("tournament_clan_wars").select("*").eq("id", t.clan_war_id).single();
      if (!war) {
        await supa.from("tournaments").update({ status: "finished" })
          .eq("id", t.id).neq("status", "finished");
        continue;
      }

      // Miembros de cada bando inscritos
      const { data: parts } = await supa.from("tournament_participants")
        .select("user_id, current_score").eq("tournament_id", t.id);
      const { data: chalMembers } = await supa.from("tournament_clan_members")
        .select("user_id").eq("clan_id", war.challenger_clan_id).is("left_at", null);
      const { data: defMembers } = await supa.from("tournament_clan_members")
        .select("user_id").eq("clan_id", war.defender_clan_id).is("left_at", null);
      const chalSet = new Set((chalMembers || []).map((m: any) => m.user_id));
      const defSet = new Set((defMembers || []).map((m: any) => m.user_id));

      const chalScores = (parts || []).filter((p: any) => chalSet.has(p.user_id)).map((p: any) => Number(p.current_score || 0));
      const defScores = (parts || []).filter((p: any) => defSet.has(p.user_id)).map((p: any) => Number(p.current_score || 0));

      // Fórmula: 0.5*avg(top3) + 0.3*avg(all) + 0.2*(active/min_required)
      const calc = (arr: number[]) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => b - a);
        const topN = sorted.slice(0, 3);
        const avgTop = topN.reduce((s, x) => s + x, 0) / topN.length;
        const avgAll = arr.reduce((s, x) => s + x, 0) / arr.length;
        const participation = Math.min(1, arr.length / war.min_participants);
        return 0.5 * avgTop + 0.3 * avgAll + 0.2 * (participation * 100);
      };
      const cScore = calc(chalScores);
      const dScore = calc(defScores);
      const chalWins = cScore >= dScore;
      const winnerClanId = chalWins ? war.challenger_clan_id : war.defender_clan_id;
      const loserClanId = chalWins ? war.defender_clan_id : war.challenger_clan_id;

      // Lock idempotente: marcar el clan war 'finished' PRIMERO con condición
      // de que aún no esté finished. Solo el caller que gana el lock entra al
      // bloque de pagos/Elo/BP. Previene doble settle bajo concurrencia
      // (cron + manual + retry).
      const { data: warLocked } = await supa.from("tournament_clan_wars").update({
        status: "finished",
        winner_clan_id: winnerClanId,
        challenger_score: cScore,
        defender_score: dScore,
      }).eq("id", war.id).neq("status", "finished").select("id");

      if (!warLocked || warLocked.length === 0) {
        console.warn("clan-war-settle: lock perdido o ya finalizado", { war_id: war.id, tournament_id: t.id });
        await supa.from("tournaments").update({ status: "finished" })
          .eq("id", t.id).neq("status", "finished");
        warsProcessed++;
        continue;
      }

      // PR #7 A1: liquidación financiera del clan war.
      // Diseño de fondos:
      //  - challenger payer (war.created_by_user_id) y defender payer
      //    (war.metadata.accepted_by_user_id) lockean stake al crear/aceptar.
      //  - Si hay miembros del clan ganador que efectivamente participaron,
      //    se consume locked de ambos payers y el pot (stake*2) se reparte
      //    entre esos miembros.
      //  - Si NO hay participantes del clan ganador (war degenerado donde
      //    los puntajes empatan en 0 y nadie inscribió), se hace refund
      //    completo (unlock) a ambos payers en vez de quemar el dinero.
      const stake = Number(war.stake_usd || 0);
      const challengerPayerId: string | null = war.created_by_user_id ?? null;
      const defenderPayerId: string | null = war.metadata?.accepted_by_user_id ?? null;
      const winnerMembers = (parts || []).filter((p: any) => (chalWins ? chalSet : defSet).has(p.user_id));

      if (stake > 0) {
        if (winnerMembers.length > 0) {
          // Caso normal: consumir locked de ambos payers y repartir el pot.
          if (challengerPayerId) {
            await supa.rpc("tournament_wallet_consume_locked", { p_user_id: challengerPayerId, p_usd: stake });
          }
          if (defenderPayerId) {
            await supa.rpc("tournament_wallet_consume_locked", { p_user_id: defenderPayerId, p_usd: stake });
          }
          const perMember = (stake * 2) / winnerMembers.length;
          for (const wm of winnerMembers) {
            // tournament_wallet_credit es RPC atómica (UPDATE single-statement).
            await supa.rpc("tournament_wallet_credit", {
              p_user_id: wm.user_id, p_usd: perMember, p_bmoney: 0,
            });
          }
        } else {
          // Caso degenerado: refund a ambos payers, no perder dinero.
          console.warn("clan-war-settle: 0 participantes del clan ganador — refund a payers", {
            war_id: war.id, tournament_id: t.id,
          });
          if (challengerPayerId) {
            await supa.rpc("tournament_wallet_unlock", { p_user_id: challengerPayerId, p_usd: stake });
          }
          if (defenderPayerId) {
            await supa.rpc("tournament_wallet_unlock", { p_user_id: defenderPayerId, p_usd: stake });
          }
        }
      }

      // Elo: ratings actuales
      const { data: cClan } = await supa.from("tournament_clans").select("rating").eq("id", war.challenger_clan_id).single();
      const { data: dClan } = await supa.from("tournament_clans").select("rating").eq("id", war.defender_clan_id).single();
      const delta = eloDelta(cClan.rating, dClan.rating, chalWins);

      await supa.from("tournament_clans").update({
        rating: cClan.rating + delta,
        total_wars: (cClan as any).total_wars ? undefined : undefined, // ignore — sumamos abajo
      }).eq("id", war.challenger_clan_id);
      await supa.from("tournament_clans").update({
        rating: dClan.rating - delta,
      }).eq("id", war.defender_clan_id);

      // Bonus al creador del challenge sólo si su clan ganó
      if (chalWins) {
        await supa.rpc("tournament_award_points", {
          _user_id: war.created_by_user_id, _amount: 100, _reason: "clan_war_result",
          _ref_type: "clan_war", _ref_id: war.id,
        });
      }

      // total_wars +1 a ambos, wars_won +1 al ganador
      for (const cid of [war.challenger_clan_id, war.defender_clan_id]) {
        const { data: c } = await supa.from("tournament_clans").select("total_wars, wars_won").eq("id", cid).single();
        await supa.from("tournament_clans").update({
          total_wars: c.total_wars + 1,
          wars_won: c.wars_won + (cid === winnerClanId ? 1 : 0),
        }).eq("id", cid);
      }

      // BP a todos los participantes del clan ganador
      for (const wm of winnerMembers) {
        await supa.rpc("tournament_award_points", {
          _user_id: wm.user_id, _amount: 30, _reason: "clan_war_won",
          _ref_type: "clan_war", _ref_id: war.id,
        });
        await supa.rpc("tournament_notify", {
          _user_id: wm.user_id, _type: "clan_war_result",
          _title: "¡Tu clan ganó la guerra!", _message: "+30 BP por la victoria.",
          _link: `/tournament/clans/${winnerClanId}`, _ref_type: "clan_war", _ref_id: war.id,
        });
      }
      // Notificar miembros del clan perdedor
      const loserMembers = (parts || []).filter((p: any) => (chalWins ? defSet : chalSet).has(p.user_id));
      for (const lm of loserMembers) {
        await supa.rpc("tournament_notify", {
          _user_id: lm.user_id, _type: "clan_war_result",
          _title: "Tu clan perdió la guerra", _message: "Bien jugado. La próxima será.",
          _link: `/tournament/clans/${loserClanId}`, _ref_type: "clan_war", _ref_id: war.id,
        });
      }

      await supa.from("tournaments").update({ status: "finished" })
        .eq("id", t.id).neq("status", "finished");
      warsProcessed++;
    }

    // Expirar versus y wars pending fuera de deadline
    await supa.from("tournament_versus").update({ status: "expired" })
      .eq("status", "pending").lte("expires_at", now);
    await supa.from("tournament_clan_wars").update({ status: "expired" })
      .eq("status", "pending").lte("accept_deadline", now);

    return ok({ versusProcessed, warsProcessed });
  } catch (e) { return err((e as Error).message); }
});
