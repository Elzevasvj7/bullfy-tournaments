// Crea torneo. Soporta liga 'bmoney' o 'elite'. Límite N torneos/día por usuario.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const body = await req.json();
    const {
      name, description, modality,
      starts_at, registration_closes_at, ends_at,
      max_participants, banner_url,
      group_size, advance_per_group, total_rounds, round_duration_minutes,
      starting_balance_usd, prize_distribution, scoring_weights, trading_rules,
      bullfy_points_pool,
      league,                    // 'bmoney' | 'elite'
      entry_fee_bmoney,          // requerido si league=bmoney
      entry_fee_usd,             // requerido si league=elite
      allows_funded_mt5,         // solo elite
      min_funded_equity_usd,     // solo elite + allows_funded_mt5
      house_fee_pct,             // opcional, default config
    } = body;

    if (!name || !modality || !starts_at || !ends_at) return err("Datos incompletos");
    if (!["pro", "standard"].includes(modality)) return err("Modalidad inválida");
    if (!["bmoney", "elite"].includes(league)) return err("Liga inválida");

    const { data: cfg } = await supa.from("tournament_global_config").select("*").eq("id", 1).single();

    // Límite de torneos creados por día
    const dailyLimit = Number(cfg?.max_tournaments_per_user_per_day ?? 2);
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const { count: createdToday } = await supa.from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("created_by_user_id", user.id).gte("created_at", dayStart.toISOString());
    if ((createdToday ?? 0) >= dailyLimit) {
      return err(`Has alcanzado el límite de ${dailyLimit} torneos creados por día.`);
    }

    // Validaciones por liga
    let type = "free";
    let entryFeeUSD = 0;
    let entryFeeBM = 0;

    if (league === "bmoney") {
      entryFeeBM = Number(entry_fee_bmoney ?? 0);
      if (entryFeeBM < 0) return err("Costo BMoney inválido");
      type = "free"; // mantiene compat con flags existentes
    } else {
      // elite
      entryFeeUSD = Number(entry_fee_usd ?? 0);
      if (entryFeeUSD < 0) return err("Costo USD inválido");
      type = entryFeeUSD > 0 ? "paid" : "free";
      if (entryFeeUSD > 0) {
        // requiere KYC + saldo
        if (user.kyc_status !== "approved") return err("Necesitas KYC aprobado para crear torneos Élite con dinero real");
        const { data: w } = await supa.from("tournament_wallets")
          .select("balance_usd").eq("user_id", user.id).maybeSingle();
        if (Number(w?.balance_usd ?? 0) < entryFeeUSD) {
          return err("Saldo USD insuficiente para cubrir tu propia inscripción");
        }
      }
    }

    const slug_base = (name as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const slug = `${slug_base}-${Math.random().toString(36).slice(2, 6)}`;

    const houseFee = house_fee_pct !== undefined && house_fee_pct !== null
      ? Number(house_fee_pct)
      : Number(cfg?.house_fee_pct_default ?? 25);

    const { data: t, error: insErr } = await supa.from("tournaments").insert({
      slug, name, description: description || null, banner_url: banner_url || null,
      type, modality, status: "scheduled", approval_status: "approved",
      created_by_user_id: user.id, approved_at: new Date().toISOString(),
      starts_at, registration_closes_at: registration_closes_at || starts_at, ends_at,
      max_participants: max_participants || 50,
      min_participants: 2,
      league,
      entry_fee_usd: entryFeeUSD,
      entry_fee_bmoney: entryFeeBM,
      allows_funded_mt5: league === "elite" ? !!allows_funded_mt5 : false,
      min_funded_equity_usd: league === "elite" && allows_funded_mt5 ? Number(min_funded_equity_usd || 0) : null,
      starting_balance_usd: starting_balance_usd || cfg?.default_starting_balance || 10000,
      group_size: group_size || cfg?.default_group_size || 10,
      advance_per_group: advance_per_group || cfg?.default_advance_per_group || 2,
      total_rounds: total_rounds || 1,
      round_duration_minutes: round_duration_minutes || cfg?.default_round_duration_minutes || 60,
      house_fee_pct: houseFee,
      prize_distribution: prize_distribution || [50, 30, 20],
      scoring_weights: scoring_weights || cfg?.default_scoring_weights || { profit_pct: 0.5, winrate: 0.2, profit_factor: 0.15, sharpe: 0.1, max_drawdown: 0.05 },
      trading_rules: trading_rules || cfg?.default_trading_rules || {},
      bullfy_points_pool: bullfy_points_pool || 1000,
      prize_pool_usd: 0,
    }).select("id, slug, status, approval_status, league").single();
    if (insErr) return err("Error creando torneo: " + insErr.message);

    return ok({ tournament: t });
  } catch (e) {
    return err((e as Error).message);
  }
});
