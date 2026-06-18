import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { edition_id, user_email, user_name, selected_option } = await req.json();

    if (!edition_id || !user_email || !selected_option) {
      return new Response(JSON.stringify({ ok: false, error: "edition_id, user_email y selected_option son requeridos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check edition exists and is sent
    const { data: edition } = await sb.from("newsletter_editions").select("id, status").eq("id", edition_id).single();
    if (!edition || edition.status !== "sent") {
      return new Response(JSON.stringify({ ok: false, error: "Edición no disponible para predicciones" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check duplicate
    const { data: existing } = await sb.from("newsletter_predictions")
      .select("id").eq("edition_id", edition_id).eq("user_email", user_email.toLowerCase().trim()).maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: false, error: "Ya registraste tu predicción para esta edición" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await sb.from("newsletter_predictions").insert({
      edition_id,
      user_email: user_email.toLowerCase().trim(),
      user_name: user_name || null,
      selected_option,
    });

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
