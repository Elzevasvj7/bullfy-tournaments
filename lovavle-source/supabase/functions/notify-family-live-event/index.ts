import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { roomId, timezone } = await req.json();
    if (!roomId) throw new Error("roomId requerido");
    const tz = timezone || "America/Bogota";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cargar sala
    const { data: room, error: roomErr } = await supabase
      .from("live_rooms")
      .select("id, title, description, scheduled_at, host_id")
      .eq("id", roomId)
      .single();
    if (roomErr || !room) throw new Error("Sala no encontrada");
    if (!room.scheduled_at) throw new Error("La sala no tiene fecha programada");

    // Cargar invitaciones
    const { data: invitations } = await supabase
      .from("live_room_invitations")
      .select("invited_user_id")
      .eq("room_id", roomId);

    if (!invitations || invitations.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No hay invitados" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = invitations.map((i) => i.invited_user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, correo, nombre")
      .in("id", userIds);

    const recipients = (profiles || []).filter((p) => p.correo).map((p) => p.correo as string);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "Sin emails válidos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calcular fin (1h por defecto)
    const startsAt = new Date(room.scheduled_at);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    const { data: result, error: icsErr } = await supabase.functions.invoke("send-calendar-ics", {
      body: {
        to: recipients,
        method: "REQUEST",
        events: [
          {
            uid: `family-live-${roomId}@bullfytech.online`,
            title: `Bullfy Family Live: ${room.title}`,
            description: room.description || "Sesión privada Bullfy Family",
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            timezone: tz,
            reminders_minutes: [60, 10],
          },
        ],
      },
    });
    if (icsErr) throw icsErr;

    // Log
    for (const p of profiles || []) {
      if (!p.correo) continue;
      await supabase.from("calendar_events_log").insert({
        user_id: p.id,
        recipient_email: p.correo,
        source_type: "bullfy_family_live",
        source_id: roomId,
        title: `Bullfy Family Live: ${room.title}`,
        description: room.description,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        delivery_method: "ics_email",
        status: "sent",
        last_action: "create",
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: result?.sent || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-family-live-event error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
