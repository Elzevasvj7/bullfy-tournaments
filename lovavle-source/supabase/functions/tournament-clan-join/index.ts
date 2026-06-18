// Unirse a un clan por invite_code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { invite_code } = await req.json();
    if (!invite_code) return err("Código requerido");

    if (user.clan_change_available_at && new Date(user.clan_change_available_at) > new Date()) {
      return err(`Cooldown activo hasta ${new Date(user.clan_change_available_at).toLocaleDateString()}.`);
    }

    const { data: clan } = await supa.from("tournament_clans")
      .select("id, name, members_count").eq("invite_code", String(invite_code).trim().toUpperCase()).maybeSingle();
    if (!clan) return err("Código inválido");

    // Ya está en algún clan?
    const { data: active } = await supa.from("tournament_clan_members")
      .select("clan_id").eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (active) return err("Ya perteneces a un clan. Sal primero.");

    const { error: insErr } = await supa.from("tournament_clan_members").insert({
      clan_id: clan.id, user_id: user.id, role: "member",
    });
    if (insErr) return err("Error uniéndose: " + insErr.message);

    await supa.rpc("tournament_award_points", {
      _user_id: user.id, _amount: 10, _reason: "clan_joined",
      _ref_type: "clan", _ref_id: clan.id,
    });

    return ok({ clan_id: clan.id, clan_name: clan.name });
  } catch (e) { return err((e as Error).message); }
});
