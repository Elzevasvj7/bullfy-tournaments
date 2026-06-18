// Inscripción al torneo. Cobra entrada en USD o BMoney según liga.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser, bridgeCall } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { tournament_id, slug, mt5_kind } = await req.json();
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    let q = supa.from("tournaments").select("*");
    q = tournament_id ? q.eq("id", tournament_id) : q.eq("slug", slug);
    const { data: t } = await q.maybeSingle();
    if (!t) return err("Torneo no encontrado");
    if (t.approval_status !== "approved") return err("Torneo no aprobado");
    if (!["scheduled", "running"].includes(t.status)) return err("Inscripciones cerradas");
    if (t.registration_closes_at && new Date(t.registration_closes_at) < new Date()) return err("Inscripción cerrada");
    if (t.participants_count >= t.max_participants) return err("Torneo lleno");

    const { data: existing } = await supa.from("tournament_participants")
      .select("id").eq("tournament_id", t.id).eq("user_id", user.id).maybeSingle();
    if (existing) return err("Ya estás inscrito");

    const league = t.league || "elite";
    const chosenKind = league === "bmoney" ? "demo" : (mt5_kind === "funded" ? "funded" : "demo");

    if (league === "elite" && chosenKind === "funded" && !t.allows_funded_mt5) {
      return err("Este torneo no permite cuenta fondeada");
    }

    // Cargar wallet
    let { data: w } = await supa.from("tournament_wallets")
      .select("balance_usd, locked_usd, bmoney_balance, bmoney_locked").eq("user_id", user.id).maybeSingle();
    if (!w) {
      const ins = await supa.from("tournament_wallets").insert({ user_id: user.id })
        .select("balance_usd, locked_usd, bmoney_balance, bmoney_locked").single();
      w = ins.data as any;
    }

    if (league === "elite") {
      const fee = Number(t.entry_fee_usd || 0);
      if (t.type === "elite" && (!user.is_elite || user.kyc_status !== "approved")) {
        return err("Necesitas KYC aprobado y estado Élite");
      }
      if (fee > 0) {
        if (user.kyc_status !== "approved") return err("Necesitas KYC aprobado para torneos con dinero real");
        const bal = Number(w?.balance_usd ?? 0);
        if (bal < fee) return err("Saldo USD insuficiente. Recarga tu Wallet/Cajero.");
        await supa.from("tournament_wallets").update({
          balance_usd: bal - fee,
          locked_usd: Number(w?.locked_usd ?? 0) + fee,
        }).eq("user_id", user.id);
        await supa.from("tournament_payments").insert({
          user_id: user.id, tournament_id: t.id, type: "entry_fee",
          amount_usd: fee, currency: "usd", gateway: "wallet", status: "completed",
        });
      }
    } else {
      // BMoney
      const fee = Number(t.entry_fee_bmoney || 0);
      if (fee > 0) {
        const bal = Number(w?.bmoney_balance ?? 0);
        if (bal < fee) return err("Saldo BMoney insuficiente. Solicita recarga en tu Wallet/Cajero.");
        await supa.from("tournament_wallets").update({
          bmoney_balance: bal - fee,
          bmoney_locked: Number(w?.bmoney_locked ?? 0) + fee,
        }).eq("user_id", user.id);
        await supa.from("tournament_payments").insert({
          user_id: user.id, tournament_id: t.id, type: "entry_fee",
          amount_usd: fee, currency: "bmoney", gateway: "wallet", status: "completed",
        });
      }
    }

    // Validación equity inicial para cuentas fondeadas (Élite + funded)
    let initialFundedEquity: number | null = null;
    if (league === "elite" && chosenKind === "funded") {
      const minEquity = Number(t.min_funded_equity_usd || 0);
      // El usuario debe tener una mt5_login fondeada registrada en tournament_mt5_accounts (kind=funded)
      const { data: mt5acc } = await supa.from("tournament_mt5_accounts")
        .select("mt5_login, mt5_server").eq("user_id", user.id).eq("kind", "funded").maybeSingle();
      if (!mt5acc?.mt5_login) return err("Necesitas registrar una cuenta MT5 fondeada en tu perfil antes de inscribirte.");
      const acct = await bridgeCall("GET", `/accounts/${mt5acc.mt5_login}`);
      if (!acct.ok) return err("No se pudo validar tu cuenta MT5 fondeada con el bridge.");
      const equity = Number(acct.data?.equity ?? acct.data?.Equity ?? 0);
      if (!equity || equity <= 0) return err("Equity MT5 inválido o cuenta inaccesible.");
      if (minEquity > 0 && equity < minEquity) {
        return err(`Equity insuficiente: tu cuenta tiene $${equity.toFixed(2)} USD pero este torneo requiere mínimo $${minEquity.toFixed(2)} USD.`);
      }
      initialFundedEquity = equity;
    }


    const { data: participant, error: pErr } = await supa.from("tournament_participants").insert({
      tournament_id: t.id, user_id: user.id,
      starting_balance: t.starting_balance_usd,
      current_balance: t.starting_balance_usd,
      current_equity: t.starting_balance_usd,
      mt5_login: null, mt5_password: null, mt5_server: null,
      status: "active",
      mt5_kind: chosenKind,
      entry_currency: league === "bmoney" ? "bmoney" : "usd",
      entry_paid: league === "bmoney" ? Number(t.entry_fee_bmoney || 0) : Number(t.entry_fee_usd || 0),
      initial_funded_equity_usd: initialFundedEquity,
    }).select("id").single();
    if (pErr) return err("Error inscribiendo: " + pErr.message);

    await supa.from("tournaments").update({ participants_count: (t.participants_count || 0) + 1 }).eq("id", t.id);

    return ok({ participant });
  } catch (e) {
    return err((e as Error).message);
  }
});
