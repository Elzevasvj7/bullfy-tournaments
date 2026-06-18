import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

const RATE_LIMIT_PER_MIN = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    // ----- LIST: público (cualquiera con tournament_id) -----
    if (action === "list" && req.method === "GET") {
      const tid = url.searchParams.get("tournament_id");
      if (!tid) return err("tournament_id requerido");
      const { data } = await supa
        .from("tournament_chat_messages")
        .select("id, message, created_at, reply_to_id, user_id, tournament_users(username, full_name, avatar_url, is_elite, is_verified_user, clan_id, tournament_clans(tag, is_verified))")
        .eq("tournament_id", tid)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(100);
      const msgs = (data || []).reverse().map((m: any) => ({
        id: m.id,
        message: m.message,
        created_at: m.created_at,
        reply_to_id: m.reply_to_id,
        user: {
          id: m.user_id,
          username: m.tournament_users?.username,
          full_name: m.tournament_users?.full_name,
          avatar_url: m.tournament_users?.avatar_url,
          is_elite: m.tournament_users?.is_elite,
          is_verified_user: m.tournament_users?.is_verified_user,
          clan_tag: m.tournament_users?.tournament_clans?.tag || null,
          clan_verified: m.tournament_users?.tournament_clans?.is_verified || false,
        },
      }));
      return ok({ messages: msgs });

    }

    // Acciones autenticadas
    const { user, error } = await requireTournamentUser(req, supa);
    if (!user) return err(error || "Sin autenticación");

    if (action === "send" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const tid = body.tournament_id as string;
      const message = (body.message || "").toString().trim();
      const replyTo = body.reply_to_id as string | null;
      if (!tid) return err("tournament_id requerido");
      if (!message || message.length > 280) return err("Mensaje inválido (1-280 chars)");

      // Mute check
      const { data: mute } = await supa.from("tournament_chat_mutes")
        .select("id, muted_until, reason")
        .eq("user_id", user.id)
        .or(`tournament_id.eq.${tid},tournament_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mute && (!mute.muted_until || new Date(mute.muted_until) > new Date())) {
        return err(`Estás silenciado: ${mute.reason || "violación de reglas"}`);
      }

      // Rate limit
      const sinceIso = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supa.from("tournament_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", sinceIso);
      if ((count || 0) >= RATE_LIMIT_PER_MIN) {
        return err("Vas demasiado rápido, espera unos segundos");
      }

      const { data: inserted, error: insErr } = await supa.from("tournament_chat_messages")
        .insert({
          tournament_id: tid,
          user_id: user.id,
          message,
          reply_to_id: replyTo || null,
        })
        .select("id, created_at")
        .single();
      if (insErr) return err(insErr.message);
      return ok({ message: inserted });
    }

    if (action === "delete" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const id = body.id as string;
      if (!id) return err("id requerido");
      // Solo autor puede borrar (admin se hace desde otra ruta)
      const { data: msg } = await supa.from("tournament_chat_messages")
        .select("user_id").eq("id", id).maybeSingle();
      if (!msg || msg.user_id !== user.id) return err("No autorizado");
      await supa.from("tournament_chat_messages")
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user.id })
        .eq("id", id);
      return ok({});
    }

    return err("Acción inválida");
  } catch (e) {
    return err((e as Error).message || "Error");
  }
});
