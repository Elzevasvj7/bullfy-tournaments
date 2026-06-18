// Tras registrarse con un invite_token, vincula al usuario al versus como opponent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { invite_token } = await req.json();
    if (!invite_token) return err("Token requerido");

    const { data: v } = await supa.from("tournament_versus").select("*").eq("invite_token", invite_token).maybeSingle();
    if (!v) return err("Invitación inválida");
    if (v.status !== "pending") return err("Invitación ya usada o expirada");
    if (new Date(v.expires_at) < new Date()) return err("Invitación expirada");
    if (v.challenger_id === user.id) return err("No puedes aceptar tu propio reto");

    await supa.from("tournament_versus").update({
      opponent_id: user.id, opponent_email: null, invite_token: null,
    }).eq("id", v.id);

    return ok({ versus_id: v.id });
  } catch (e) { return err((e as Error).message); }
});
