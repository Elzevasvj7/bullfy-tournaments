import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ok = (b: Record<string, unknown>) =>
  new Response(JSON.stringify({ ok: true, ...b }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
const err = (m: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: false, error: m, ...extra }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

function gen6(): string {
  const a = new Uint8Array(6); crypto.getRandomValues(a);
  return Array.from(a).map((x) => (x % 10).toString()).join("");
}

async function sendEmailCode(toEmail: string, code: string, isSmsFallback: boolean) {
  const RESEND = Deno.env.get("RESEND_API_KEY");
  if (!RESEND) throw new Error("Email no configurado");
  const subject = isSmsFallback
    ? `Tu código SMS (enviado por email): ${code}`
    : `Tu código Bullfy Tournament: ${code}`;
  const note = isSmsFallback
    ? `<p style="color:#666;">No pudimos entregar el SMS a tu teléfono. Usa este código para verificar tu <b>teléfono</b> y continuar tu registro:</p>`
    : `<p style="color:#666;">Usa este código para continuar tu registro:</p>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND}` },
    body: JSON.stringify({
      from: "Bullfy Tournament <noreply@bullfytech.online>",
      to: [toEmail],
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <div style="background:#062B63;padding:20px;text-align:center;border-radius:12px 12px 0 0;"><h1 style="color:#83CBFF;margin:0;font-size:24px;">Bullfy Tournament</h1></div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
          <h2 style="color:#062B63;margin:0 0 8px;">Código de verificación</h2>
          ${note}
          <div style="background:#f0f4ff;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#062B63;">${code}</span>
          </div>
          <p style="color:#999;font-size:12px;">Expira en 10 minutos.</p>
        </div>
      </div>`,
    }),
  });
  if (!r.ok) {
    console.error("Resend", await r.text());
    throw new Error("Error enviando email");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email, phone, channel, purpose, fallback_to_email } = await req.json();
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ch = (channel === "sms" ? "sms" : "email") as "sms" | "email";
    const purp = purpose || (ch === "email" ? "registration_email" : "registration_sms");
    const useEmailFallback = ch === "sms" && fallback_to_email === true;

    if (ch === "email" && !email) return err("Email requerido");
    if (ch === "sms" && !phone) return err("Teléfono requerido");
    if (useEmailFallback && !email) return err("Email requerido para fallback");

    // Rate limit: max 5 in 10min per dest+purpose
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supa
      .from("tournament_otp_codes")
      .select("id", { count: "exact", head: true })
      .eq(ch === "email" ? "email" : "phone", ch === "email" ? email : phone)
      .eq("purpose", purp)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) return err("Demasiados intentos. Espera unos minutos.");

    const code = gen6();
    // For SMS fallback we still store phone + registration_sms so verify flow is unchanged
    const { error: dbErr } = await supa.from("tournament_otp_codes").insert({
      email: ch === "email" ? email : null,
      phone: ch === "sms" ? phone : null,
      code,
      purpose: purp,
    });
    if (dbErr) return err("Error guardando código");

    if (ch === "email") {
      try { await sendEmailCode(email, code, false); }
      catch (e) { return err((e as Error).message); }
    } else if (useEmailFallback) {
      try { await sendEmailCode(email, code, true); }
      catch (e) { return err((e as Error).message); }
      return ok({ sent: true, via: "email_fallback" });
    } else {
      const LOV = Deno.env.get("LOVABLE_API_KEY");
      const TW = Deno.env.get("TWILIO_API_KEY");
      const FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
      if (!LOV || !TW || !FROM) return err("SMS no configurado");
      const r = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOV}`,
          "X-Connection-Api-Key": TW,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, From: FROM, Body: `Bullfy Tournament: tu código es ${code}. Expira en 10 min.` }),
      });
      if (!r.ok) {
        console.error("Twilio", await r.text());
        return err("Error enviando SMS");
      }
    }
    return ok({ sent: true });
  } catch (e) {
    return err((e as Error).message);
  }
});
