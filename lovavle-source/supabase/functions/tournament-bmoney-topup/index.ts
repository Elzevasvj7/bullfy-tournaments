// Recarga BMoney a usuario: si balance < threshold y cooldown cumplido, setea a topup_amount.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { data: cfg } = await supa.from("tournament_global_config").select("*").eq("id", 1).maybeSingle();
    const threshold = Number(cfg?.bmoney_topup_threshold ?? 500);
    const amount = Number(cfg?.bmoney_topup_amount ?? 2000);
    const cooldownH = Number(cfg?.bmoney_topup_cooldown_hours ?? 24);

    // Asegurar wallet
    let { data: w } = await supa.from("tournament_wallets")
      .select("bmoney_balance, last_bmoney_topup_at").eq("user_id", user.id).maybeSingle();
    if (!w) {
      const ins = await supa.from("tournament_wallets").insert({ user_id: user.id }).select("bmoney_balance, last_bmoney_topup_at").single();
      w = ins.data as any;
    }

    const before = Number(w?.bmoney_balance ?? 0);
    if (before >= threshold) return err(`Tu saldo BMoney está por encima del umbral (${threshold}). No puedes recargar todavía.`);

    if (w?.last_bmoney_topup_at) {
      const last = new Date(w.last_bmoney_topup_at).getTime();
      const next = last + cooldownH * 3600_000;
      if (Date.now() < next) {
        return err(`Debes esperar al cooldown. Próxima recarga disponible: ${new Date(next).toISOString()}`, {
          next_available_at: new Date(next).toISOString(),
        });
      }
    }

    const now = new Date().toISOString();
    await supa.from("tournament_wallets").update({
      bmoney_balance: amount,
      last_bmoney_topup_at: now,
    }).eq("user_id", user.id);

    await supa.from("tournament_bmoney_topups").insert({
      user_id: user.id, amount, balance_before: before, balance_after: amount,
    });

    return ok({ balance_after: amount, next_available_at: new Date(Date.now() + cooldownH * 3600_000).toISOString() });
  } catch (e) {
    return err((e as Error).message);
  }
});
