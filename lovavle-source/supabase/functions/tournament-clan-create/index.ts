// Crea un clan: valida tag/nombre únicos, asigna owner, genera invite_code.
// PR #7 — C9: el INSERT del clan y del owner-member se hace vía RPC
//             tournament_clan_create_atomic, que envuelve ambos en una
//             sola transacción. Antes eran INSERTs separados y un fallo
//             en el segundo dejaba un clan huérfano sin owner en
//             tournament_clan_members.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

function genInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = new Uint8Array(8); crypto.getRandomValues(a);
  return "BULL-" + Array.from(a).map((x) => chars[x % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { name, tag, description, logo_url, banner_url, is_public } = await req.json();
    if (!name || !tag) return err("Nombre y tag requeridos");
    const cleanName = String(name).trim();
    const cleanTag = String(tag).trim().toUpperCase();
    if (cleanName.length < 3 || cleanName.length > 32) return err("Nombre 3-32 caracteres");
    if (!/^[A-Z0-9]{2,6}$/.test(cleanTag)) return err("Tag 2-6 caracteres alfanuméricos (A-Z, 0-9)");

    // Usuario ya está en otro clan?
    const { data: activeMember } = await supa.from("tournament_clan_members")
      .select("clan_id").eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (activeMember) return err("Ya perteneces a un clan. Sal primero.");

    if (user.clan_change_available_at && new Date(user.clan_change_available_at) > new Date()) {
      return err(`Debes esperar hasta ${new Date(user.clan_change_available_at).toLocaleDateString()} para crear/unirte a otro clan.`);
    }

    // Generar invite_code único (max 5 intentos)
    let invite_code = "";
    for (let i = 0; i < 5; i++) {
      const c = genInviteCode();
      const { data: ex } = await supa.from("tournament_clans").select("id").eq("invite_code", c).maybeSingle();
      if (!ex) { invite_code = c; break; }
    }
    if (!invite_code) return err("No se pudo generar código de invitación");

    // RPC atómica: clan + membership en una transacción.
    const { data: clanData, error: rpcErr } = await supa.rpc("tournament_clan_create_atomic", {
      p_owner_id: user.id,
      p_name: cleanName,
      p_tag: cleanTag,
      p_description: description || null,
      p_logo_url: logo_url || null,
      p_banner_url: banner_url || null,
      p_is_public: is_public !== false,
      p_invite_code: invite_code,
    });
    if (rpcErr) return err("Error creando clan: " + rpcErr.message);
    const clan = clanData as any;

    // BP por crear clan
    await supa.rpc("tournament_award_points", {
      _user_id: user.id, _amount: 25, _reason: "clan_created",
      _ref_type: "clan", _ref_id: clan.id,
    });

    return ok({ clan });
  } catch (e) { return err((e as Error).message); }
});
