import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function respond(ok: boolean, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok, ...payload }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { email, code, purpose } = await req.json();

    if (!email || !code) {
      return respond(false, { error: 'Email y código son requeridos' });
    }

    const effectivePurpose = purpose || 'registration';

    const { data: otps, error } = await supabase
      .from('partner_otp_codes')
      .select('*')
      .eq('email', email)
      .eq('purpose', effectivePurpose)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error || !otps || otps.length === 0) {
      return respond(false, { error: 'Código expirado o no encontrado. Solicita uno nuevo.' });
    }

    const matchedOtp = otps.find(otp => otp.code === code);

    if (!matchedOtp) {
      const latest = otps[0];
      if (latest.attempts >= 5) {
        return respond(false, { error: 'Demasiados intentos. Solicita un nuevo código.' });
      }

      await supabase
        .from('partner_otp_codes')
        .update({ attempts: latest.attempts + 1 })
        .eq('id', latest.id);

      const remaining = 4 - latest.attempts;
      return respond(false, {
        error: `Código incorrecto. ${remaining > 0 ? `Te quedan ${remaining} intentos.` : 'Solicita un nuevo código.'}`
      });
    }

    if (matchedOtp.attempts >= 5) {
      return respond(false, { error: 'Demasiados intentos. Solicita un nuevo código.' });
    }

    await supabase
      .from('partner_otp_codes')
      .update({ verified: true })
      .eq('id', matchedOtp.id);

    return respond(true, { verified: true });
  } catch (err) {
    console.error('Error:', err);
    return respond(false, { error: (err as Error).message });
  }
});
