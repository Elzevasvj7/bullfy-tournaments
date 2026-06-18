// Envía recordatorios de vencimiento de membresías. Lo dispara el cron diario
// `membership-reminders-daily`.
//
// Por cada campaña activa (portal_membership_reminder_campaigns), busca las
// membresías de usuario (portal_user_memberships) que vencen EXACTAMENTE en
// `days_before` días y que aún no recibieron esa campaña, y envía un email vía
// Resend. El log (portal_membership_reminder_log, único por campaña+membresía)
// evita doble envío.
//
// Variables soportadas en subject/message: {nombre} {membresia} {fecha_vencimiento}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPortalEmailIdentity } from "../_shared/portalEmail.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_URL = "https://api.resend.com/emails";

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl
    .replace(/\{nombre\}/g, vars.nombre)
    .replace(/\{membresia\}/g, vars.membresia)
    .replace(/\{fecha_vencimiento\}/g, vars.fecha_vencimiento);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY no configurada" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: campaigns } = await supabase
      .from("portal_membership_reminder_campaigns")
      .select("id, portal_id, name, days_before, subject, message, active")
      .eq("active", true);

    let sent = 0, skipped = 0, failed = 0;

    for (const c of (campaigns || [])) {
      // Remitente del portal de esta campaña (white-label si tiene dominio propio).
      const identity = await getPortalEmailIdentity(supabase, c.portal_id);
      const days = Math.max(0, Number(c.days_before) || 0);
      // Ventana del día objetivo (UTC): [target 00:00, target+1 00:00).
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() + days);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      const { data: memberships } = await supabase
        .from("portal_user_memberships")
        .select("id, partner_user_id, expires_at, tier_slug, product_id, partner_users:partner_user_id(nombre, email), portal_products:product_id(title)")
        .eq("portal_id", c.portal_id)
        .eq("status", "active")
        .gte("expires_at", start.toISOString())
        .lt("expires_at", end.toISOString());

      for (const m of (memberships || [])) {
        const email = (m as any).partner_users?.email as string | undefined;
        if (!email) { skipped++; continue; }

        // ¿ya se envió esta campaña a esta membresía?
        const { data: already } = await supabase
          .from("portal_membership_reminder_log")
          .select("id")
          .eq("campaign_id", c.id)
          .eq("user_membership_id", m.id)
          .maybeSingle();
        if (already) { skipped++; continue; }

        const vars = {
          nombre: (m as any).partner_users?.nombre || "",
          membresia: (m as any).portal_products?.title || "tu membresía",
          fecha_vencimiento: m.expires_at
            ? new Date(m.expires_at).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })
            : "",
        };

        const subject = fillTemplate(c.subject, vars);
        const bodyHtml = `<div style="font-family:sans-serif;font-size:15px;color:#1a1a1a;line-height:1.5">${fillTemplate(c.message, vars).replace(/\n/g, "<br>")}</div>`;

        try {
          const resp = await fetch(RESEND_URL, {
            method: "POST",
            headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: identity.from, to: [email], subject, html: bodyHtml }),
          });
          if (!resp.ok) {
            failed++;
            console.error("Resend error", await resp.text());
            continue;
          }
        } catch (e) {
          failed++;
          console.error("Resend exception", e);
          continue;
        }

        await supabase.from("portal_membership_reminder_log").insert({
          campaign_id: c.id,
          user_membership_id: m.id,
          email,
        });
        sent++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, failed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("membership-reminders error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
