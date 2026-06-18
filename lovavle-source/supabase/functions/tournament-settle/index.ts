// Liquida torneo. Acredita premios al wallet correcto (USD o BMoney) según liga.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireServiceRole } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Solo cron jobs o callers con service-role pueden liquidar torneos
  if (!requireServiceRole(req)) return err("No autorizado", {}, 403);
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { tournament_id } = await req.json().catch(() => ({}));

    let q = supa.from("tournaments").select("*").eq("status", "finished");
    if (tournament_id) q = q.eq("id", tournament_id);
    const { data: pending } = await q.limit(20);

    const { data: cfg } = await supa.from("tournament_global_config").select("*").eq("id", 1).single();
    const settled: string[] = [];

    for (const t of pending || []) {
      const { data: parts } = await supa.from("tournament_participants")
        .select("id, user_id, current_score, final_rank").eq("tournament_id", t.id)
        .order("current_score", { ascending: false });
      // Idempotencia: si ya tiene final_rank asignado, solo marcar como settled.
      if (parts && parts.length > 0 && parts.some((p: any) => p.final_rank != null)) {
        await supa.from("tournaments").update({ status: "settled" }).eq("id", t.id);
        settled.push(t.id);
        continue;
      }
      if (!parts || parts.length === 0) {
        await supa.from("tournaments").update({ status: "settled" }).eq("id", t.id);
        continue;
      }

      const league = t.league || "elite";
      const isBM = league === "bmoney";

      // Pool por moneda según liga
      const entryFee = isBM ? Number(t.entry_fee_bmoney || 0) : Number(t.entry_fee_usd || 0);
      const grossPool = entryFee * parts.length;
      const houseCut = grossPool * (Number(t.house_fee_pct || 0) / 100);
      const netPool = Math.max(0, grossPool - houseCut);
      // Solo BMoney/Élite cobrados; free Élite sigue usando prize_pool_usd patrocinado
      const prizesPaid = entryFee > 0 ? netPool : Number(t.prize_pool_usd || 0);

      const distribution: number[] = (t.prize_distribution as number[]) || [50, 30, 20];
      const bpPool = Number(t.bullfy_points_pool || 0);
      const baseWinnerBP: number[] = (cfg?.base_points_winner as number[]) || [500, 250, 100];
      const baseParticipationBP = cfg?.base_points_participation || 50;
      const mult = isBM ? Number(cfg?.bp_multiplier_bmoney ?? 1) : Number(cfg?.bp_multiplier_elite ?? 5);

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const rank = i + 1;
        const prizePctIdx = i < distribution.length ? distribution[i] : 0;
        const prizeAmount = prizesPaid * (prizePctIdx / 100);
        const baseBP = i < baseWinnerBP.length ? baseWinnerBP[i] : baseParticipationBP;
        const bpFromPool = i < distribution.length ? Math.round(bpPool * (distribution[i] / 100)) : 0;
        const totalBP = Math.round((baseBP + bpFromPool) * mult);

        await supa.from("tournament_participants").update({
          final_rank: rank,
          prize_won_usd: isBM ? 0 : prizeAmount,
          points_won: totalBP,
          status: rank === 1 ? "winner" : "active",
        }).eq("id", p.id);

        // Leer wallet UNA vez para liberar locked + acreditar premio en el mismo update
        const { data: w } = await supa.from("tournament_wallets")
          .select("balance_usd, locked_usd, bmoney_balance, bmoney_locked")
          .eq("user_id", p.user_id).maybeSingle();

        // Liberar el entry fee del locked (ya está gastado, no vuelve al disponible)
        const updates: Record<string, number> = {};
        if (entryFee > 0) {
          if (isBM) {
            updates.bmoney_locked = Math.max(0, Number(w?.bmoney_locked ?? 0) - entryFee);
          } else {
            updates.locked_usd = Math.max(0, Number(w?.locked_usd ?? 0) - entryFee);
          }
        }
        // Acreditar premio al disponible
        if (prizeAmount > 0) {
          if (isBM) {
            updates.bmoney_balance = Number(w?.bmoney_balance ?? 0) + prizeAmount;
          } else {
            updates.balance_usd = Number(w?.balance_usd ?? 0) + prizeAmount;
          }
        }
        if (Object.keys(updates).length > 0) {
          await supa.from("tournament_wallets").update(updates).eq("user_id", p.user_id);
        }
        if (prizeAmount > 0) {
          await supa.from("tournament_payments").insert({
            user_id: p.user_id, tournament_id: t.id, type: "prize_payout",
            amount_usd: prizeAmount, currency: isBM ? "bmoney" : "usd",
            gateway: "wallet", status: "completed", metadata: { rank, league },
          });
        }

        // Lifetime stats + BP (lifetime_winnings_usd solo cuando es USD real)
        const { data: u } = await supa.from("tournament_users")
          .select("lifetime_winnings_usd, bullfy_points").eq("id", p.user_id).single();
        await supa.from("tournament_users").update({
          lifetime_winnings_usd: Number(u?.lifetime_winnings_usd ?? 0) + (isBM ? 0 : prizeAmount),
          bullfy_points: Number(u?.bullfy_points ?? 0) + totalBP,
        }).eq("id", p.user_id);

        await supa.from("tournament_points_ledger").insert({
          user_id: p.user_id, delta: totalBP, reason: "tournament_prize",
          tournament_id: t.id, metadata: { rank, prize: prizeAmount, currency: isBM ? "bmoney" : "usd" },
        });
      }

      await supa.from("tournament_house_ledger").insert({
        tournament_id: t.id, gross_pool_usd: grossPool, house_cut_usd: houseCut,
        prizes_paid_usd: prizesPaid, net_revenue_usd: houseCut, participants_count: parts.length,
      });
      await supa.from("tournaments").update({ status: "settled", prize_pool_usd: isBM ? 0 : prizesPaid }).eq("id", t.id);
      settled.push(t.id);
    }

    return ok({ settled });
  } catch (e) {
    return err((e as Error).message);
  }
});
