// Endpoint usuario tournament: crear/listar disputas propias.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALID_CATEGORIES = new Set([
  "disqualification","prize_not_paid","wrong_rank","technical_issue","kyc_rejected","other",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(SUPABASE_URL, SVC);
    const { user: tu, error: ae } = await requireTournamentUser(req, supa);
    if (!tu) return err(ae || "Sesión inválida");

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    if (action === "list") {
      const { data } = await supa.from("tournament_disputes")
        .select("id, tournament_id, category, status, subject, description, admin_response, created_at, resolved_at")
        .eq("user_id", tu.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return ok({ disputes: data || [] });
    }

    if (action === "create") {
      const { tournament_id, category, subject, description, evidence_urls } = body;
      if (!category || !VALID_CATEGORIES.has(category)) return err("category inválida");
      if (!subject || !description) return err("subject y description requeridos");
      if (subject.length > 200) return err("subject demasiado largo");
      if (description.length > 2000) return err("description demasiado largo");

      // Rate limit: máximo 5 disputas pendientes
      const { count } = await supa.from("tournament_disputes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", tu.id).in("status", ["pending","in_review"]);
      if ((count || 0) >= 5) return err("Tienes demasiadas disputas abiertas. Espera a que se resuelvan.");

      const { data, error } = await supa.from("tournament_disputes").insert({
        user_id: tu.id,
        tournament_id: tournament_id || null,
        category, subject, description,
        evidence_urls: Array.isArray(evidence_urls) ? evidence_urls.slice(0, 5) : [],
      }).select("id").single();
      if (error) return err(error.message);
      return ok({ id: data.id });
    }

    return err("acción desconocida");
  } catch (e) {
    return err((e as Error).message);
  }
});
