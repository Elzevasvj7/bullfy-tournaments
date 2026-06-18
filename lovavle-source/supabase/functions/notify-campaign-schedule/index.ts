import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskRow {
  id: string;
  day_number: number;
  title: string;
  instruction: string;
  content_type: string;
  file_urls: string[] | null;
  display_order: number;
}

// Devuelve hora local (0-23) en una zona horaria para una fecha dada
function getLocalHour(iso: string, tz: string): number {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false });
  return parseInt(fmt.format(d), 10);
}

// Construye un Date para "día N de campaña a la hora H en zona TZ"
function buildLocalDate(startDate: string, dayNumber: number, hour: number, tz: string): Date {
  // startDate viene como YYYY-MM-DD
  const [y, m, d] = startDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d));
  target.setUTCDate(target.getUTCDate() + (dayNumber - 1));
  // Ahora necesitamos hour:00 en TZ. Estrategia: ajustar UTC iterativamente.
  // Crear candidato a hour UTC y luego corregir según offset.
  const candidate = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), hour, 0, 0));
  // Ajustar por la diferencia entre UTC y TZ
  const localHour = getLocalHour(candidate.toISOString(), tz);
  const delta = hour - localHour;
  candidate.setUTCHours(candidate.getUTCHours() + delta);
  return candidate;
}

