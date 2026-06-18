import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { hashPassword, verifyPassword } from "../_shared/partner-password.js";
import { getPortalEmailIdentity } from "../_shared/portalEmail.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, email, portal_id, token, new_password, portal_slug, current_password } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;

    if (action === "request") {
      // Find partner user by email + portal
      const { data: user } = await supabase
        .from("partner_users")
        .select("id, nombre, email")
        .eq("portal_id", portal_id)
        .ilike("email", normalizedEmail || "")
        .maybeSingle();

      if (!user) {
        // Don't reveal if email exists
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create token
      const { data: tokenRow, error: tokenErr } = await supabase
        .from("partner_password_reset_tokens")
        .insert({ portal_id, email: normalizedEmail })
        .select("token")
        .single();

      if (tokenErr) throw tokenErr;

      // Get portal info for the URL
      const { data: portal } = await supabase
        .from("partner_portals")
        .select("nombre_portal, display_name")
        .eq("id", portal_id)
        .single();

      const slug = portal?.nombre_portal || portal_slug;
      const displayName = portal?.display_name || "Partner Portal";
      const identity = await getPortalEmailIdentity(supabase, portal_id);
      const footer = identity.isWhiteLabel ? displayName : "Powered by Bullfy Partner";
      const resetUrl = `https://bullfyibsystem.lovable.app/partner/${slug}/reset?token=${tokenRow.token}`;

      // Send email
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#062B63;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
            <h1 style="color:#83CBFF;margin:0;font-size:28px;letter-spacing:2px;">${displayName}</h1>
            <p style="color:#A0B1BD;margin:4px 0 0;font-size:12px;letter-spacing:4px;text-transform:uppercase;">PARTNER PORTAL</p>
          </div>
          <div style="padding:30px 25px;border:1px solid #e0e0e0;border-top:none;">
            <h2 style="color:#062B63;font-size:22px;margin:0 0 20px;">Restablecer contraseña</h2>
            <p style="color:#55575d;font-size:14px;line-height:1.5;">Hola <strong>${user.nombre}</strong>,</p>
            <p style="color:#55575d;font-size:14px;line-height:1.5;">Recibimos una solicitud para restablecer tu contraseña. Haz click en el botón para elegir una nueva.</p>
            <div style="text-align:center;margin:25px 0;">
              <a href="${resetUrl}" style="background:#146EF5;color:#ffffff;font-size:14px;border-radius:8px;padding:12px 24px;text-decoration:none;font-weight:bold;display:inline-block;">Restablecer Contraseña</a>
            </div>
            <p style="color:#999;font-size:12px;margin:30px 0 0;">Si no solicitaste esto, puedes ignorar este email. El enlace expira en 1 hora.</p>
          </div>
          <div style="text-align:center;padding:16px 25px;border-top:1px solid #e0e0e0;">
            <p style="color:#A0B1BD;font-size:11px;margin:0;">${footer}</p>
          </div>
        </div>`;

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: identity.from,
            to: [user.email],
            subject: "Restablecer contraseña - " + displayName,
            html: emailHtml,
          }),
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_credentials") {
      // Generate a random 10-char password
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let newPass = "";
      for (let i = 0; i < 10; i++) {
        newPass += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Find user
      const { data: user } = await supabase
        .from("partner_users")
        .select("id, nombre, email")
        .eq("id", email) // reuse 'email' field to pass user_id
        .eq("portal_id", portal_id)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({ ok: false, error: "Usuario no encontrado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update password (hasheada antes de guardar)
      const { error: updateErr } = await supabase
        .from("partner_users")
        .update({ password_hash: await hashPassword(newPass), status: "approved" })
        .eq("id", user.id);

      if (updateErr) throw updateErr;

      // Get portal info
      const { data: portalInfo } = await supabase
        .from("partner_portals")
        .select("nombre_portal, display_name")
        .eq("id", portal_id)
        .single();

      const displayName = portalInfo?.display_name || "Partner Portal";
      const identity = await getPortalEmailIdentity(supabase, portal_id);
      const footer = identity.isWhiteLabel ? displayName : "Powered by Bullfy Partner";
      const portalUrl = `https://bullfyibsystem.lovable.app/partner/${portalInfo?.nombre_portal || portal_slug}`;

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#062B63;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
            <h1 style="color:#83CBFF;margin:0;font-size:28px;letter-spacing:2px;">${displayName}</h1>
            <p style="color:#A0B1BD;margin:4px 0 0;font-size:12px;letter-spacing:4px;text-transform:uppercase;">PARTNER PORTAL</p>
          </div>
          <div style="padding:30px 25px;border:1px solid #e0e0e0;border-top:none;">
            <h2 style="color:#062B63;font-size:22px;margin:0 0 20px;">Tus credenciales de acceso</h2>
            <p style="color:#55575d;font-size:14px;line-height:1.5;">Hola <strong>${user.nombre}</strong>,</p>
            <p style="color:#55575d;font-size:14px;line-height:1.5;">Se te ha otorgado acceso al portal. Aquí están tus credenciales:</p>
            <div style="background:#f4f6f9;border-radius:8px;padding:20px;margin:20px 0;">
              <p style="color:#333;font-size:14px;margin:0 0 8px;"><strong>Email:</strong> ${user.email}</p>
              <p style="color:#333;font-size:14px;margin:0;"><strong>Contraseña:</strong> <code style="background:#e0e7ef;padding:2px 8px;border-radius:4px;font-size:16px;letter-spacing:1px;">${newPass}</code></p>
            </div>
            <div style="text-align:center;margin:25px 0;">
              <a href="${portalUrl}" style="background:#146EF5;color:#ffffff;font-size:14px;border-radius:8px;padding:12px 24px;text-decoration:none;font-weight:bold;display:inline-block;">Ingresar al Portal</a>
            </div>
            <p style="color:#999;font-size:12px;margin:30px 0 0;">Te recomendamos cambiar tu contraseña después de tu primer inicio de sesión.</p>
          </div>
          <div style="text-align:center;padding:16px 25px;border-top:1px solid #e0e0e0;">
            <p style="color:#A0B1BD;font-size:11px;margin:0;">${footer}</p>
          </div>
        </div>`;

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: identity.from,
            to: [user.email],
            subject: "Tus credenciales de acceso - " + displayName,
            html: emailHtml,
          }),
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_set_password") {
      // Admin (global or portal owner) sets a new password for a partner user
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace("Bearer ", "").trim();
      if (!jwt) {
        return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: authData, error: authErr } = await userClient.auth.getUser();
      if (authErr || !authData?.user) {
        return new Response(JSON.stringify({ ok: false, error: "Sesión inválida" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const callerId = authData.user.id;

      const partnerUserId: string | undefined = (await Promise.resolve(email)) as any;
      const targetUserId = partnerUserId; // we reuse 'email' field for target id (like send_credentials)
      const targetPassword: string | undefined = new_password;

      if (!targetUserId || !targetPassword || typeof targetPassword !== "string" || targetPassword.length < 8) {
        return new Response(JSON.stringify({ ok: false, error: "Contraseña inválida (mín. 8 caracteres)" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorization: global_admin OR portal owner of this portal
      const { data: isAdminAsUser } = await userClient.rpc("is_portal_admin", { _portal_id: portal_id });
      let authorized = isAdminAsUser === true;
      if (!authorized) {
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .eq("role", "global_admin");
        authorized = Array.isArray(roleRows) && roleRows.length > 0;
      }
      if (!authorized) {
        return new Response(JSON.stringify({ ok: false, error: "Sin permisos para este portal" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify the target user belongs to this portal
      const { data: targetUser } = await supabase
        .from("partner_users")
        .select("id, portal_id")
        .eq("id", targetUserId)
        .eq("portal_id", portal_id)
        .maybeSingle();

      if (!targetUser) {
        return new Response(JSON.stringify({ ok: false, error: "Usuario no pertenece a este portal" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await supabase
        .from("partner_users")
        .update({ password_hash: await hashPassword(targetPassword) })
        .eq("id", targetUserId);

      if (updateErr) {
        return new Response(JSON.stringify({ ok: false, error: updateErr.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset") {
      if (!token || !new_password) {
        return new Response(JSON.stringify({ error: "Token y contraseña requeridos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find valid token
      const { data: resetToken } = await supabase
        .from("partner_password_reset_tokens")
        .select("*")
        .eq("token", token)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!resetToken) {
        return new Response(JSON.stringify({ error: "Token inválido o expirado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update password (hasheada antes de guardar)
      const { error: updateErr } = await supabase
        .from("partner_users")
        .update({ password_hash: await hashPassword(new_password) })
        .eq("portal_id", resetToken.portal_id)
        .ilike("email", resetToken.email);

      if (updateErr) throw updateErr;

      // Mark token as used
      await supabase
        .from("partner_password_reset_tokens")
        .update({ used: true })
        .eq("id", resetToken.id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change_password_self") {
      if (!email || !portal_id || !current_password || !new_password) {
        return new Response(JSON.stringify({ ok: false, error: "Parámetros incompletos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: user } = await supabase
        .from("partner_users")
        .select("id, password_hash")
        .eq("portal_id", portal_id)
        .ilike("email", normalizedEmail || "")
        .maybeSingle();

      const check = await verifyPassword(current_password, user?.password_hash);
      if (!user || !check.valid) {
        return new Response(JSON.stringify({ ok: false, error: "La contraseña actual no es correcta" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await supabase
        .from("partner_users")
        .update({ password_hash: await hashPassword(new_password) })
        .eq("id", user.id);

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Acción inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
