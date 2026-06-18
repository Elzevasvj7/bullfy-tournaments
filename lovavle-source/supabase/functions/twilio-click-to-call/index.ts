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
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_PHONE_NUMBER) {
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

    const { lead_id } = await req.json();

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get lead info
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("stream_leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lead.telefono) {
      return new Response(JSON.stringify({ error: "El lead no tiene número de teléfono" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get agent info
    const { data: agentStatus } = await supabaseAdmin
      .from("sales_agent_status")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const agentPhone = agentStatus?.telefono_trabajo;
    if (!agentPhone) {
      return new Response(
        JSON.stringify({ error: "No tienes teléfono de trabajo configurado. Configúralo en el Panel de Agente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create call record
    const { data: callRecord, error: callError } = await supabaseAdmin
      .from("lead_calls")
      .insert({
        lead_id,
        agent_id: user.id,
        call_mode: "bridge",
        status: "initiating",
      })
      .select()
      .single();

    if (callError) {
      console.error("Error creating call record:", callError);
      return new Response(JSON.stringify({ error: "Failed to create call record" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;

    // Whisper URL: when the lead answers, they hear the welcome message
    const whisperUrl = `${SUPABASE_URL}/functions/v1/twilio-voice-webhook?type=whisper`;

    // TwiML: Call the agent, then Dial the lead.
    // The agent hears nothing extra — the lead hears the welcome via whisper URL.
    const twiml = [
      '<Response>',
      `<Dial record="record-from-answer-dual" timeout="30" `,
      `action="${statusCallbackUrl}?call_record_id=${callRecord.id}&amp;type=dial_complete" `,
      `callerId="${TWILIO_PHONE_NUMBER}">`,
      `<Number url="${whisperUrl}">${lead.telefono}</Number>`,
      `</Dial>`,
      '</Response>',
    ].join('');

    console.log("Bridge TwiML:", twiml);

    // Call the agent's phone — when agent answers, Twilio executes TwiML to dial lead
    const twilioResponse = await fetch(`${GATEWAY_URL}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: agentPhone,
        From: TWILIO_PHONE_NUMBER,
        Twiml: twiml,
        StatusCallback: statusCallbackUrl + `?call_record_id=${callRecord.id}&type=status`,
        StatusCallbackEvent: "initiated ringing answered completed",
        StatusCallbackMethod: "POST",
      }),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));
      await supabaseAdmin.from("lead_calls").update({ status: "failed" }).eq("id", callRecord.id);
      return new Response(JSON.stringify({ error: "Error de Twilio", details: twilioData }), {
        status: twilioResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update call record with Twilio SID
    await supabaseAdmin
      .from("lead_calls")
      .update({ twilio_call_sid: twilioData.sid, status: "ringing" })
      .eq("id", callRecord.id);

    // Update agent status to on_call
    await supabaseAdmin
      .from("sales_agent_status")
      .update({ status: "on_call", current_lead_id: lead_id })
      .eq("user_id", user.id);

    // Log activity
    const { data: agentProfile } = await supabaseAdmin
      .from("profiles")
      .select("nombre")
      .eq("id", user.id)
      .single();

    await supabaseAdmin.from("lead_activities").insert({
      lead_id,
      performed_by: user.id,
      activity_type: "call_initiated",
      details: `Llamada iniciada por ${agentProfile?.nombre || "agente"}`,
    });

    return new Response(
      JSON.stringify({ success: true, call_id: callRecord.id, twilio_sid: twilioData.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
