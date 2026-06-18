// Un miembro activo de un clan participante se inscribe a un torneo clan_war.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { war_id } = await req.json();
    if (!war_id) return err("war_id requerido");

    const { data: war } = await supa.from("tournament_clan_wars").select("*").eq("id", war_id).maybeSingle();
    if (!war || war.status !== "accepted") return err("Reto no activo");
    if (!war.tournament_id) return err("Torneo no creado aún");

    const { data: m } = await supa.from("tournament_clan_members")
      .select("clan_id").eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (!m) return err("No perteneces a ningún clan");
    if (m.clan_id !== war.challenger_clan_id && m.clan_id !== war.defender_clan_id) {
      return err("Tu clan no participa en este reto");
    }

    const { error: insErr } = await supa.from("tournament_participants").insert({
      tournament_id: war.tournament_id, user_id: user.id, mt5_kind: "demo",
    });
    if (insErr) return err(insErr.message);

    // contadores
    const field = m.clan_id === war.challenger_clan_id ? "challenger_participants" : "defender_participants";
    await supa.from("tournament_clan_wars").update({ [field]: (war as any)[field] + 1 }).eq("id", war_id);

    return ok({});
  } catch (e) { return err((e as Error).message); }
});
