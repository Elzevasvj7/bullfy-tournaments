import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recording_sid from query params
    const url = new URL(req.url);
    const recordingSid = url.searchParams.get("recording_sid");

    if (!recordingSid || !/^RE[a-f0-9]{32}$/i.test(recordingSid)) {
      return new Response(JSON.stringify({ error: "Invalid recording_sid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access (is an agent, supervisor, or admin)
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const allowedRoles = [
      "global_admin",
      "admin",
      "admin_ventas",
      "ventas",
      "bd",
    ];
    const hasAccess = roles?.some((r: any) => allowedRoles.includes(r.role));
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recording from Twilio via connector gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY")!;
    const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

    const twilioResponse = await fetch(
      `${GATEWAY_URL}/Recordings/${recordingSid}.mp3`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
        },
      }
    );

    if (!twilioResponse.ok) {
      console.error(
        "Twilio recording fetch failed:",
        twilioResponse.status,
        await twilioResponse.text()
      );
      return new Response(
        JSON.stringify({ error: "Recording not found" }),
        {
          status: twilioResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Stream the audio back
    const audioBody = twilioResponse.body;
    return new Response(audioBody, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="${recordingSid}.mp3"`,
      },
    });
  } catch (err) {
    console.error("Recording proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
