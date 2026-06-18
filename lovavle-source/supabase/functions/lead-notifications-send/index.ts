// F6 — Envío de notificaciones a leads (email vía Resend) y bitácora en lead_notifications.
// Invocación: POST { lead_id, notification_type, subject, content, channel? } o
//             POST { event: "lead_assigned", lead_id } (plantilla por defecto).
// Devuelve siempre HTTP 200 con { ok: bool, error?: string }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Bullfy <noreply@bullfytech.online>";

function htmlWrap(title: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#062B63;padding:22px;text-align:center;border-radius:8px 8px 0 0;">
      <h1 style="color:#83CBFF;margin:0;font-size:22px;">Bullfy</h1>
    </div>
    <div style="padding:26px 22px;border:1px solid #e0e0e0;border-top:none;">
      <h2 style="color:#062B63;font-size:18px;margin:0 0 14px;">${title}</h2>
      ${body}
    </div>
  </div>`;
}

const defaultTemplates: Record<string, (lead: any) => { subject: string; content: string }> = {
  lead_assigned: (lead) => ({
    subject: `Hola ${lead.nombre || ""}, gracias por tu interés`,
    content: htmlWrap(
      "¡Bienvenido!",
      `<p>Hola <strong>${lead.nombre || "amigo/a"}</strong>, un asesor de Bullfy se pondrá en contacto contigo en breve.</p>
       <p>Si necesitas algo, responde a este correo.</p>`,
    ),
  }),
  follow_up: (lead) => ({
    subject: `${lead.nombre || ""}, queremos seguir contigo`,
    content: htmlWrap(
      "Seguimiento",
      `<p>Hola <strong>${lead.nombre || ""}</strong>, queremos retomar la conversación y resolver tus dudas.</p>`,
    ),
  }),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const lead_id: string = body.lead_id;
    if (!lead_id) {
      return new Response(JSON.stringify({ ok: false, error: "lead_id requerido" }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error: leadErr } = await supa
      .from("stream_leads")
      .select("id, nombre, correo")
      .eq("id", lead_id)
      .maybeSingle();
    if (leadErr || !lead) throw new Error("Lead no encontrado");
    if (!lead.correo) {
      return new Response(JSON.stringify({ ok: false, error: "Lead sin correo" }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const channel = body.channel || "email";
    const event = body.event as string | undefined;
    let notification_type: string = body.notification_type || event || "custom";
    let subject: string = body.subject || "";
    let content: string = body.content || "";

    if (!subject || !content) {
      const tpl = defaultTemplates[notification_type];
      if (tpl) {
        const t = tpl(lead);
        subject = subject || t.subject;
        content = content || t.content;
      } else {
        return new Response(JSON.stringify({ ok: false, error: "subject/content requeridos" }), {
          status: 200, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // Insertar bitácora pending
    const { data: log } = await supa.from("lead_notifications").insert({
      lead_id, notification_type, channel, subject, content, status: "pending",
      metadata: { event: event ?? null },
    }).select("id").single();

    // Envío
    let sent = false; let errMsg: string | null = null;
    if (channel === "email") {
      if (!RESEND_API_KEY) {
        errMsg = "RESEND_API_KEY no configurada";
      } else {
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: FROM, to: [lead.correo], subject, html: content }),
          });
          sent = r.ok;
          if (!r.ok) errMsg = `Resend ${r.status}: ${await r.text().catch(() => "")}`;
        } catch (e) { errMsg = (e as Error).message; }
      }
    } else {
      errMsg = `Canal "${channel}" aún no implementado`;
    }

    if (log?.id) {
      await supa.from("lead_notifications").update({
        status: sent ? "sent" : "failed",
        sent_at: sent ? new Date().toISOString() : null,
        error: errMsg,
      }).eq("id", log.id);
    }

    return new Response(JSON.stringify({ ok: sent, error: errMsg, notification_id: log?.id ?? null }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[lead-notifications-send]", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
