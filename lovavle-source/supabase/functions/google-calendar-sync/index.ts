import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  action: "create" | "update" | "cancel";
  user_id: string; // Bullfy user (interno o ib_externo)
  source_type: "campaign_task" | "lead_followup" | "ops_deadline" | "bullfy_family_live" | "manual" | "other";
  source_id?: string;
  title: string;
  description?: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  recipient_email?: string; // for fallback .ics if user has no OAuth connection
}

async function refreshGoogleToken(refresh_token: string) {
  const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
  const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Refresh failed: ${json.error_description || json.error}`);
  return { access_token: json.access_token as string, expires_in: json.expires_in as number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = (await req.json()) as SyncRequest;
    const { action, user_id, source_type, source_id, title, description, starts_at, ends_at, recipient_email } = body;

    if (!action || !user_id || !title || !starts_at || !ends_at) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find existing event log for this source (for update/cancel)
    let existingLog: any = null;
    if (source_id) {
      const { data } = await sb
        .from("calendar_events_log")
        .select("*")
        .eq("user_id", user_id)
        .eq("source_type", source_type)
        .eq("source_id", source_id)
        .maybeSingle();
      existingLog = data;
    }

    // Find active Google connection
    const { data: connection } = await sb
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", user_id)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let deliveryMethod = "google_oauth";
    let googleEventId: string | null = existingLog?.google_event_id || null;
    let googleEventLink: string | null = existingLog?.google_event_link || null;
    let status = "synced";
    let errorMessage: string | null = null;

    if (connection) {
      try {
        // Refresh token if expired
        let accessToken = connection.access_token;
        if (new Date(connection.token_expires_at) <= new Date()) {
          const refreshed = await refreshGoogleToken(connection.refresh_token);
          accessToken = refreshed.access_token;
          await sb
            .from("google_calendar_connections")
            .update({
              access_token: refreshed.access_token,
              token_expires_at: new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString(),
              last_sync_at: new Date().toISOString(),
            })
            .eq("id", connection.id);
        }

        const calendarId = connection.calendar_id || "primary";
        const eventBody = {
          summary: title,
          description: description || "",
          start: { dateTime: starts_at },
          end: { dateTime: ends_at },
          source: { title: "Bullfy IB System", url: "https://bullfyibsystem.lovable.app" },
        };

        if (action === "create" || (action === "update" && !googleEventId)) {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(eventBody),
            }
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message || "Create failed");
          googleEventId = json.id;
          googleEventLink = json.htmlLink;
        } else if (action === "update" && googleEventId) {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
            {
              method: "PATCH",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(eventBody),
            }
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message || "Update failed");
          googleEventLink = json.htmlLink;
        } else if (action === "cancel" && googleEventId) {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (!res.ok && res.status !== 410 && res.status !== 404) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error?.message || "Delete failed");
          }
          status = "cancelled";
        }
      } catch (e: any) {
        console.error("Google API error:", e);
        errorMessage = e.message;
        status = "error";
        await sb
          .from("google_calendar_connections")
          .update({ last_error: e.message })
          .eq("id", connection.id);
        // Fall back to ICS if there's a recipient_email
        if (recipient_email) {
          deliveryMethod = "ics_email";
          status = "synced";
          errorMessage = `Google API failed, sent .ics: ${e.message}`;
        }
      }
    } else {
      // No OAuth → fallback to .ics
      deliveryMethod = "ics_email";
    }

    // Send .ics email if needed
    if (deliveryMethod === "ics_email" && recipient_email && action !== "cancel") {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-calendar-ics`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({
            to: recipient_email,
            uid: `${source_type}-${source_id || crypto.randomUUID()}@bullfytech.online`,
            method: "REQUEST",
            sequence: existingLog ? (existingLog.sequence || 0) + 1 : 0,
            title,
            description,
            starts_at,
            ends_at,
          }),
        });
      } catch (e: any) {
        console.error(".ics send failed:", e);
        errorMessage = `ICS send failed: ${e.message}`;
        status = "error";
      }
    } else if (deliveryMethod === "ics_email" && action === "cancel" && recipient_email) {
      await fetch(`${SUPABASE_URL}/functions/v1/send-calendar-ics`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({
          to: recipient_email,
          uid: `${source_type}-${source_id || "x"}@bullfytech.online`,
          method: "CANCEL",
          sequence: existingLog ? (existingLog.sequence || 0) + 1 : 1,
          title,
          description,
          starts_at,
          ends_at,
        }),
      });
    }

    // Log to calendar_events_log
    const logPayload = {
      user_id,
      connection_id: connection?.id || null,
      source_type,
      source_id: source_id || null,
      title,
      description: description || null,
      starts_at,
      ends_at,
      delivery_method: deliveryMethod,
      google_event_id: googleEventId,
      google_event_link: googleEventLink,
      status: action === "cancel" ? "cancelled" : status,
      last_action: action,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    };

    if (existingLog) {
      await sb.from("calendar_events_log").update(logPayload).eq("id", existingLog.id);
    } else {
      await sb.from("calendar_events_log").insert(logPayload);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        delivery_method: deliveryMethod,
        google_event_id: googleEventId,
        google_event_link: googleEventLink,
        status,
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("google-calendar-sync error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
