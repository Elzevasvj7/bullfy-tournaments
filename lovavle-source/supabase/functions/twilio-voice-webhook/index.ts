import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadSystemConfig {
  welcome_message: string;
  welcome_voice: string;
  welcome_language: string;
  welcome_audio_url: string;
  welcome_mode: "tts" | "audio";
  hold_music_enabled: boolean;
  hold_music_url: string;
  end_call_message: string;
}

const DEFAULT_CONFIG: LeadSystemConfig = {
  welcome_message: "Gracias por atender, un asesor de Bullfy se comunicará con usted en breve. Por favor espere en la línea.",
  welcome_voice: "Polly.Mia",
  welcome_language: "es-MX",
  welcome_audio_url: "",
  welcome_mode: "tts",
  hold_music_enabled: true,
  hold_music_url: "https://api.twilio.com/cowbell.mp3",
  end_call_message: "La llamada ha terminado. Gracias por su tiempo.",
};

async function getCallConfig(supabaseAdmin: any): Promise<LeadSystemConfig> {
  const { data } = await supabaseAdmin
    .from("integration_settings")
    .select("config")
    .eq("service_name", "lead_system_config")
    .maybeSingle();
  if (data?.config) {
    return { ...DEFAULT_CONFIG, ...(data.config as LeadSystemConfig) };
  }
  return DEFAULT_CONFIG;
}

function buildWelcomeTwiml(callConfig: LeadSystemConfig): string {
  // If audio mode and URL exists, use <Play> for natural sound
  if (callConfig.welcome_mode === "audio" && callConfig.welcome_audio_url) {
    return `<Play>${callConfig.welcome_audio_url}</Play>`;
  }

  // Fallback to TTS
  const safeWelcome = callConfig.welcome_message.replace(/[<>&"']/g, "");
  const voiceAttr = `voice="${callConfig.welcome_voice}"`;
  return `<Say language="${callConfig.welcome_language}" ${voiceAttr}>${safeWelcome}</Say>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_PHONE_NUMBER) {
      return new Response("<Response><Say>Error de configuración</Say></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const callConfig = await getCallConfig(supabaseAdmin);

    const url = new URL(req.url);
    const requestType = url.searchParams.get("type");

    // === WHISPER MODE ===
    // Called via the `url` attribute on <Number> inside <Dial>.
    // This TwiML plays to the LEAD when they answer, before being connected to the agent.
    if (requestType === "whisper") {
      const welcomeTwiml = buildWelcomeTwiml(callConfig);

      const whisperTwiml = `<Response>${welcomeTwiml}</Response>`;

      console.log("Whisper TwiML for lead:", whisperTwiml);

      return new Response(whisperTwiml, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // === BROWSER MODE (TwiML App callback) ===
    // Twilio sends POST with form data when browser call connects via TwiML App
    const formData = await req.formData();
    const to = formData.get("To") as string;
    const callSid = formData.get("CallSid") as string;
    const callRecordId = formData.get("call_record_id") as string;

    if (!to) {
      return new Response(
        `<Response><Say language="${callConfig.welcome_language}">No se especificó un número de destino.</Say></Response>`,
        { status: 200, headers: { "Content-Type": "text/xml" } }
      );
    }

    const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;
    const whisperUrl = `${SUPABASE_URL}/functions/v1/twilio-voice-webhook?type=whisper`;

    // TwiML for browser mode: Dial the lead directly.
    // The lead hears the welcome message via the whisper URL on <Number>.
    const twimlParts = ['<Response>'];

    twimlParts.push(
      `<Dial record="record-from-answer-dual" timeout="30" ` +
      (callRecordId
        ? `action="${statusCallbackUrl}?call_record_id=${callRecordId}&amp;type=dial_complete" `
        : "") +
      `callerId="${TWILIO_PHONE_NUMBER}">` +
      `<Number url="${whisperUrl}">${to}</Number>` +
      `</Dial>`
    );

    twimlParts.push('</Response>');

    const twiml = twimlParts.join('');
    console.log("Browser mode TwiML:", twiml);

    // If we have a callRecordId, update it with the CallSid
    if (callRecordId && callSid) {
      await supabaseAdmin
        .from("lead_calls")
        .update({ twilio_call_sid: callSid, status: "ringing" })
        .eq("id", callRecordId);
    }

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Voice webhook error:", err);
    return new Response(
      '<Response><Say language="es-MX">Error interno del servidor.</Say></Response>',
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }
});
