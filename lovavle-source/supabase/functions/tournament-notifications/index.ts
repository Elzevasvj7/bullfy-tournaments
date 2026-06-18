// List + mark-as-read endpoints for tournament_notifications.
// Auth: tournament session token (tournament_user_sessions). RLS de la tabla está cerrada,
// se accede vía service role aquí (filtrando por user_id de la sesión).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    if (action === "list") {
      const { data } = await supa.from("tournament_notifications")
        .select("id, type, title, message, link, reference_id, reference_type, read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      const unread = (data || []).filter((n: any) => !n.read).length;
      return ok({ notifications: data || [], unread });
    }

    if (action === "mark_read") {
      const body = await req.json().catch(() => ({}));
      const id = body.id as string;
      if (!id) return err("id requerido");
      await supa.from("tournament_notifications").update({ read: true })
        .eq("id", id).eq("user_id", user.id);
      return ok({});
    }

    if (action === "mark_all_read") {
      await supa.from("tournament_notifications").update({ read: true })
        .eq("user_id", user.id).eq("read", false);
      return ok({});
    }

    return err("Acción inválida");
  } catch (e) { return err((e as Error).message); }
});
