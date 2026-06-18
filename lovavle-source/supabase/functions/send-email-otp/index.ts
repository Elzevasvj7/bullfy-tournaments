import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPortalEmailIdentity } from "../_shared/portalEmail.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_URL = 'https://api.resend.com';

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

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { email, purpose, portal_id } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email es requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: max 3 OTPs per email in last 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('partner_otp_codes')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('purpose', purpose || 'email_verification')
      .gte('created_at', tenMinAgo);

    if ((count ?? 0) >= 8) {
      return new Response(JSON.stringify({ error: 'Demasiados intentos. Espera unos minutos.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = generateOTP();

    // Remitente/marca según el portal (white-label si tiene dominio propio).
    const identity = await getPortalEmailIdentity(supabase, portal_id);

    // Store OTP in database
    const { error: dbError } = await supabase
      .from('partner_otp_codes')
      .insert({
        email,
        code,
        purpose: purpose || 'email_verification',
        portal_id: portal_id || null,
      });

    if (dbError) {
      console.error('DB error:', dbError);
      return new Response(JSON.stringify({ error: 'Error al guardar código' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send email via Resend API directly
    const emailResponse = await fetch(`${RESEND_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: identity.from,
        to: [email],
        subject: `Tu código de verificación ${identity.brandName}: ${code}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <div style="background:#062B63;padding:20px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="color:#83CBFF;margin:0;font-size:24px;">${identity.brandName}</h1>
            </div>
            <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
              <h2 style="color:#062B63;margin:0 0 8px;">Código de verificación</h2>
              <p style="color:#666;margin:0 0 24px;">Usa el siguiente código para verificar tu correo electrónico:</p>
              <div style="background:#f0f4ff;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px;">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#062B63;">${code}</span>
              </div>
              <p style="color:#999;font-size:12px;margin:0;">Este código expira en 5 minutos. Si no solicitaste este código, ignora este mensaje.</p>
            </div>
          </div>
        `,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Resend error:', JSON.stringify(emailData));
      return new Response(JSON.stringify({ error: 'Error al enviar email', details: emailData }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Código enviado por email' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
