import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, hashPassword, randomToken } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email, phone, full_name, password, country, referred_by_code } = await req.json();
    if (!email || !phone || !full_name || !password) return err("Datos incompletos");
    if (password.length < 8) return err("La contraseña debe tener al menos 8 caracteres");

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify both OTPs were validated
    const { data: emailOtp } = await supa.from("tournament_otp_codes")
      .select("id").eq("email", email).eq("purpose", "registration_email").eq("verified", true)
      .gte("expires_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!emailOtp) return err("Verifica primero tu email");

    const { data: smsOtp } = await supa.from("tournament_otp_codes")
      .select("id").eq("phone", phone).eq("purpose", "registration_sms").eq("verified", true)
      .gte("expires_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!smsOtp) return err("Verifica primero tu teléfono");

    // Check duplicate
    const { data: existing } = await supa.from("tournament_users")
      .select("id").or(`email.eq.${email},phone.eq.${phone}`).maybeSingle();
    if (existing) return err("Ya existe una cuenta con ese email o teléfono");

    const password_hash = await hashPassword(password);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const { data: user, error: insErr } = await supa.from("tournament_users").insert({
      email, phone, full_name, country: country || null, password_hash,
      email_verified_at: new Date().toISOString(),
      phone_verified_at: new Date().toISOString(),
      referred_by_code: referred_by_code ? String(referred_by_code).toUpperCase().trim() : null,
      signup_ip: ip, last_login_ip: ip,
    }).select("id, email, full_name, bullfy_points, is_elite, referral_code").single();
    if (insErr || !user) return err("Error creando cuenta: " + (insErr?.message || ""));

    // Create session
    const token = randomToken(32);
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supa.from("tournament_user_sessions").insert({
      user_id: user.id, token, expires_at,
      ip_address: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return ok({ token, user });
  } catch (e) {
    return err((e as Error).message);
  }
});
