import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing required secrets" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { call_id } = await req.json();

    if (!call_id) {
      return new Response(JSON.stringify({ error: "call_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get call record
    const { data: callRecord, error: callError } = await supabaseAdmin
      .from("lead_calls")
      .select("*")
      .eq("id", call_id)
      .single();

    if (callError || !callRecord) {
      return new Response(JSON.stringify({ error: "Call not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only the agent or a supervisor can hang up
    if (callRecord.agent_id !== user.id) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const userRoles = (roles || []).map((r: any) => r.role);
      if (!["admin_ventas", "admin", "global_admin"].some((r) => userRoles.includes(r))) {
        return new Response(JSON.stringify({ error: "Not authorized to hang up this call" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!callRecord.twilio_call_sid) {
      return new Response(JSON.stringify({ error: "No Twilio call SID found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // End the call via Twilio API
    const twilioResponse = await fetch(
      `${GATEWAY_URL}/Calls/${callRecord.twilio_call_sid}.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ Status: "completed" }),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio hangup error:", JSON.stringify(twilioData));
      // If call already ended, that's ok
      if (twilioResponse.status !== 404) {
        return new Response(JSON.stringify({ error: "Twilio API error", details: twilioData }), {
          status: twilioResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update call record
    await supabaseAdmin
      .from("lead_calls")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", call_id);

    // Update agent status to wrap_up
    await supabaseAdmin
      .from("sales_agent_status")
      .update({ status: "wrap_up", current_lead_id: null })
      .eq("user_id", callRecord.agent_id);

    // Log activity
    await supabaseAdmin.from("lead_activities").insert({
      lead_id: callRecord.lead_id,
      performed_by: user.id,
      activity_type: "call_hangup",
      details: "Llamada cortada manualmente",
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
