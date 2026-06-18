import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, verifyPassword, randomToken } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email, password } = await req.json();
    if (!email || !password) return err("Email y contraseña requeridos");
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: user } = await supa.from("tournament_users")
      .select("id, email, full_name, password_hash, bullfy_points, is_elite, banned_at")
      .ilike("email", email).maybeSingle();
    if (!user || !user.password_hash) return err("Credenciales inválidas");
    if (user.banned_at) return err("Cuenta suspendida");

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return err("Credenciales inválidas");

    const token = randomToken(32);
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supa.from("tournament_user_sessions").insert({
      user_id: user.id, token, expires_at,
      ip_address: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    // Capturar última IP para anti-fraude
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    if (ip) {
      await supa.from("tournament_users").update({ last_login_ip: ip }).eq("id", user.id);
    }

    const { password_hash: _, ...safe } = user;
    return ok({ token, user: safe });
  } catch (e) {
    return err((e as Error).message);
  }
});
