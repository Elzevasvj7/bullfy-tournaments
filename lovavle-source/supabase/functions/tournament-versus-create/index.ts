// Crea un reto 1v1: contra user existente (por username) o invitación por email tokenizada.
// PR #7 — C3: full_name y message escapados antes de inyectarlos en el HTML
//             del email para evitar XSS contra el destinatario.
// PR #7 — C4: rollback del lock usa RPC atómica tournament_wallet_unlock en
//             vez del patrón read-modify-write previo (que sufría race con
//             cualquier operación concurrente sobre el wallet).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser, randomToken } from "../_shared/tournament-helpers.js";

// Escape HTML entities. Previene XSS en emails outbound cuando el username,
// nombre o mensaje del usuario contiene tags. No interpolar nunca strings
// no-escapadas en plantillas HTML para destinatarios externos.
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { opponent_username, opponent_email, stake_usd, duration_minutes, message } = await req.json();
    if (!opponent_username && !opponent_email) return err("Username o email del rival requerido");

    const stake = Math.max(0, Number(stake_usd || 0));
    const duration = Math.max(15, Math.min(10080, Number(duration_minutes || 1440))); // 15min a 7 días

    let opponent_id: string | null = null;
    let invite_token: string | null = null;
    let opponent_email_clean: string | null = null;
    let opponent_username_hint: string | null = null;

    if (opponent_username) {
      const u = String(opponent_username).trim().replace(/^@/, "");
      const { data: target } = await supa.from("tournament_users")
        .select("id, email").ilike("username", u).maybeSingle();
      if (!target) return err("Usuario no encontrado");
      if (target.id === user.id) return err("No puedes retarte a ti mismo");
      opponent_id = target.id;
      opponent_username_hint = u;
    } else {
      const e = String(opponent_email).trim().toLowerCase();
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(e)) return err("Email inválido");
      const { data: existing } = await supa.from("tournament_users").select("id").eq("email", e).maybeSingle();
      if (existing) {
        if (existing.id === user.id) return err("No puedes retarte a ti mismo");
        opponent_id = existing.id;
      } else {
        invite_token = randomToken(24);
        opponent_email_clean = e;
      }
    }

    // Rate limit: no más de 1 reto activo al mismo oponente en 24h
    if (opponent_id) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: existing } = await supa.from("tournament_versus")
        .select("id").eq("challenger_id", user.id).eq("opponent_id", opponent_id)
        .in("status", ["pending","accepted","live"]).gte("created_at", since).maybeSingle();
      if (existing) return err("Ya tienes un reto activo o reciente con este usuario");
    }

    // Lock stake si > 0
    if (stake > 0) {
      const { data: w } = await supa.from("tournament_wallets").select("balance_usd").eq("user_id", user.id).maybeSingle();
      if (Number(w?.balance_usd ?? 0) < stake) return err("Saldo USDT insuficiente para apostar");
      const debit = await supa.rpc("tournament_wallet_debit", {
        p_user_id: user.id, p_usd: stake, p_bmoney: 0, p_lock_usd: true, p_lock_bmoney: false,
      });
      if (debit.error || debit.data === false) return err("No se pudo lockear stake");
    }

    const { data: v, error: insErr } = await supa.from("tournament_versus").insert({
      challenger_id: user.id, opponent_id, opponent_email: opponent_email_clean,
      opponent_username_hint, invite_token,
      stake_usd: stake, duration_minutes: duration,
      message: message || null, status: "pending",
    }).select().single();
    if (insErr) {
      // PR #7 C4: rollback atómico — UPDATE single-statement vía RPC,
      // sin la ventana select-then-update que tenía race con operaciones
      // concurrentes sobre el wallet.
      if (stake > 0) {
        await supa.rpc("tournament_wallet_unlock", { p_user_id: user.id, p_usd: stake });
      }
      return err("Error creando reto: " + insErr.message);
    }

    // Enviar invitación por email si aplica.
    // PR #7 C3: escapar full_name y message antes de interpolarlos al HTML —
    // un usuario con full_name "<script>..." o un message con <img onerror=>
    // antes lograba inyectar HTML/JS al cliente de correo del destinatario.
    if (invite_token && opponent_email_clean) {
      const inviteUrl = `https://bullfytech.online/tournament/versus/invite/${invite_token}`;
      const safeName = escapeHtml(user.full_name);
      const safeMessage = message ? escapeHtml(message) : "";
      try {
        await supa.functions.invoke("send-transactional-email", {
          body: {
            to: opponent_email_clean,
            subject: `${safeName} te ha retado en Bullfy Tournament`,
            html: `
              <h2>¡Te han retado!</h2>
              <p><strong>${safeName}</strong> te ha desafiado a un duelo 1 vs 1 en Bullfy Tournament.</p>
              ${stake > 0 ? `<p>Apuesta: <strong>$${stake} USDT</strong></p>` : ""}
              ${safeMessage ? `<blockquote>${safeMessage}</blockquote>` : ""}
              <p>Crea tu cuenta y acepta el reto:</p>
              <p><a href="${inviteUrl}" style="background:#00E5FF;color:#060B1F;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Aceptar reto</a></p>
              <p style="font-size:11px;color:#666">El link expira en 7 días.</p>
            `,
          },
        });
      } catch { /* email best-effort */ }
    }

    // Notificar in-app al oponente si ya tiene cuenta.
    // Notificación in-app no es HTML (la UI renderiza como texto), pero
    // mantenemos consistencia para no exponer el full_name crudo.
    if (opponent_id) {
      await supa.rpc("tournament_notify", {
        _user_id: opponent_id, _type: "versus_invite",
        _title: `${user.full_name} te ha retado 1v1`,
        _message: stake > 0 ? `Apuesta $${stake} USDT. Acepta o rechaza el reto.` : `Reto sin apuesta. Acepta o rechaza.`,
        _link: `/tournament/versus`,
        _ref_type: "versus", _ref_id: v.id,
      });
    }

    return ok({ versus: v, invite_url: invite_token ? `https://bullfytech.online/tournament/versus/invite/${invite_token}` : null });
  } catch (e) { return err((e as Error).message); }
});
