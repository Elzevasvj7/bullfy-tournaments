import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId } = await req.json();
    if (!roomId) {
      return new Response(JSON.stringify({ ok: false, error: "roomId is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    // Validate caller is authenticated
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get room info
    const { data: room } = await admin
      .from("live_rooms")
      .select("id, title, description, host_id")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) {
      return new Response(JSON.stringify({ ok: false, error: "Room not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get host name
    const { data: hostProfile } = await admin
      .from("profiles")
      .select("nombre")
      .eq("id", room.host_id)
      .maybeSingle();
    const hostName = hostProfile?.nombre || "Bullfy";

    // Get pending invitations (no email_sent_at) for this room
    const { data: pendingInvites } = await admin
      .from("live_room_invitations")
      .select("id, invited_user_id")
      .eq("room_id", roomId)
      .is("email_sent_at", null);

    if (!pendingInvites || pendingInvites.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = pendingInvites.map((p) => p.invited_user_id);
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, nombre, correo")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const liveUrl = `https://bullfytech.online/bullfy-live`;

    let sent = 0;
    for (const invite of pendingInvites) {
      const profile = profileMap.get(invite.invited_user_id);
      if (!profile?.correo) continue;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
          <div style="background:#062B63;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
            <h1 style="color:#83CBFF;margin:0;letter-spacing:2px;font-size:28px;">BULLFY</h1>
            <p style="color:#A0B1BD;margin:6px 0 0;font-size:11px;letter-spacing:4px;">FAMILY • LIVE</p>
          </div>
          <div style="padding:30px 25px;border:1px solid #e0e0e0;border-top:none;">
            <h2 style="color:#062B63;margin:0 0 16px;font-size:22px;">✨ Te invitaron a una sala Bullfy Family</h2>
            <p style="color:#55575d;font-size:14px;line-height:1.6;">Hola <strong>${profile.nombre || "miembro"}</strong>,</p>
            <p style="color:#55575d;font-size:14px;line-height:1.6;">
              <strong>${hostName}</strong> te invitó a una sesión privada en <strong>Bullfy Live</strong>:
            </p>
            <div style="background:#F7F9FC;border-left:4px solid #146EF5;padding:16px;border-radius:4px;margin:20px 0;">
              <h3 style="color:#062B63;margin:0 0 8px;font-size:16px;">${room.title}</h3>
              ${room.description ? `<p style="color:#55575d;margin:0;font-size:13px;">${room.description}</p>` : ""}
            </div>
            <p style="color:#55575d;font-size:14px;line-height:1.6;">
              Cuando el host inicie la sala, la verás disponible en tu sección de Bullfy Live.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${liveUrl}" style="background:#146EF5;color:#ffffff;font-size:14px;border-radius:8px;padding:14px 28px;text-decoration:none;font-weight:bold;display:inline-block;">
                Ir a Bullfy Live
              </a>
            </div>
            <p style="color:#999;font-size:12px;margin-top:24px;">Este es un acceso exclusivo para miembros Bullfy Family.</p>
          </div>
          <div style="text-align:center;padding:16px 25px;border-top:1px solid #e0e0e0;">
            <p style="color:#A0B1BD;font-size:11px;margin:0;">© 2026 Bullfy Tech. Todos los derechos reservados.</p>
          </div>
        </div>
      `;

      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: profile.correo,
          subject: `✨ Invitación Bullfy Family: ${room.title}`,
          html,
        }),
      });

      if (emailRes.ok) {
        await admin
          .from("live_room_invitations")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", invite.id);
        sent++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
