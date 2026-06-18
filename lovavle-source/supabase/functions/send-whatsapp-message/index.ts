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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = ["global_admin", "admin", "admin_ventas", "ventas", "bd"];
    if (!roles?.some((r: any) => allowed.includes(r.role))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      lead_id,
      to_phone,
      body: messageBody,
      media_url,
      template_id,
      template_variables,
    } = body;

    if (!lead_id || !to_phone) {
      return new Response(JSON.stringify({ error: "Missing lead_id or to_phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!messageBody && !template_id && !media_url) {
      return new Response(JSON.stringify({ error: "Provide body, template_id or media_url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp config
    const { data: cfg } = await supabaseAdmin
      .from("integration_settings")
      .select("config, enabled")
      .eq("service_name", "whatsapp_business")
      .maybeSingle();

    if (!cfg?.enabled) {
      return new Response(
        JSON.stringify({ error: "WhatsApp service is disabled. Enable it in Settings → Integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderNumber = (cfg.config as any)?.sender_number;
    const sandboxMode = (cfg.config as any)?.sandbox_mode ?? true;
    if (!senderNumber) {
      return new Response(
        JSON.stringify({ error: "WhatsApp sender number not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve template if provided
    let finalBody = messageBody || "";
    let usedTemplateSid: string | null = null;

    if (template_id) {
      const { data: tpl } = await supabaseAdmin
        .from("whatsapp_templates")
        .select("body, twilio_content_sid, variables_count")
        .eq("id", template_id)
        .maybeSingle();
      if (!tpl) {
        return new Response(JSON.stringify({ error: "Template not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      usedTemplateSid = tpl.twilio_content_sid;
      // Substitute {{1}}, {{2}}... with provided variables
      let rendered = tpl.body;
      const vars = template_variables || {};
      Object.keys(vars).forEach((k) => {
        rendered = rendered.replaceAll(`{{${k}}}`, String(vars[k] ?? ""));
      });
      finalBody = rendered;
    }

    // Format phones with whatsapp: prefix
    const normalizePhone = (p: string) => {
      const trimmed = p.trim();
      if (trimmed.startsWith("whatsapp:")) return trimmed;
      return `whatsapp:${trimmed.startsWith("+") ? trimmed : "+" + trimmed}`;
    };
    const fromFormatted = normalizePhone(senderNumber);
    const toFormatted = normalizePhone(to_phone);

    // Insert pending record FIRST
    const { data: msgRecord, error: insertError } = await supabaseAdmin
      .from("lead_whatsapp_messages")
      .insert({
        lead_id,
        agent_id: user.id,
        direction: "outbound",
        to_phone: toFormatted,
        from_phone: fromFormatted,
        body: finalBody,
        media_url: media_url || null,
        template_id: template_id || null,
        template_variables: template_variables || null,
        status: "queued",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Twilio gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY")!;
    const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

    const params = new URLSearchParams({
      To: toFormatted,
      From: fromFormatted,
    });
    if (usedTemplateSid && !sandboxMode) {
      params.append("ContentSid", usedTemplateSid);
      if (template_variables) {
        params.append("ContentVariables", JSON.stringify(template_variables));
      }
    } else {
      params.append("Body", finalBody);
      if (media_url) params.append("MediaUrl", media_url);
    }

    const twilioRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio error:", twilioRes.status, twilioData);
      await supabaseAdmin
        .from("lead_whatsapp_messages")
        .update({
          status: "failed",
          error_code: String(twilioData.code || twilioRes.status),
          error_message: twilioData.message || "Twilio API error",
        })
        .eq("id", msgRecord.id);

      return new Response(
        JSON.stringify({ error: twilioData.message || "Twilio error", details: twilioData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update record with Twilio SID
    await supabaseAdmin
      .from("lead_whatsapp_messages")
      .update({
        twilio_message_sid: twilioData.sid,
        status: twilioData.status || "sent",
      })
      .eq("id", msgRecord.id);

    // Log activity
    await supabaseAdmin.from("lead_activities").insert({
      lead_id,
      performed_by: user.id,
      activity_type: "whatsapp_sent",
      details: finalBody.substring(0, 200),
    });

    return new Response(
      JSON.stringify({ success: true, sid: twilioData.sid, message_id: msgRecord.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-whatsapp-message error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
