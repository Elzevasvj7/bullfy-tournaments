import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ok = (b: Record<string, unknown>) =>
  new Response(JSON.stringify({ ok: true, ...b }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
const err = (m: string) => new Response(JSON.stringify({ ok: false, error: m }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email, phone, code, purpose } = await req.json();
    if (!code || (!email && !phone)) return err("Datos incompletos");
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const purp = purpose || (email ? "registration_email" : "registration_sms");

    let q = supa.from("tournament_otp_codes").select("*").eq("purpose", purp).eq("verified", false).gte("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
    q = email ? q.eq("email", email) : q.eq("phone", phone);
    const { data: rows, error } = await q;
    if (error || !rows || rows.length === 0) return err("Código expirado o no encontrado");

    const matched = rows.find((r) => r.code === code);
    if (!matched) {
      const latest = rows[0];
      if (latest.attempts >= 5) return err("Demasiados intentos. Solicita un nuevo código.");
      await supa.from("tournament_otp_codes").update({ attempts: latest.attempts + 1 }).eq("id", latest.id);
      return err(`Código incorrecto. Te quedan ${4 - latest.attempts} intentos.`);
    }
    if (matched.attempts >= 5) return err("Demasiados intentos");
    await supa.from("tournament_otp_codes").update({ verified: true }).eq("id", matched.id);
    return ok({ verified: true });
  } catch (e) {
    return err((e as Error).message);
  }
});
