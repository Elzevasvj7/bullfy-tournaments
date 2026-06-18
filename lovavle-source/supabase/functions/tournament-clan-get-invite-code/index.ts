// Devuelve el invite_code de un clan solo a sus miembros activos.
// PR #7 — A5: la migración revoca SELECT(invite_code) ON tournament_clans
//             para anon/authenticated, así que el frontend no puede leer el
//             código directamente. Esta función con service_role valida
//             membresía y devuelve el código al miembro autorizado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    // clan_id viene por body (POST) o query string (GET). Soportamos ambos
    // para permitir uso flexible desde frontend (el patrón habitual del
    // módulo es POST con JSON body).
    let clan_id: string | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        clan_id = body?.clan_id;
      } catch { /* permitir fallback a query */ }
    }
    if (!clan_id) {
      const url = new URL(req.url);
      clan_id = url.searchParams.get("clan_id") || undefined;
    }
    if (!clan_id) return err("clan_id requerido");

    // Validar membresía activa del usuario en el clan solicitado.
    const { data: membership } = await supa.from("tournament_clan_members")
      .select("role")
      .eq("clan_id", clan_id)
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle();
    if (!membership) {
      // Mensaje genérico para no permitir enumeration de "el clan existe
      // pero no soy miembro" vs "el clan no existe".
      return err("Acceso no disponible");
    }

    // service_role bypassa la restricción de columna del REVOKE.
    const { data: clan } = await supa.from("tournament_clans")
      .select("invite_code")
      .eq("id", clan_id)
      .maybeSingle();
    if (!clan) return err("Acceso no disponible");

    return ok({ invite_code: clan.invite_code });
  } catch (e) { return err((e as Error).message); }
});
