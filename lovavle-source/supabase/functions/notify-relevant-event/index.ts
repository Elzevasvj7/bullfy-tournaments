import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { eventId, action } = await req.json();
    if (!eventId) throw new Error("eventId requerido");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: event, error: eErr } = await supabase
      .from("relevant_events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (eErr || !event) throw new Error("Evento no encontrado");

    // Destinatarios
    const recipients: string[] = [];
    const seen = new Set<string>();

    if (event.recipient_mode === "manual") {
      for (const e of (event.manual_recipients || []) as string[]) {
        const norm = e.trim().toLowerCase();
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          recipients.push(norm);
        }
      }
    } else {
      // Todos los bullfy_family
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "bullfy_family" as any);
      const userIds = (roles || []).map((r) => r.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("correo")
          .in("id", userIds);
        for (const p of profiles || []) {
          const norm = (p.correo || "").trim().toLowerCase();
          if (norm && !seen.has(norm)) {
            seen.add(norm);
            recipients.push(norm);
          }
        }
      }
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "Sin destinatarios" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startsAt = new Date(event.starts_at);
    const endsAt = new Date(startsAt.getTime() + (event.duration_minutes || 60) * 60 * 1000);
    const isCancel = action === "cancel" || event.status === "cancelled";

    const relevanceLabel =
      event.relevance_score >= 9 ? "🔥 ALTA RELEVANCIA" :
      event.relevance_score >= 7 ? "⭐ Importante" :
      event.relevance_score >= 4 ? "📌 Relevante" : "📍 Informativo";

    const { data: result, error: icsErr } = await supabase.functions.invoke("send-calendar-ics", {
      body: {
        to: recipients,
        method: isCancel ? "CANCEL" : "REQUEST",
        subject: isCancel
          ? `❌ Cancelado: ${event.title}`
          : `📅 ${relevanceLabel}: ${event.title}`,
        intro_html: `<p style="color:#475569;"><strong>${relevanceLabel}</strong> · Tema: <em>${event.topic}</em></p>`,
        events: [
          {
            uid: `relevant-event-${event.id}@bullfytech.online`,
            title: event.title,
            description: `${event.topic}\n\n${event.description || ""}`,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            timezone: event.timezone || "America/Bogota",
            reminders_minutes: event.selected_reminders || [600, 120, 10],
            status: isCancel ? "CANCELLED" : "CONFIRMED",
          },
        ],
      },
    });
    if (icsErr) throw icsErr;

    // Marcar como enviado
    if (!isCancel) {
      await supabase
        .from("relevant_events")
        .update({ status: "sent", notification_sent_at: new Date().toISOString() })
        .eq("id", eventId);
    }

    return new Response(JSON.stringify({ ok: true, sent: result?.sent || 0, total: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-relevant-event error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
