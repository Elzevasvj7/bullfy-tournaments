import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_BASE = "https://bullfyibsystem.lovable.app";

function htmlPage(title: string, message: string, isError = false) {
  const color = isError ? "#dc2626" : "#16a34a";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,sans-serif;background:#0F172A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#1e293b;padding:40px;border-radius:12px;max-width:420px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4)}
h1{color:${color};margin:0 0 12px}p{color:#cbd5e1;margin:0 0 20px}
.btn{display:inline-block;background:#146EF5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p>
<a class="btn" href="${APP_BASE}/settings">Volver a Settings</a></div>
<script>setTimeout(()=>{window.location.href="${APP_BASE}/settings?google_calendar=${isError ? "error" : "connected"}"},2500)</script>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      return new Response(htmlPage("Conexión cancelada", `Google reportó: ${errorParam}`, true), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (!code || !stateRaw) {
      return new Response(htmlPage("Error", "Faltan parámetros de OAuth", true), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const state = JSON.parse(atob(stateRaw));
    const userId: string = state.user_id;
    const accountType: string = state.account_type || "internal";

    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokens);
      return new Response(htmlPage("Error", `No se pudo obtener el token: ${tokens.error_description || tokens.error}`, true), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const { access_token, refresh_token, expires_in, scope } = tokens;
    if (!refresh_token) {
      return new Response(htmlPage("Error", "Google no devolvió refresh_token. Revoca el acceso desde myaccount.google.com/permissions e intenta de nuevo.", true), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Get user email from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const googleEmail = userInfo.email;
    if (!googleEmail) {
      return new Response(htmlPage("Error", "No se pudo obtener el email de Google", true), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { error: upsertErr } = await sb
      .from("google_calendar_connections")
      .upsert(
        {
          user_id: userId,
          account_type: accountType,
          google_email: googleEmail,
          access_token,
          refresh_token,
          token_expires_at: expiresAt,
          scopes: (scope || "").split(" ").filter(Boolean),
          calendar_id: "primary",
          active: true,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,google_email" }
      );

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return new Response(htmlPage("Error", upsertErr.message, true), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(htmlPage("✅ Calendar conectado", `Cuenta vinculada: ${googleEmail}`), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e: any) {
    console.error("google-oauth-callback error:", e);
    return new Response(htmlPage("Error", e.message, true), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
