// Crea la cuenta MT5 del participante (idempotente). Envía credenciales por email.
// PR #8 — C2 / TOR-18: el password MT5 ya NO se devuelve en la respuesta al
// cliente. Se entrega únicamente por email al crear la cuenta y puede
// reenviarse en cualquier momento con `resend_email: true`. Antes el frontend
// lo mostraba con un botón "ojo" → riesgo de exposición vía extensiones,
// XSS, screenshares o console logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser, bridgeCall, randomToken } from "../_shared/tournament-helpers.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendCredentialsEmail(to: string, name: string, login: string, password: string, server: string, tournamentName: string) {
  try {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0f1f;color:#e6edf7;padding:24px;border-radius:12px;">
        <div style="text-align:center;padding:16px 0;">
          <h1 style="color:#83CBFF;margin:0;font-size:22px;">Bullfy Tournament</h1>
        </div>
        <h2 style="color:#fff;">Tu cuenta MT5 está lista</h2>
        <p>Hola ${name || "Trader"}, tu cuenta MT5 para el torneo <strong>${tournamentName}</strong> ha sido creada.</p>
        <div style="background:#101a33;border:1px solid #1d2a4a;border-radius:10px;padding:16px;margin:16px 0;font-family:monospace;font-size:14px;line-height:1.9;">
          <div><span style="color:#83CBFF;">Login:</span> <strong>${login}</strong></div>
          <div><span style="color:#83CBFF;">Password:</span> <strong>${password}</strong></div>
          <div><span style="color:#83CBFF;">Server:</span> <strong>${server}</strong></div>
        </div>
        <p style="font-size:13px;color:#a8b3cf;">Guarda estos datos en un lugar seguro. Puedes verlos en cualquier momento desde tu panel en <a href="https://bullfytech.online/tournament/dashboard" style="color:#83CBFF;">bullfytech.online</a>.</p>
        <p style="font-size:12px;color:#7886a6;margin-top:24px;">No compartas tu contraseña con nadie. El equipo de Bullfy nunca te la pedirá.</p>
      </div>
    `;
    await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to, subject: `🎯 Tu cuenta MT5 para ${tournamentName}`, html }),
    });
  } catch (e) {
    console.warn("Email send failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { participant_id, resend_email } = await req.json();
    if (!participant_id) return err("participant_id requerido");

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { data: p } = await supa.from("tournament_participants")
      .select("id, user_id, mt5_login, mt5_password, mt5_server, tournament_id")
      .eq("id", participant_id).maybeSingle();
    if (!p) return err("Participante no encontrado");
    if (p.user_id !== user.id) return err("No autorizado");

    const { data: t } = await supa.from("tournaments").select("*").eq("id", p.tournament_id).maybeSingle();
    if (!t) return err("Torneo no encontrado");

    // Idempotente: si ya existe, opcionalmente reenvía email.
    // El password no se devuelve al cliente — solo viaja por email.
    if (p.mt5_login) {
      if (resend_email && user.email) {
        await sendCredentialsEmail(user.email, user.full_name || "", p.mt5_login, p.mt5_password || "(oculta)", p.mt5_server || "Bullfy-Trade", t.name);
      }
      return ok({ mt5: { login: p.mt5_login, server: p.mt5_server } });
    }

    // Crear en bridge
    const pw = randomToken(8) + "Aa!";
    const fullName = (user.full_name || "Trader").slice(0, 50);
    const leverage = (t.trading_rules?.leverage as number) || 100;
    const startBal = Number(t.starting_balance_usd) || 0;
    const group = (t.trading_rules?.mt5_group as string) || "broker\\TEST-B NUEVO ERICK CRM";

    const createBody = {
      name: `T${t.id.slice(0, 8)}-${fullName}`.slice(0, 128),
      group, leverage, password: pw,
      email: user.email || "",
      comment: `tournament:${t.slug}`,
    };
    const r = await bridgeCall("POST", "/users", createBody);
    if (!r.ok || !r.data?.login) {
      console.warn("Bridge create failed", r.status, r.data, "group:", group);
      const detail = r.data?.detail || r.data?.error || JSON.stringify(r.data || {});
      return err(`MT5 bridge ${r.status}: ${detail}`, { bridge_status: r.status, bridge_data: r.data, group_used: group });
    }
    const mt5_login = String(r.data.login);
    const mt5_server = r.data.server || "Bullfy-Trade";

    if (startBal > 0) {
      const dep = await bridgeCall("POST", `/accounts/${mt5_login}/deposit`, {
        amount: startBal, comment: `tournament_start:${t.slug}`,
      });
      if (!dep.ok) console.warn("Bridge deposit failed", dep.status, dep.data);
    }

    // Suspender de inmediato: trading se habilita cuando abre la ventana del torneo
    const sus = await bridgeCall("POST", `/users/${mt5_login}/suspend`, {});
    if (!sus.ok) console.warn("Bridge suspend (post-create) failed", sus.status, sus.data);

    await supa.from("tournament_participants").update({
      mt5_login, mt5_password: pw, mt5_server, mt5_suspended: true,
    }).eq("id", participant_id);

    if (user.email) {
      await sendCredentialsEmail(user.email, user.full_name || "", mt5_login, pw, mt5_server, t.name);
    }

    // Password se entrega solo por email — no se devuelve al cliente.
    return ok({ mt5: { login: mt5_login, server: mt5_server } });
  } catch (e) {
    return err((e as Error).message);
  }
});
