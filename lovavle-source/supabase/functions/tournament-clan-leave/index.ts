// Salir de un clan. Si es owner, transfiere a officer más antiguo o disuelve si está solo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { data: m } = await supa.from("tournament_clan_members")
      .select("id, clan_id, role").eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (!m) return err("No perteneces a ningún clan");

    if (m.role === "owner") {
      // buscar sucesor: order role DESC para que 'officer' aparezca antes que
      // 'member' (orden alfabético: m < o; descending: o → m). Sin esto, un
      // member se promovía antes que un officer, contradiciendo el comentario
      // de cabecera "transfiere a officer más antiguo".
      const { data: heir } = await supa.from("tournament_clan_members")
        .select("id, user_id, role").eq("clan_id", m.clan_id).is("left_at", null)
        .neq("user_id", user.id).order("role", { ascending: false }).order("joined_at", { ascending: true })
        .limit(1).maybeSingle();
      if (heir) {
        await supa.from("tournament_clan_members").update({ role: "owner" }).eq("id", heir.id);
        await supa.from("tournament_clans").update({ owner_id: heir.user_id }).eq("id", m.clan_id);
      } else {
        // último miembro → disolver clan
        await supa.from("tournament_clans").delete().eq("id", m.clan_id);
        // member rows se borran por cascade; aún así marcamos para sincronizar trigger
      }
    }

    await supa.from("tournament_clan_members").update({ left_at: new Date().toISOString() }).eq("id", m.id);
    return ok({});
  } catch (e) { return err((e as Error).message); }
});
