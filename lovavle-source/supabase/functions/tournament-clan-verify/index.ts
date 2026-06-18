// Cobra $100 USDT del wallet del owner y marca el clan como verificado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

const VERIFY_COST_USD = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { clan_id } = await req.json();
    if (!clan_id) return err("clan_id requerido");

    const { data: clan } = await supa.from("tournament_clans").select("*").eq("id", clan_id).maybeSingle();
    if (!clan) return err("Clan no encontrado");
    if (clan.owner_id !== user.id) return err("Solo el owner puede pagar la verificación");
    if (clan.is_verified) return err("Clan ya verificado");

    const { data: w } = await supa.from("tournament_wallets")
      .select("balance_usd").eq("user_id", user.id).maybeSingle();
    if (Number(w?.balance_usd ?? 0) < VERIFY_COST_USD) {
      return err(`Saldo USDT insuficiente. Necesitas $${VERIFY_COST_USD}.`);
    }

    const debited = await supa.rpc("tournament_wallet_debit", {
      p_user_id: user.id, p_usd: VERIFY_COST_USD, p_bmoney: 0,
      p_lock_usd: false, p_lock_bmoney: false,
    });
    if (debited.error || debited.data === false) return err("No se pudo cobrar USDT");

    // PR #7 A3: chequear error del INSERT. Antes destructuraba solo `data`,
    // por lo que el fallo del enum (clan_verify no existía en
    // tournament_payment_type) quedaba silencioso: el debit ocurría, el
    // payment no se registraba, y el clan se marcaba verificado con
    // verified_payment_id = null. La migración de PR #7 agrega el valor al
    // enum; aquí cerramos el flanco haciendo rollback del debit si por
    // cualquier razón el INSERT sigue fallando.
    const { data: pay, error: payErr } = await supa.from("tournament_payments").insert({
      user_id: user.id, type: "clan_verify",
      amount_usd: VERIFY_COST_USD, currency: "usd", gateway: "wallet", status: "completed",
      metadata: { clan_id, clan_name: clan.name },
    }).select("id").single();

    if (payErr || !pay) {
      // Rollback del debit — devolver $100 al wallet.
      await supa.rpc("tournament_wallet_credit", {
        p_user_id: user.id, p_usd: VERIFY_COST_USD, p_bmoney: 0,
      });
      console.error("clan-verify: INSERT payment falló, debit revertido", {
        user_id: user.id, clan_id, error: payErr?.message,
      });
      return err("No se pudo registrar el pago: " + (payErr?.message || "error desconocido"));
    }

    await supa.from("tournament_clans").update({
      is_verified: true, verified_at: new Date().toISOString(),
      verified_payment_id: pay.id,
    }).eq("id", clan_id);

    await supa.rpc("tournament_award_points", {
      _user_id: user.id, _amount: 100, _reason: "clan_verified",
      _ref_type: "clan", _ref_id: clan_id,
    });

    return ok({ verified: true });
  } catch (e) { return err((e as Error).message); }
});
