// Cron-driven: avanza estados, abre/cierra ventana de trading, sincroniza stats MT5
// y limpia cuentas MT5 30 min después del cierre. Idempotente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, bridgeCall, requireServiceRole } from "../_shared/tournament-helpers.js";

function computeScore(weights: any, p: { profit_pct: number; winrate: number; profit_factor: number; sharpe: number; max_drawdown_pct: number }): number {
  // Acepta tanto las keys cortas (profit, drawdown) como las largas (profit_pct, max_drawdown)
  // para mantener compatibilidad con torneos creados con cualquier formato.
  const w = weights || {};
  const wProfit = Number(w.profit_pct ?? w.profit ?? 0.5) || 0;
  const wWinrate = Number(w.winrate ?? 0.2) || 0;
  const wPF = Number(w.profit_factor ?? 0.15) || 0;
  const wSharpe = Number(w.sharpe ?? 0.1) || 0;
  const wDD = Number(w.max_drawdown ?? w.drawdown ?? 0.05) || 0;
  return (
    wProfit * p.profit_pct +
    wWinrate * p.winrate +
    wPF * p.profit_factor +
    wSharpe * p.sharpe -
    wDD * p.max_drawdown_pct
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Solo cron jobs o callers con service-role pueden disparar el motor
  if (!requireServiceRole(req)) return err("No autorizado", {}, 403);
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString();

    let opened = 0, closed = 0, cleaned = 0, started = 0, queued = 0, synced = 0;

    // ============ FASE OPEN: scheduled -> running + habilitar MT5 ============
    const { data: toStart } = await supa.from("tournaments")
      .select("id, ends_at").eq("status", "scheduled").eq("approval_status", "approved")
      .lte("starts_at", now).limit(50);
    for (const t of toStart || []) {
      const cleanupAt = new Date(new Date(t.ends_at).getTime() + 30 * 60 * 1000).toISOString();
      await supa.from("tournaments").update({
        status: "running",
        trading_enabled_at: now,
        cleanup_at: cleanupAt,
      }).eq("id", t.id);

      // Habilitar todas las cuentas MT5 ya provisionadas
      const { data: parts } = await supa.from("tournament_participants")
        .select("id, mt5_login").eq("tournament_id", t.id).not("mt5_login", "is", null);
      for (const p of parts || []) {
        try {
          const r = await bridgeCall("POST", `/users/${p.mt5_login}/enable`, {});
          if (r.ok) {
            await supa.from("tournament_participants").update({ mt5_suspended: false }).eq("id", p.id);
            opened++;
          } else {
            console.warn("enable failed", p.mt5_login, r.status, r.data);
          }
        } catch (e) { console.warn("enable error", p.mt5_login, e); }
      }
      started++;
    }

    // ============ FASE CLOSE: running -> finished + cerrar posiciones + snapshot ============
    const { data: toFinish } = await supa.from("tournaments")
      .select("id, ends_at").eq("status", "running").lte("ends_at", now).limit(50);
    for (const t of toFinish || []) {
      const cleanupAt = new Date(new Date(t.ends_at).getTime() + 30 * 60 * 1000).toISOString();
      await supa.from("tournaments").update({
        status: "finished",
        trading_disabled_at: now,
        cleanup_at: cleanupAt,
      }).eq("id", t.id);

      const { data: parts } = await supa.from("tournament_participants")
        .select("id, mt5_login, starting_balance")
        .eq("tournament_id", t.id).not("mt5_login", "is", null);

      for (const p of parts || []) {
        try {
          // 1) Cerrar todas las posiciones abiertas (bulk con fallback individual)
          let bulk = await bridgeCall("POST", `/users/${p.mt5_login}/positions/close-all`, {});
          if (!bulk.ok) {
            // Fallback legacy underscore
            bulk = await bridgeCall("POST", `/users/${p.mt5_login}/positions/close_all`, {});
          }
          if (!bulk.ok) {
            // Fallback: cerrar una por una
            const openPos = await bridgeCall("GET", `/users/${p.mt5_login}/positions`);
            const list: any[] = Array.isArray(openPos.data) ? openPos.data : openPos.data?.positions || [];
            for (const pos of list) {
              const ticket = pos.ticket ?? pos.Ticket ?? pos.position_id ?? pos.id;
              if (!ticket) continue;
              const r = await bridgeCall("POST", `/users/${p.mt5_login}/positions/${ticket}/close`, {});
              if (!r.ok) console.warn("close_one failed", p.mt5_login, ticket, r.status, r.data);
            }
          }

          // 1b) Verificar residuales
          const verify = await bridgeCall("GET", `/users/${p.mt5_login}/positions`);
          const residual: any[] = Array.isArray(verify.data) ? verify.data : verify.data?.positions || [];
          if (residual.length > 0) {
            console.warn("close_phase_residual_positions", { login: p.mt5_login, count: residual.length });
          }

          // 2) Snapshot final (después de cerrar)
          const [acct, deals, positions] = await Promise.all([
            bridgeCall("GET", `/accounts/${p.mt5_login}`),
            bridgeCall("GET", `/users/${p.mt5_login}/deals`),
            bridgeCall("GET", `/users/${p.mt5_login}/positions`),
          ]);

          const balance = Number(acct.data?.balance ?? acct.data?.Balance ?? p.starting_balance);
          const equity = Number(acct.data?.equity ?? acct.data?.Equity ?? balance);
          const pnl = equity - Number(p.starting_balance);
          const pnlPct = Number(p.starting_balance) > 0 ? (pnl / Number(p.starting_balance)) * 100 : 0;

          await supa.from("tournament_deals_snapshot").upsert({
            participant_id: p.id,
            tournament_id: t.id,
            mt5_login: p.mt5_login,
            account_state: acct.ok ? acct.data : null,
            deals: deals.ok ? deals.data : null,
            positions: positions.ok ? positions.data : null,
            taken_at: now,
          }, { onConflict: "participant_id" });

          // 3) Suspender cuenta
          await bridgeCall("POST", `/users/${p.mt5_login}/suspend`, {});

          await supa.from("tournament_participants").update({
            current_balance: balance,
            current_equity: equity,
            final_balance: balance,
            final_equity: equity,
            final_pnl: pnl,
            final_pnl_pct: pnlPct,
            mt5_suspended: true,
            closed_at: now,
          }).eq("id", p.id);
          closed++;
        } catch (e) {
          console.warn("close phase failed for", p.id, e);
        }
      }
      queued++;
    }

    // ============ FASE CLEANUP: borrar cuentas MT5 30 min después del cierre ============
    const { data: toClean } = await supa.from("tournaments")
      .select("id").in("status", ["finished", "settled"]).eq("cleanup_done", false)
      .lte("cleanup_at", now).limit(50);
    for (const t of toClean || []) {
      const { data: parts } = await supa.from("tournament_participants")
        .select("id, mt5_login")
        .eq("tournament_id", t.id)
        .not("mt5_login", "is", null)
        .is("mt5_deleted_at", null);

      for (const p of parts || []) {
        try {
          const r = await bridgeCall("DELETE", `/users/${p.mt5_login}`);
          // Even on bridge error we mark deleted to avoid loops; logged below
          if (!r.ok) console.warn("bridge delete failed", p.mt5_login, r.status, r.data);
          await supa.from("tournament_participants").update({
            mt5_deleted_at: new Date().toISOString(),
          }).eq("id", p.id);
          cleaned++;
        } catch (e) {
          console.warn("cleanup error", p.mt5_login, e);
        }
      }
      await supa.from("tournaments").update({ cleanup_done: true }).eq("id", t.id);
    }

    // ============ SYNC stats para torneos en running (igual que antes) ============
    const { data: running } = await supa.from("tournaments")
      .select("id, scoring_weights, starting_balance_usd").eq("status", "running").limit(20);

    for (const t of running || []) {
      const { data: parts } = await supa.from("tournament_participants")
        .select("id, user_id, mt5_login, starting_balance, status")
        .eq("tournament_id", t.id).eq("status", "active");

      for (const p of parts || []) {
        if (!p.mt5_login) continue;
        try {
          const acc = await bridgeCall("GET", `/accounts/${p.mt5_login}`);
          const deals = await bridgeCall("GET", `/users/${p.mt5_login}/deals`);
          if (!acc.ok) continue;

          const equity = Number(acc.data?.equity ?? acc.data?.Equity ?? p.starting_balance);
          const balance = Number(acc.data?.balance ?? acc.data?.Balance ?? p.starting_balance);
          const profit_pct = ((equity - Number(p.starting_balance)) / Number(p.starting_balance)) * 100;

          const dealsList: any[] = Array.isArray(deals.data) ? deals.data : deals.data?.deals || [];
          // Considerar cerrado si entry == 1 (numérico MT5) o contiene "OUT" (string variants).
          // Excluir operaciones de balance/credit/correction.
          const isClosingDeal = (d: any) => {
            const entryRaw = d.entry ?? d.Entry;
            const entryStr = String(entryRaw ?? "").toUpperCase();
            const entryNum = Number(entryRaw);
            const isOut = entryNum === 1 || entryStr.includes("OUT");
            const typeStr = String(d.type ?? d.Type ?? "").toUpperCase();
            const isBalanceOp = typeStr.includes("BALANCE") || typeStr.includes("CREDIT") || typeStr.includes("CORRECTION");
            return isOut && !isBalanceOp;
          };
          const closedDeals = dealsList.filter(isClosingDeal);
          const wins = closedDeals.filter((d) => Number(d.profit ?? d.Profit ?? 0) > 0);
          const losses = closedDeals.filter((d) => Number(d.profit ?? d.Profit ?? 0) < 0);
          const trades_count = closedDeals.length;
          const winrate = trades_count > 0 ? (wins.length / trades_count) * 100 : 0;
          const grossWin = wins.reduce((s, d) => s + Number(d.profit ?? d.Profit ?? 0), 0);
          const grossLoss = Math.abs(losses.reduce((s, d) => s + Number(d.profit ?? d.Profit ?? 0), 0));
          const profit_factor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 5 : 0;

          const returns = closedDeals.map((d) => Number(d.profit ?? d.Profit ?? 0));
          const mean = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
          const variance = returns.length > 0 ? returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length : 0;
          const std = Math.sqrt(variance);
          const sharpe = std > 0 ? mean / std : 0;

          let peak = Number(p.starting_balance);
          let runEq = Number(p.starting_balance);
          let maxDD = 0;
          for (const d of closedDeals) {
            runEq += Number(d.profit ?? d.Profit ?? 0);
            if (runEq > peak) peak = runEq;
            const dd = peak > 0 ? ((peak - runEq) / peak) * 100 : 0;
            if (dd > maxDD) maxDD = dd;
          }

          let score = computeScore(t.scoring_weights, {
            profit_pct, winrate, profit_factor, sharpe, max_drawdown_pct: maxDD,
          });
          // Regla: sin trades cerrados → último en el ranking.
          // Asignamos un score centinela muy bajo para que queden siempre debajo
          // de cualquier participante que sí haya operado (incluso con pérdidas).
          if (trades_count === 0) score = -9999;

          await supa.from("tournament_participants").update({
            current_balance: balance, current_equity: equity,
            profit_pct, winrate, profit_factor, sharpe, max_drawdown_pct: maxDD,
            trades_count, winning_trades: wins.length, losing_trades: losses.length,
            current_score: score, last_synced_at: new Date().toISOString(),
          }).eq("id", p.id);
          synced++;
        } catch (e) {
          console.warn("Sync failed for participant", p.id, e);
        }
      }
    }

    return ok({ started, queued, opened, closed, cleaned, synced, ts: now });
  } catch (e) {
    return err((e as Error).message);
  }
});
