// Solicita retiro desde wallet USD (mínimo configurable). USDT TRC20.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

const MIN_WITHDRAW = 25;
const FEE_PCT = 0.02; // 2% comisión

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { amount_usd, wallet_address, network = "TRC20" } = await req.json();
    const amount = Number(amount_usd);
    if (!amount || amount < MIN_WITHDRAW) return err(`Monto mínimo: ${MIN_WITHDRAW} USDT`);

    // Validación TRC20: las direcciones reales son exactamente 34 caracteres,
    // empiezan con "T" y usan el alfabeto Base58 (sin 0, O, I, l). Esto evita
    // que un usuario envíe el dinero a una dirección malformada por error.
    const addr = (wallet_address || "").trim();
    if (network === "TRC20") {
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) {
        return err("Dirección USDT TRC20 inválida (debe tener 34 caracteres y empezar con 'T')");
      }
    } else if (!addr || addr.length < 20) {
      return err("wallet_address inválida");
    }

    const { data: w } = await supa.from("tournament_wallets")
      .select("balance_usd, locked_usd").eq("user_id", user.id).maybeSingle();
    const bal = Number(w?.balance_usd ?? 0);
    if (bal < amount) return err("Saldo insuficiente");

    const fee = +(amount * FEE_PCT).toFixed(2);
    const net = +(amount - fee).toFixed(2);

    // Lock funds
    await supa.from("tournament_wallets").update({
      balance_usd: bal - amount,
      locked_usd: Number(w?.locked_usd ?? 0) + amount,
    }).eq("user_id", user.id);

    const { data: row, error: rErr } = await supa.from("tournament_withdrawals").insert({
      user_id: user.id, amount_usd: amount, fee_usd: fee, net_usd: net,
      wallet_address: addr, network, status: "pending",
    }).select().single();
    if (rErr) return err(rErr.message);

    return ok({ withdrawal: row });
  } catch (e) {
    return err((e as Error).message);
  }
});
