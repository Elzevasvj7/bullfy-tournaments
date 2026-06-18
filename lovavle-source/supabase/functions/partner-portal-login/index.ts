import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.24.2";
import { verifyPassword, hashPassword } from "../_shared/partner-password.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  portal_id: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(1),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = BodySchema.safeParse(await req.json());

    if (!body.success) {
      return new Response(JSON.stringify({ ok: false, error: "Datos de acceso inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const normalizedEmail = body.data.email.trim().toLowerCase();

    const { data: user, error } = await supabase
      .from("partner_users")
      .select("id, nombre, status, password_hash")
      .eq("portal_id", body.data.portal_id)
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (error || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Credenciales inválidas" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.status === "pending") {
      return new Response(JSON.stringify({ ok: false, error: "Tu cuenta está pendiente de aprobación" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.status === "rejected") {
      return new Response(JSON.stringify({ ok: false, error: "Tu cuenta fue rechazada. Contacta al administrador." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { valid, needsRehash } = await verifyPassword(body.data.password, user.password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ ok: false, error: "Credenciales inválidas" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Migración transparente: si la contraseña estaba en texto plano (legacy),
    // la re-hasheamos ahora que tenemos el valor en claro y el login es válido.
    if (needsRehash) {
      try {
        const newHash = await hashPassword(body.data.password);
        await supabase.from("partner_users").update({ password_hash: newHash }).eq("id", user.id);
      } catch (_e) {
        // No bloquear el login si la migración falla; se reintenta el próximo login.
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      user: {
        id: user.id,
        nombre: user.nombre,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});