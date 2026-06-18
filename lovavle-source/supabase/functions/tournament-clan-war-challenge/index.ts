// Owner/officer de un clan reta a otro clan. Crea reto pendiente con deadline.
// PR #7 — A1: lockea el stake del challenger al crear el reto. El trigger SQL
//             tournament_clan_war_unlock_trigger devuelve el stake automáticamente
//             si el reto pasa a rejected/expired sin llegar a settlement.
// PR #7 — A5: acepta defender_invite_code como alternativa a defender_clan_id,
//             porque el frontend con anon key ya no puede consultar
//             tournament_clans por invite_code (REVOKE SELECT en migración).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const body = await req.json();
    let { defender_clan_id } = body;
    const { defender_invite_code, stake_usd, min_participants, duration_minutes, message } = body;

    // Resolver defender_invite_code → defender_clan_id (service_role bypassa RLS).
    if (!defender_clan_id && defender_invite_code) {
      const code = String(defender_invite_code).trim();
      if (!code) return err("defender_invite_code vacío");
      const { data: byCode } = await supa.from("tournament_clans")
        .select("id").eq("invite_code", code).maybeSingle();
      if (!byCode) return err("Código de clan inválido");
      defender_clan_id = byCode.id;
    }
    if (!defender_clan_id) return err("defender_clan_id o defender_invite_code requerido");

    const { data: actor } = await supa.from("tournament_clan_members")
      .select("clan_id, role").eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (!actor) return err("Debes pertenecer a un clan");
    if (!["owner","officer"].includes(actor.role)) return err("Solo owner/officer puede retar");
    if (actor.clan_id === defender_clan_id) return err("No puedes retar a tu propio clan");

    const { data: defender } = await supa.from("tournament_clans").select("id, members_count, name").eq("id", defender_clan_id).maybeSingle();
    if (!defender) return err("Clan defensor no encontrado");

    const { data: chal } = await supa.from("tournament_clans").select("members_count, name").eq("id", actor.clan_id).single();
    const minP = Math.max(3, Math.min(10, Number(min_participants || 3)));
    if (chal.members_count < minP) return err(`Tu clan necesita al menos ${minP} miembros activos`);
    if (defender.members_count < minP) return err(`El clan rival necesita al menos ${minP} miembros activos`);

    const stake = Math.max(0, Number(stake_usd || 0));
    const duration = Math.max(60, Math.min(10080, Number(duration_minutes || 1440)));

    // A1: lock del stake del challenger ANTES de crear el reto.
    // Sin esto la auditoría detectó "dinero de la nada": el reto se crea con
    // stake_usd pero el wallet del challenger nunca se toca, y al settle el
    // ganador recibe stake*2/N desde balance sin que haya existido un debit.
    if (stake > 0) {
      const { data: w } = await supa.from("tournament_wallets")
        .select("balance_usd").eq("user_id", user.id).maybeSingle();
      if (Number(w?.balance_usd ?? 0) < stake) {
        return err("Saldo USDT insuficiente para apostar");
      }
      const debit = await supa.rpc("tournament_wallet_debit", {
        p_user_id: user.id, p_usd: stake, p_bmoney: 0,
        p_lock_usd: true, p_lock_bmoney: false,
      });
      if (debit.error || debit.data === false) return err("No se pudo lockear stake del challenger");
    }

    const { data: war, error: insErr } = await supa.from("tournament_clan_wars").insert({
      challenger_clan_id: actor.clan_id, defender_clan_id,
      stake_usd: stake, min_participants: minP,
      message: message || null, status: "pending",
      created_by_user_id: user.id,
      metadata: { duration_minutes: duration },
    } as any).select().single();
    if (insErr) {
      // Rollback del lock si el INSERT del reto falla — RPC atómica.
      if (stake > 0) {
        await supa.rpc("tournament_wallet_unlock", { p_user_id: user.id, p_usd: stake });
      }
      return err("Error creando reto: " + insErr.message);
    }

    // Notificar a owner+officers del clan defensor
    const { data: defLeaders } = await supa.from("tournament_clan_members")
      .select("user_id").eq("clan_id", defender_clan_id).in("role", ["owner","officer"]).is("left_at", null);
    for (const m of (defLeaders || [])) {
      await supa.rpc("tournament_notify", {
        _user_id: m.user_id, _type: "clan_war_challenge",
        _title: `Reto de clan: ${chal.name}`,
        _message: `${chal.name} ha retado a tu clan por $${stake} USDT. Acepta o rechaza antes del deadline.`,
        _link: `/tournament/clans/${defender_clan_id}`,
        _ref_type: "clan_war", _ref_id: war.id,
      });
    }

    return ok({ war });
  } catch (e) { return err((e as Error).message); }
});
