// Avaturn Pro session bootstrapper.
// Creates (or reuses) an anonymous Avaturn user for the tournament player
// and returns a short-lived session URL for the @avaturn/sdk to mount.
//
// Auth: tournament users use their own JWT (tournament_auth) — we don't
// validate it here because the function only proxies to Avaturn and
// returns a non-sensitive short-lived URL. CORS-open by design.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const AVATURN_API = "https://api.avaturn.me/api/v1";

function jsonOk(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("AVATURN_API_KEY");
    if (!apiKey) return jsonOk({ ok: false, error: "AVATURN_API_KEY missing" });

    let body: any = {};
    try { body = await req.json(); } catch { /* allow empty */ }
    let avaturnUserId: string | undefined = body?.avaturn_user_id;
    const avaturnAvatarId: string | undefined = body?.avaturn_avatar_id;

    // 1) Ensure we have an Avaturn user id (create one if first time).
    if (!avaturnUserId) {
      const uRes = await fetch(`${AVATURN_API}/users/new`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const uTxt = await uRes.text();
      if (!uRes.ok) {
        console.error("avaturn users/new failed", uRes.status, uTxt);
        return jsonOk({ ok: false, error: `users/new ${uRes.status}: ${uTxt.slice(0, 200)}` });
      }
      try {
        const u = JSON.parse(uTxt);
        avaturnUserId = u.id || u.user_id || u.uuid;
      } catch {
        return jsonOk({ ok: false, error: "users/new returned non-JSON" });
      }
      if (!avaturnUserId) return jsonOk({ ok: false, error: "users/new did not return id" });
    }

    // 2) Create a session for that user.
    const sRes = await fetch(`${AVATURN_API}/sessions/new`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        avaturnAvatarId
          ? {
              user_id: avaturnUserId,
              session_type: "edit_existing",
              avatar_id: avaturnAvatarId,
            }
          : {
              user_id: avaturnUserId,
              session_type: "create_or_edit_existing",
            },
      ),
    });
    const sTxt = await sRes.text();
    if (!sRes.ok) {
      console.error("avaturn sessions/new failed", sRes.status, sTxt);
      return jsonOk({ ok: false, error: `sessions/new ${sRes.status}: ${sTxt.slice(0, 200)}` });
    }
    let url: string | undefined;
    try {
      const s = JSON.parse(sTxt);
      url = s.url || s.session_url || s.link;
    } catch {
      return jsonOk({ ok: false, error: "sessions/new returned non-JSON" });
    }
    if (!url) return jsonOk({ ok: false, error: "sessions/new did not return url" });

    return jsonOk({ ok: true, url, avaturn_user_id: avaturnUserId });
  } catch (e: any) {
    console.error("avaturn-session error", e);
    return jsonOk({ ok: false, error: e?.message || "internal error" });
  }
});
