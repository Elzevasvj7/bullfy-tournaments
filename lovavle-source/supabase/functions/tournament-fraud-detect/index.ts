// Anti-fraude: detecta multi-cuenta por IP y copy-trading entre participantes activos.
// Se ejecuta cada 5 min vía pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { cors, ok, err, requireServiceRole } from "../_shared/tournament-helpers.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Solo cron jobs o callers con service-role
  if (!requireServiceRole(req)) return err("No autorizado", {}, 403);
  try {
    const supa = createClient(SUPABASE_URL, SVC);
    let createdFlags = 0;

    // 1. Multi-account por IP
    const { data: collisions } = await supa.rpc("tournament_detect_ip_collisions");
    for (const c of (collisions || []) as any[]) {
      // Saltar si ya hay flag pendiente para este conjunto
      const { data: existing } = await supa.from("tournament_fraud_flags")
        .select("id").eq("tournament_id", c.tournament_id)
        .eq("flag_type", "multi_account_ip")
        .contains("user_ids", c.user_ids).maybeSingle();
      if (existing) continue;

      await supa.from("tournament_fraud_flags").insert({
        tournament_id: c.tournament_id,
        flag_type: "multi_account_ip",
        severity: c.user_ids.length >= 3 ? "high" : "medium",
        user_ids: c.user_ids,
        participant_ids: c.participant_ids,
        evidence: { ip: c.ip, account_count: c.user_ids.length },
        description: `${c.user_ids.length} cuentas comparten IP ${c.ip} en este torneo`,
      });
      createdFlags++;
    }

    // 2. Copy-trading: trades del mismo símbolo, mismo type, ±5s, en mismo torneo
    // Análisis de últimos 30 min para no recalcular todo cada vez
    const { data: recentTrades } = await supa
      .from("tournament_trades")
      .select("id, participant_id, symbol, type, open_time, volume")
      .gte("open_time", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order("open_time", { ascending: true });

    const trades = (recentTrades || []) as any[];
    const matchKey = (t: any) => `${t.symbol}|${t.type}|${Math.floor(new Date(t.open_time).getTime() / 5000)}`;
    const groups = new Map<string, any[]>();
    for (const t of trades) {
      const k = matchKey(t);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(t);
    }

    const suspectPairs = new Set<string>();
    for (const [, group] of groups) {
      if (group.length < 2) continue;
      const uniqueParticipants = [...new Set(group.map((g) => g.participant_id))];
      if (uniqueParticipants.length < 2) continue;
      const key = uniqueParticipants.sort().join(",");
      suspectPairs.add(key);
    }

    for (const pairKey of suspectPairs) {
      const partIds = pairKey.split(",");
      const { data: parts } = await supa.from("tournament_participants")
        .select("id, user_id, tournament_id").in("id", partIds);
      if (!parts || parts.length < 2) continue;
      const tournamentId = parts[0].tournament_id;
      if (!parts.every((p) => p.tournament_id === tournamentId)) continue; // diferentes torneos

      const userIds = parts.map((p) => p.user_id);
      const { data: existing } = await supa.from("tournament_fraud_flags")
        .select("id").eq("tournament_id", tournamentId)
        .eq("flag_type", "copy_trading")
        .contains("user_ids", userIds)
        .eq("status", "pending").maybeSingle();
      if (existing) continue;

      await supa.from("tournament_fraud_flags").insert({
        tournament_id: tournamentId,
        flag_type: "copy_trading",
        severity: "medium",
        user_ids: userIds,
        participant_ids: partIds,
        evidence: { window_seconds: 5, suspect_count: partIds.length },
        description: `${partIds.length} participantes ejecutaron trades sincronizados (mismo símbolo/tipo en ±5s)`,
      });
      createdFlags++;
    }

    return ok({ created_flags: createdFlags, ip_collisions: collisions?.length || 0, copy_groups: suspectPairs.size });
  } catch (e) {
    console.error("tournament-fraud-detect error:", e);
    return err((e as Error).message);
  }
});
