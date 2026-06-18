const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
  timezone?: string; // IANA, e.g. America/Bogota
  reminders_minutes?: number[]; // [60, 10] = 1h y 10min antes
  sequence?: number;
  status?: "CONFIRMED" | "CANCELLED";
}

interface RequestBody {
  to: string | string[];
  subject?: string;
  intro_html?: string;
  method?: "REQUEST" | "PUBLISH" | "CANCEL";
  // Single mode (compatibilidad hacia atrás)
  uid?: string;
  title?: string;
  description?: string;
  starts_at?: string;
  ends_at?: string;
  timezone?: string;
  reminders_minutes?: number[];
  sequence?: number;
  // Batch mode
  events?: IcsEvent[];
}

// Zonas horarias soportadas con reglas DST simplificadas
const TIMEZONE_DEFINITIONS: Record<
  string,
  { tzid: string; standardOffset: string; standardName: string; daylight?: { offset: string; name: string; startMonth: number; endMonth: number } }
> = {
  "America/Bogota": { tzid: "America/Bogota", standardOffset: "-0500", standardName: "COT" },
  "America/Lima": { tzid: "America/Lima", standardOffset: "-0500", standardName: "PET" },
  "America/Mexico_City": { tzid: "America/Mexico_City", standardOffset: "-0600", standardName: "CST" },
  "America/Caracas": { tzid: "America/Caracas", standardOffset: "-0400", standardName: "VET" },
  "America/Santiago": { tzid: "America/Santiago", standardOffset: "-0400", standardName: "CLT" },
  "America/Argentina/Buenos_Aires": { tzid: "America/Argentina/Buenos_Aires", standardOffset: "-0300", standardName: "ART" },
  "America/New_York": {
    tzid: "America/New_York",
    standardOffset: "-0500",
    standardName: "EST",
    daylight: { offset: "-0400", name: "EDT", startMonth: 3, endMonth: 11 },
  },
  "America/Chicago": {
    tzid: "America/Chicago",
    standardOffset: "-0600",
    standardName: "CST",
    daylight: { offset: "-0500", name: "CDT", startMonth: 3, endMonth: 11 },
  },
  Europe_Madrid: { tzid: "Europe/Madrid", standardOffset: "+0100", standardName: "CET", daylight: { offset: "+0200", name: "CEST", startMonth: 3, endMonth: 10 } },
  "Europe/Madrid": {
    tzid: "Europe/Madrid",
    standardOffset: "+0100",
    standardName: "CET",
    daylight: { offset: "+0200", name: "CEST", startMonth: 3, endMonth: 10 },
  },
  "Europe/London": {
    tzid: "Europe/London",
    standardOffset: "+0000",
    standardName: "GMT",
    daylight: { offset: "+0100", name: "BST", startMonth: 3, endMonth: 10 },
  },
  "Asia/Dubai": { tzid: "Asia/Dubai", standardOffset: "+0400", standardName: "GST" },
  UTC: { tzid: "UTC", standardOffset: "+0000", standardName: "UTC" },
};

function buildVTimezone(tz: string): string {
  const def = TIMEZONE_DEFINITIONS[tz] || TIMEZONE_DEFINITIONS["America/Bogota"];
  const lines = ["BEGIN:VTIMEZONE", `TZID:${def.tzid}`];
  if (def.daylight) {
    lines.push(
      "BEGIN:DAYLIGHT",
      `TZOFFSETFROM:${def.standardOffset}`,
      `TZOFFSETTO:${def.daylight.offset}`,
      `TZNAME:${def.daylight.name}`,
      "DTSTART:19700308T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
      "END:DAYLIGHT",
      "BEGIN:STANDARD",
      `TZOFFSETFROM:${def.daylight.offset}`,
      `TZOFFSETTO:${def.standardOffset}`,
      `TZNAME:${def.standardName}`,
      "DTSTART:19701101T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
      "END:STANDARD",
    );
  } else {
    lines.push(
      "BEGIN:STANDARD",
      `TZOFFSETFROM:${def.standardOffset}`,
      `TZOFFSETTO:${def.standardOffset}`,
      `TZNAME:${def.standardName}`,
      "DTSTART:19700101T000000",
      "END:STANDARD",
    );
  }
  lines.push("END:VTIMEZONE");
  return lines.join("\r\n");
}

function toIcsLocalDate(iso: string, tz: string): string {
  // Convierte ISO UTC → string local en la TZ (formato YYYYMMDDTHHMMSS sin Z)
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}${parts.month}${parts.day}T${parts.hour === "24" ? "00" : parts.hour}${parts.minute}${parts.second}`;
}

function toIcsUtcDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildVAlarm(minutesBefore: number, description: string): string {
  return [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(description)}`,
    `TRIGGER:-PT${minutesBefore}M`,
    "END:VALARM",
  ].join("\r\n");
}

function buildVEvent(ev: IcsEvent): string {
  const tz = ev.timezone && TIMEZONE_DEFINITIONS[ev.timezone] ? ev.timezone : null;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${toIcsUtcDate(new Date().toISOString())}`,
  ];
  if (tz) {
    lines.push(`DTSTART;TZID=${tz}:${toIcsLocalDate(ev.starts_at, tz)}`);
    lines.push(`DTEND;TZID=${tz}:${toIcsLocalDate(ev.ends_at, tz)}`);
  } else {
    lines.push(`DTSTART:${toIcsUtcDate(ev.starts_at)}`);
    lines.push(`DTEND:${toIcsUtcDate(ev.ends_at)}`);
  }
  lines.push(
    `SEQUENCE:${ev.sequence ?? 0}`,
    `STATUS:${ev.status ?? "CONFIRMED"}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    `DESCRIPTION:${escapeIcs(ev.description || "")}`,
  );
  if (ev.reminders_minutes && ev.reminders_minutes.length > 0) {
    for (const m of ev.reminders_minutes) {
      lines.push(buildVAlarm(m, `Recordatorio: ${ev.title}`));
    }
  }
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

