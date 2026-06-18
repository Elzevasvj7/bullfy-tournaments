// Gestión interna del clan (solo owner/officer): kick, promote, demote, update_info, regenerate_code.
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

    const { action, clan_id, target_user_id, payload } = await req.json();
    if (!action || !clan_id) return err("action y clan_id requeridos");

    const { data: actor } = await supa.from("tournament_clan_members")
      .select("role").eq("clan_id", clan_id).eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (!actor) return err("No perteneces a este clan");
    const isOwner = actor.role === "owner";
    const canManage = isOwner || actor.role === "officer";

    if (action === "update_info") {
      if (!canManage) return err("Sin permisos");
      const upd: any = {};
      if (payload?.description !== undefined) upd.description = payload.description;
      if (payload?.logo_url !== undefined) upd.logo_url = payload.logo_url;
      if (payload?.banner_url !== undefined) upd.banner_url = payload.banner_url;
      if (payload?.is_public !== undefined) upd.is_public = !!payload.is_public;
      if (isOwner && payload?.name) upd.name = String(payload.name).trim();
      if (Object.keys(upd).length === 0) return err("Nada que actualizar");
      const { error } = await supa.from("tournament_clans").update(upd).eq("id", clan_id);
      if (error) return err(error.message);
      return ok({});
    }

    if (action === "regenerate_code") {
      if (!canManage) return err("Sin permisos");
      let code = "";
      for (let i = 0; i < 5; i++) {
        const c = genInviteCode();
        const { data: ex } = await supa.from("tournament_clans").select("id").eq("invite_code", c).maybeSingle();
        if (!ex) { code = c; break; }
      }
      if (!code) return err("No se pudo regenerar código");
      await supa.from("tournament_clans").update({ invite_code: code }).eq("id", clan_id);
      return ok({ invite_code: code });
    }

    if (!target_user_id) return err("target_user_id requerido");
    if (target_user_id === user.id) return err("Acción sobre ti mismo no permitida");

    const { data: target } = await supa.from("tournament_clan_members")
      .select("id, role").eq("clan_id", clan_id).eq("user_id", target_user_id).is("left_at", null).maybeSingle();
    if (!target) return err("Miembro no encontrado");

    if (action === "kick") {
      if (!canManage) return err("Sin permisos");
      if (target.role === "owner") return err("No puedes expulsar al owner");
      if (target.role === "officer" && !isOwner) return err("Solo owner puede expulsar officers");
      await supa.from("tournament_clan_members").update({ left_at: new Date().toISOString() }).eq("id", target.id);
      return ok({});
    }

    if (action === "promote") {
      if (!isOwner) return err("Solo owner puede promover");
      if (target.role !== "member") return err("Solo se promueven members → officer");
      await supa.from("tournament_clan_members").update({ role: "officer" }).eq("id", target.id);
      return ok({});
    }

    if (action === "demote") {
      if (!isOwner) return err("Solo owner puede degradar");
      if (target.role !== "officer") return err("Solo se degradan officers");
      await supa.from("tournament_clan_members").update({ role: "member" }).eq("id", target.id);
      return ok({});
    }

    if (action === "transfer_owner") {
      if (!isOwner) return err("Solo owner puede transferir");
      // PR #7 C10: RPC atómica — demote viejo + promote nuevo + sync
      // owner_id en una sola transacción. Antes eran 3 UPDATEs separados;
      // un fallo a mitad dejaba el clan sin owner o con dos owners +
      // owner_id desincronizado.
      const { error: rpcErr } = await supa.rpc("tournament_clan_transfer_owner", {
        p_clan_id: clan_id,
        p_old_owner_id: user.id,
        p_new_owner_id: target_user_id,
      });
      if (rpcErr) return err("Error transfiriendo ownership: " + rpcErr.message);
      return ok({});
    }

    return err("Acción desconocida");
  } catch (e) { return err((e as Error).message); }
});
