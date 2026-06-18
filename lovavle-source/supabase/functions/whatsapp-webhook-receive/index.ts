import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

// Public webhook — no JWT verification (Twilio cannot send Supabase auth)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Twilio sends application/x-www-form-urlencoded
    const formData = await req.formData();
    const payload: Record<string, string> = {};
    formData.forEach((v, k) => { payload[k] = String(v); });

    console.log("WhatsApp webhook received:", JSON.stringify(payload).substring(0, 500));

    const messageSid = payload.MessageSid || payload.SmsSid;
    const messageStatus = payload.MessageStatus || payload.SmsStatus;
    const fromPhone = payload.From; // whatsapp:+...
    const toPhone = payload.To;
    const body = payload.Body || "";
    const numMedia = parseInt(payload.NumMedia || "0", 10);
    const mediaUrl = numMedia > 0 ? payload.MediaUrl0 : null;
    const mediaType = numMedia > 0 ? payload.MediaContentType0 : null;

    // Status callback (for outbound messages we sent)
    if (messageStatus && !body && !mediaUrl) {
      const errorCode = payload.ErrorCode || null;
      const errorMessage = payload.ErrorMessage || null;
      const updates: Record<string, unknown> = { status: messageStatus };
      if (errorCode) updates.error_code = errorCode;
      if (errorMessage) updates.error_message = errorMessage;

      await supabaseAdmin
        .from("lead_whatsapp_messages")
        .update(updates)
        .eq("twilio_message_sid", messageSid);

      return new Response("<Response/>", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Inbound message — find lead by phone
    const cleanPhone = fromPhone.replace("whatsapp:", "");
    const { data: lead } = await supabaseAdmin
      .from("stream_leads")
      .select("id")
      .or(`telefono.eq.${cleanPhone},telefono.eq.${cleanPhone.replace("+", "")}`)
      .maybeSingle();

    if (!lead) {
      console.warn("Inbound WhatsApp from unknown number:", fromPhone);
      // Still log it for visibility — could create a new lead but skip for now
      return new Response("<Response/>", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    await supabaseAdmin.from("lead_whatsapp_messages").insert({
      lead_id: lead.id,
      direction: "inbound",
      from_phone: fromPhone,
      to_phone: toPhone,
      body,
      media_url: mediaUrl,
      media_content_type: mediaType,
      twilio_message_sid: messageSid,
      status: "received",
    });

    // Notify assigned agent
    const { data: leadFull } = await supabaseAdmin
      .from("stream_leads")
      .select("assigned_to, nombre")
      .eq("id", lead.id)
      .maybeSingle();

    if (leadFull?.assigned_to) {
      await supabaseAdmin.from("notifications").insert({
        user_id: leadFull.assigned_to,
        type: "whatsapp_inbound",
        title: "💬 Nuevo mensaje WhatsApp",
        message: `${leadFull.nombre || "Lead"}: ${body.substring(0, 80)}`,
        reference_id: lead.id,
        reference_type: "lead",
      });
    }

    // Empty TwiML response
    return new Response("<Response/>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("<Response/>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