function buildIcs(events: IcsEvent[], method: "REQUEST" | "PUBLISH" | "CANCEL"): string {
  const usedTimezones = new Set<string>();
  for (const ev of events) {
    if (ev.timezone && TIMEZONE_DEFINITIONS[ev.timezone]) usedTimezones.add(ev.timezone);
  }
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bullfy//IB System//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
  ];
  for (const tz of usedTimezones) {
    lines.push(buildVTimezone(tz));
  }
  for (const ev of events) {
    lines.push(buildVEvent(ev));
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// btoa-safe para UTF-8
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

const INSTRUCTIONS_HTML = `
<div style="margin-top:24px;padding:16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;">
  <p style="margin:0 0 12px;color:#0369a1;font-weight:bold;font-size:14px;">📎 Cómo agregar este evento a tu calendario:</p>
  <ul style="margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:1.7;">
    <li><strong>📧 Gmail (web):</strong> Abre el correo → verás una tarjeta del evento → click "Sí" o "Agregar a Calendario".</li>
    <li><strong>🪟 Outlook (Windows/web):</strong> El evento aparece como invitación → click "Aceptar".</li>
    <li><strong>🍎 Apple Calendar (iPhone/iPad/Mac):</strong> Toca el archivo <code>invite.ics</code> adjunto → "Agregar a Calendario".</li>
    <li><strong>📱 Otros (Android):</strong> Descarga <code>invite.ics</code> y ábrelo con tu app de calendario.</li>
  </ul>
  <p style="margin:12px 0 0;color:#0369a1;font-size:12px;">⏰ Los recordatorios sonarán automáticamente en tu dispositivo. 🌍 La hora se ajusta a tu zona local.</p>
</div>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as RequestBody;
    const method = body.method ?? "REQUEST";

    // Construir array de eventos (compat single + batch)
    let events: IcsEvent[] = [];
    if (body.events && Array.isArray(body.events) && body.events.length > 0) {
      events = body.events;
    } else if (body.uid && body.title && body.starts_at && body.ends_at) {
      events = [
        {
          uid: body.uid,
          title: body.title,
          description: body.description,
          starts_at: body.starts_at,
          ends_at: body.ends_at,
          timezone: body.timezone,
          reminders_minutes: body.reminders_minutes,
          sequence: body.sequence,
          status: method === "CANCEL" ? "CANCELLED" : "CONFIRMED",
        },
      ];
    } else {
      return new Response(JSON.stringify({ error: "Missing events or single-event fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients = Array.isArray(body.to) ? body.to : [body.to];
    if (recipients.length === 0 || !recipients[0]) {
      return new Response(JSON.stringify({ error: "Missing recipients" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const ics = buildIcs(events, method);
    const ics_b64 = utf8ToBase64(ics);

    const isCancel = method === "CANCEL";
    const isBatch = events.length > 1;
    const firstEv = events[0];
    const subject =
      body.subject ??
      (isCancel
        ? `❌ Cancelado: ${firstEv.title}`
        : isBatch
        ? `📅 Cronograma: ${events.length} eventos programados`
        : `📅 Invitación: ${firstEv.title}`);

    const startStr = new Date(firstEv.starts_at).toLocaleString("es-CO", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: firstEv.timezone || "America/Bogota",
    });

    const eventListHtml = isBatch
      ? `<div style="margin-top:16px;"><p style="font-weight:bold;color:#062B63;">📋 Eventos incluidos (${events.length}):</p><ul style="color:#475569;font-size:13px;">${events
          .slice(0, 20)
          .map((e) => {
            const dt = new Date(e.starts_at).toLocaleString("es-CO", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: e.timezone || "America/Bogota",
            });
            return `<li><strong>${e.title}</strong> — ${dt}</li>`;
          })
          .join("")}${events.length > 20 ? `<li>... y ${events.length - 20} más</li>` : ""}</ul></div>`
      : "";

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>
<div style="padding:24px;background:#ffffff;">
<h2 style="color:${isCancel ? "#dc2626" : "#062B63"};">${
      isCancel ? "❌ Evento cancelado" : isBatch ? "📅 Nuevo cronograma" : "📅 Nueva invitación de calendario"
    }</h2>
${body.intro_html ?? ""}
${!isBatch ? `<h3 style="color:#062B63;margin-top:20px;">${firstEv.title}</h3><p style="color:#475569;"><strong>Fecha:</strong> ${startStr}</p>${firstEv.description ? `<p style="color:#475569;">${firstEv.description.replace(/\n/g, "<br>")}</p>` : ""}` : ""}
${eventListHtml}
${isCancel ? '<p style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;color:#991b1b;">Este evento fue cancelado.</p>' : INSTRUCTIONS_HTML}
</div>
<div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System · bullfytech.online</div></div>`;

    const results: { to: string; ok: boolean; id?: string; error?: string }[] = [];

    for (const to of recipients) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Bullfy Calendar <calendar@bullfytech.online>",
          to: [to],
          subject,
          html,
          attachments: [
            {
              filename: "invite.ics",
              content: ics_b64,
              content_type: `text/calendar; method=${method}; charset=UTF-8`,
            },
          ],
        }),
      });

      const result = await resendRes.json();
      if (!resendRes.ok) {
        console.error("Resend error for", to, result);
        results.push({ to, ok: false, error: result.message || "Resend failed" });
      } else {
        results.push({ to, ok: true, id: result.id });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ ok: true, sent, total: recipients.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-calendar-ics error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