// Ajusta una hora dentro de la ventana operativa
function adjustToOperativeHours(
  startDate: string,
  dayNumber: number,
  preferredHour: number,
  windowStart: number,
  windowEnd: number,
  tz: string,
): Date {
  let target = buildLocalDate(startDate, dayNumber, preferredHour, tz);
  const localHour = getLocalHour(target.toISOString(), tz);
  if (localHour >= windowStart && localHour < windowEnd) return target;
  // Fuera de ventana: mover a windowStart del mismo día (o siguiente si ya pasó)
  target = buildLocalDate(startDate, dayNumber, Math.max(windowStart, 9), tz);
  return target;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId, onlyIbId } = await req.json();
    if (!campaignId) throw new Error("campaignId requerido");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cargar campaña
    const { data: campaign, error: cErr } = await supabase
      .from("marketing_campaigns")
      .select("id, name, description, start_date, status, recipient_mode, manual_recipients, reminder_hour, operative_hours_start, operative_hours_end, created_by")
      .eq("id", campaignId)
      .single();
    if (cErr || !campaign) throw new Error("Campaña no encontrada");

    // Cargar tareas
    const { data: tasks, error: tErr } = await supabase
      .from("campaign_tasks")
      .select("id, day_number, title, instruction, content_type, file_urls, display_order")
      .eq("campaign_id", campaignId)
      .order("day_number", { ascending: true })
      .order("display_order", { ascending: true });
    if (tErr) throw tErr;
    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "Campaña sin tareas" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determinar destinatarios con su timezone preferida
    type Recipient = { email: string; tz: string; userId?: string };
    const recipients: Recipient[] = [];
    const seenEmails = new Set<string>();

    if (campaign.recipient_mode === "manual") {
      const manualEmails = (campaign.manual_recipients || []) as string[];
      for (const email of manualEmails) {
        const e = email.trim().toLowerCase();
        if (!e || seenEmails.has(e)) continue;
        seenEmails.add(e);
        recipients.push({ email: e, tz: "America/Bogota" });
      }
    } else {
      // IBs asignados (filtro opcional por onlyIbId)
      let assignmentsQuery = supabase
        .from("campaign_ib_assignments")
        .select("ib_id")
        .eq("campaign_id", campaignId);
      if (onlyIbId) assignmentsQuery = assignmentsQuery.eq("ib_id", onlyIbId);
      const { data: assignments } = await assignmentsQuery;
      const ibIds = (assignments || []).map((a) => a.ib_id);

      if (ibIds.length > 0) {
        const { data: ibs } = await supabase
          .from("ibs")
          .select("id, correo_ib, preferred_timezone")
          .in("id", ibIds);
        for (const ib of ibs || []) {
          const e = (ib.correo_ib || "").trim().toLowerCase();
          if (!e || seenEmails.has(e)) continue;
          seenEmails.add(e);
          recipients.push({ email: e, tz: ib.preferred_timezone || "America/Bogota" });
        }
        // Sub-IBs de esos IBs
        const { data: subIbs } = await supabase
          .from("sub_ibs")
          .select("correo, preferred_timezone")
          .in("ib_id", ibIds);
        for (const sub of subIbs || []) {
          const e = ((sub as any).correo || "").trim().toLowerCase();
          if (!e || seenEmails.has(e)) continue;
          seenEmails.add(e);
          recipients.push({ email: e, tz: (sub as any).preferred_timezone || "America/Bogota" });
        }
      }

      // BDs (todos)
      if (!onlyIbId) {
        const { data: bdRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["bd", "admin_bd"] as any);
        const bdIds = (bdRoles || []).map((r) => r.user_id);
        if (bdIds.length > 0) {
          const { data: bdProfiles } = await supabase
            .from("profiles")
            .select("id, correo, preferred_timezone")
            .in("id", bdIds);
          for (const p of bdProfiles || []) {
            const e = (p.correo || "").trim().toLowerCase();
            if (!e || seenEmails.has(e)) continue;
            seenEmails.add(e);
            recipients.push({ email: e, tz: p.preferred_timezone || "America/Bogota", userId: p.id });
          }
        }
      }
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "Sin destinatarios" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reminderHour = campaign.reminder_hour ?? 9;
    const opStart = campaign.operative_hours_start ?? 6;
    const opEnd = campaign.operative_hours_end ?? 21;

    let totalSent = 0;
    const errors: string[] = [];

    // Generar un .ics personalizado por receptor (cada uno con su zona horaria)
    for (const rec of recipients) {
      const events = (tasks as TaskRow[]).map((t) => {
        const start = adjustToOperativeHours(
          campaign.start_date,
          t.day_number,
          reminderHour,
          opStart,
          opEnd,
          rec.tz,
        );
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        const filesText = t.file_urls && t.file_urls.length > 0 ? `\n\nArchivos:\n${t.file_urls.join("\n")}` : "";
        return {
          uid: `campaign-${campaignId}-task-${t.id}@bullfytech.online`,
          title: `[${campaign.name}] Día ${t.day_number}: ${t.title}`,
          description: `${t.instruction}\n\nTipo: ${t.content_type}${filesText}`,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          timezone: rec.tz,
          reminders_minutes: [60],
        };
      });

      const { data: result, error: icsErr } = await supabase.functions.invoke("send-calendar-ics", {
        body: {
          to: rec.email,
          method: "PUBLISH",
          subject: `📅 Cronograma campaña: ${campaign.name} (${tasks.length} tareas)`,
          intro_html: `<p style="color:#475569;">Hola, te enviamos el cronograma completo de la campaña <strong>${campaign.name}</strong>. Las horas se han ajustado a tu zona horaria (<strong>${rec.tz}</strong>) dentro de tu ventana operativa (${opStart}:00 – ${opEnd}:00).</p>`,
          events,
        },
      });
      if (icsErr) {
        errors.push(`${rec.email}: ${icsErr.message}`);
        continue;
      }
      if (result?.sent) totalSent += result.sent;

      // Log idempotente por (recipient, source_id=task_id)
      for (const t of tasks as TaskRow[]) {
        await supabase.from("calendar_events_log").insert({
          user_id: rec.userId || null,
          recipient_email: rec.email,
          source_type: "campaign_task",
          source_id: t.id,
          title: `[${campaign.name}] Día ${t.day_number}: ${t.title}`,
          description: t.instruction,
          starts_at: campaign.start_date,
          ends_at: campaign.start_date,
          delivery_method: "ics_email",
          status: "sent",
          last_action: "create",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent, recipients: recipients.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-campaign-schedule error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
