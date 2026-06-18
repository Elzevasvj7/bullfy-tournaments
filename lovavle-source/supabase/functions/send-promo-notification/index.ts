import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Get all users with ib_externo role
    const { data: ibExternoUsers } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "ib_externo");

    if (!ibExternoUsers || ibExternoUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: "no ib_externo users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = "🎯 Nuevas Promociones Disponibles";
    const message =
      "Revisa las promociones que tenemos para ti en la sección de Novedades y Promociones";

    let notified = 0;
    for (const u of ibExternoUsers) {
      // Insert bell notification
      await admin.from("notifications").insert({
        user_id: u.user_id,
        type: "promo_broadcast",
        title,
        message,
        reference_type: "promotion",
      });
      notified++;
    }

    return new Response(
      JSON.stringify({ success: true, notified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
