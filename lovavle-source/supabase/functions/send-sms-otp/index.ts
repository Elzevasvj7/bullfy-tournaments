import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

function generateOTP(): string {
  const digits = '0123456789';
  let code = '';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) {
    code += digits[arr[i] % 10];
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
  if (!TWILIO_API_KEY) {
    return new Response(JSON.stringify({ error: 'TWILIO_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Long-code (resto del mundo) y Toll-Free (USA/Canadá +1, soporta A2P)
  const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') || '+17126000923';
  const TWILIO_TOLLFREE_NUMBER = Deno.env.get('TWILIO_TOLLFREE_NUMBER') || '+18663502219';

  // Whitelist: números de prueba sin rate limit
  const RATE_LIMIT_WHITELIST = ['+573103665472', '+34615610163', '+573008650858', '+573114531146'];

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Helper: dispara el envío por email reutilizando send-email-otp (mismo registro en partner_otp_codes
  // bajo el mismo purpose, así verify-otp lo encuentra sin cambios).
  async function sendEmailFallback(email: string, purpose: string, portal_id: string | null, reason: string): Promise<Response> {
    console.log(`SMS failed (${reason}), triggering email fallback for ${email}`);
    try {
      const fallbackResp = await fetch(`${supabaseUrl}/functions/v1/send-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') ?? ''}`,
        },
        body: JSON.stringify({ email, purpose, portal_id }),
      });
      const fallbackData = await fallbackResp.json().catch(() => ({}));
      if (fallbackResp.ok && fallbackData?.success) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Código enviado por email (SMS no disponible)',
            fallback: 'email',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      console.error('Email fallback failed:', JSON.stringify(fallbackData));
      return new Response(
        JSON.stringify({ error: 'No fue posible enviar el código por SMS ni por email. Intenta de nuevo en unos minutos.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch (fallbackErr) {
      console.error('Email fallback exception:', fallbackErr);
      return new Response(
        JSON.stringify({ error: 'No fue posible enviar el código. Intenta de nuevo en unos minutos.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  try {
    const { email, phone, purpose, portal_id, force_email_fallback } = await req.json();

    if (!email || !phone) {
      return new Response(JSON.stringify({ error: 'Email y teléfono son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const effectivePurpose = purpose || 'registration';

    // Si el usuario fuerza el fallback a email (botón "Enviar por email"), saltar SMS
    if (force_email_fallback) {
      console.log(`User-forced email fallback for ${email} purpose=${effectivePurpose}`);
      return await sendEmailFallback(email, effectivePurpose, portal_id || null, 'user_forced');
    }
    const isWhitelisted = RATE_LIMIT_WHITELIST.includes(phone);
    const isUSDestination = phone.startsWith('+1');

    // Blocklist check (always, even for whitelisted purposes — abusive numbers stay blocked)
    const { data: blocked } = await supabase
      .from('sms_phone_blocklist')
      .select('phone, reason')
      .eq('phone', phone)
      .maybeSingle();
    if (blocked) {
      console.warn(`Blocked phone attempted SMS: ${phone} reason=${blocked.reason}`);
      return new Response(JSON.stringify({ error: 'Este número no puede recibir SMS. Usa el envío por email.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isWhitelisted) {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      // Load rate limit config (with defaults fallback)
      const { data: cfg } = await supabase
        .from('sms_rate_limit_config').select('*').eq('id', 1).maybeSingle();
      const LIMIT_EMAIL_PURPOSE = cfg?.email_purpose_per_10min ?? 3;
      const LIMIT_PHONE_10MIN = cfg?.phone_per_10min ?? 2;
      const LIMIT_PHONE_24H = cfg?.phone_per_24h ?? 5;

      // Rate limit: per email+purpose in last 10 minutes
      const { count } = await supabase
        .from('partner_otp_codes')
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .eq('purpose', effectivePurpose)
        .gte('created_at', tenMinAgo);

      if ((count ?? 0) >= LIMIT_EMAIL_PURPOSE) {
        console.error(`Rate limit hit for ${email} purpose=${effectivePurpose}, count=${count}`);
        return new Response(JSON.stringify({ error: 'Demasiados intentos. Espera unos minutos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Rate limit by phone: max 2 SMS to same phone in 10 minutes
      const { count: phoneCount } = await supabase
        .from('partner_otp_codes')
        .select('id', { count: 'exact', head: true })
        .eq('phone', phone)
        .gte('created_at', tenMinAgo);

      if ((phoneCount ?? 0) >= LIMIT_PHONE_10MIN) {
        console.error(`Phone rate limit hit for ${phone}, count=${phoneCount}`);
        return new Response(JSON.stringify({ error: 'Demasiados SMS enviados a este número. Espera unos minutos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Daily limit per phone
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: dayCount } = await supabase
        .from('partner_otp_codes')
        .select('id', { count: 'exact', head: true })
        .eq('phone', phone)
        .gte('created_at', dayAgo);

      if ((dayCount ?? 0) >= LIMIT_PHONE_24H) {
        console.error(`Daily phone limit hit for ${phone}, count=${dayCount}`);
        return new Response(JSON.stringify({ error: 'Has alcanzado el límite diario de SMS. Intenta mañana o usa email.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log(`Phone ${phone} is whitelisted, skipping rate limits`);
    }

    const code = generateOTP();

    // Store OTP in database (mismo flujo que antes — verify-otp sigue funcionando igual)
    const { error: dbError } = await supabase
      .from('partner_otp_codes')
      .insert({
        email,
        phone,
        code,
        purpose: effectivePurpose,
        portal_id: portal_id || null,
      });

    if (dbError) {
      console.error('DB error storing OTP:', JSON.stringify(dbError));
      return new Response(JSON.stringify({ error: 'Error al guardar código' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Selección de remitente: Toll-Free para +1 (USA/Canadá), long-code para el resto
    const fromNumber = isUSDestination ? TWILIO_TOLLFREE_NUMBER : TWILIO_PHONE_NUMBER;
    console.log(`Sending SMS to ${phone} from ${fromNumber} for ${email} purpose=${effectivePurpose} code=${code}`);

    // Send SMS via Twilio gateway
    const smsResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        From: fromNumber,
        Body: `Tu código de verificación Bullfy es: ${code}. Expira en 5 minutos.`,
      }),
    });

    const smsData = await smsResponse.json();

    if (!smsResponse.ok) {
      console.error(`Twilio error from=${fromNumber} to=${phone}:`, JSON.stringify(smsData));

      // Fallback automático a email — el OTP ya está guardado en DB con el mismo purpose,
      // pero send-email-otp generará uno nuevo válido. Como verify-otp acepta cualquier
      // OTP vigente del mismo email+purpose, ambos códigos funcionan (el del email es el válido).
      return await sendEmailFallback(email, effectivePurpose, portal_id || null, `twilio_${smsData?.code ?? smsResponse.status}`);
    }

    console.log(`SMS sent successfully to ${phone}, SID: ${smsData.sid}`);

    return new Response(JSON.stringify({ success: true, message: 'Código enviado por SMS' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
