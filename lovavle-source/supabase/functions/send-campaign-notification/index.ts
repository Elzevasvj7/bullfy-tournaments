import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const admin = createClient(supabaseUrl, serviceKey);

    const { campaign_id, ib_ids, type, stop_reason, completed_by_ib_id, task_title, campaign_name } = await req.json();

    // Handle task_completed: notify campaign creator + optional ventas user
    if (type === "task_completed") {
      const { data: campaignFull } = await admin
        .from("marketing_campaigns")
        .select("name, created_by, notify_user_id")
        .eq("id", campaign_id)
        .single();

      if (!campaignFull) {
        return new Response(JSON.stringify({ error: "Campaign not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get IB name
      let ibName = "Un IB";
      if (completed_by_ib_id) {
        const { data: ibData } = await admin
          .from("ibs")
          .select("nombre_ib, alias")
          .eq("id", completed_by_ib_id)
          .single();
        if (ibData) ibName = ibData.alias || ibData.nombre_ib;
      }

      const recipientIds: string[] = [];
      if (campaignFull.created_by) recipientIds.push(campaignFull.created_by);
      if (campaignFull.notify_user_id && campaignFull.notify_user_id !== campaignFull.created_by) {
        recipientIds.push(campaignFull.notify_user_id);
      }

      let notified = 0;
      const title = `✅ Tarea completada: ${task_title || ""}`;
      const message = `${ibName} completó la tarea "${task_title || ""}" de la campaña "${campaign_name || campaignFull.name}".`;

      for (const userId of recipientIds) {
        await admin.from("notifications").insert({
          user_id: userId,
          type: "campaign_task_completed",
          title,
          message,
        });
        notified++;

        // Push notification
        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("subscription")
          .eq("user_id", userId);

        if (subs && subs.length > 0) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({ user_id: userId, title, message }),
            });
          } catch (e) {
            console.error("Push failed for", userId, e);
          }
        }

        // Email
        if (resendKey) {
          const { data: profile } = await admin.from("profiles").select("correo").eq("id", userId).single();
          if (profile?.correo) {
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${resendKey}`,
                },
                body: JSON.stringify({
                  from: "Bullfy IB System <noreply@bullfytech.online>",
                  to: [profile.correo],
                  subject: title,
                  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>
                    <div style="padding:24px;background:#ffffff;">
                      <h2 style="color:#062B63;">✅ Tarea Completada</h2>
                      <p><strong>${ibName}</strong> completó la tarea "<strong>${task_title || ""}</strong>" de la campaña "<strong>${campaign_name || campaignFull.name}</strong>".</p>
                      <a href="https://bullfyibsystem.lovable.app/marketing" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Seguimiento</a>
                    </div>
                    <div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div>
                  </div>`,
                }),
              });
            } catch (e) {
              console.error("Email failed for", profile.correo, e);
            }
          }
        }
      }

      return new Response(JSON.stringify({ notified }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regular campaign notifications (assignment, activated, stopped)
    const { data: campaign } = await admin
      .from("marketing_campaigns")
      .select("name, start_date, end_date")
      .eq("id", campaign_id)
      .single();

    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, correo, nombre, ib_id")
      .in("ib_id", ib_ids);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notified = 0;

    const isStop = type === "stopped";
    const isActivated = type === "activated";

    let notifTitle: string;
    let notifMessage: string;
    let emailSubject: string;
    let emailHtml: string;
    let notifType: string;

    if (isStop) {
      notifType = "campaign_stopped";
      notifTitle = `Campaña finalizada: ${campaign.name}`;
      notifMessage = `La campaña "${campaign.name}" ha sido detenida. Motivo: ${stop_reason || "Sin motivo especificado"}`;
      emailSubject = `🛑 Campaña Finalizada: ${campaign.name}`;
      emailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>
        <div style="padding:24px;background:#ffffff;">
          <h2 style="color:#062B63;">🛑 Campaña Finalizada</h2>
          <p>La campaña <strong>${campaign.name}</strong> ha sido detenida.</p>
          <div style="background:#FFF3CD;border:1px solid #FFEEBA;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;font-weight:bold;color:#856404;">Motivo:</p>
            <p style="margin:8px 0 0 0;color:#856404;">${stop_reason || "Sin motivo especificado"}</p>
          </div>
          <p style="color:#666;font-size:14px;">Gracias por tu participación. Mantente atento a próximas campañas.</p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div>
      </div>`;
    } else if (isActivated) {
      notifType = "campaign_activated";
      notifTitle = `🚀 Campaña activa: ${campaign.name}`;
      notifMessage = `La campaña "${campaign.name}" ha sido activada. Periodo: ${campaign.start_date} → ${campaign.end_date}. Revisa tus tareas en el Portal IB.`;
      emailSubject = `🚀 Campaña Activa: ${campaign.name}`;
      emailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>
        <div style="padding:24px;background:#ffffff;">
          <h2 style="color:#062B63;">🚀 Campaña Activada</h2>
          <p>La campaña <strong>${campaign.name}</strong> ha sido activada.</p>
          <p>Periodo: ${campaign.start_date} → ${campaign.end_date}</p>
          <a href="https://bullfyibsystem.lovable.app/ib-externo" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver mis Campañas</a>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div>
      </div>`;
    } else {
      notifType = "campaign_assignment";
      notifTitle = `Nueva campaña: ${campaign.name}`;
      notifMessage = `Se te asignó la campaña "${campaign.name}" (${campaign.start_date} → ${campaign.end_date}). Revisa tus tareas en el Portal IB.`;
      emailSubject = `📢 Nueva Campaña: ${campaign.name}`;
      emailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>
        <div style="padding:24px;background:#ffffff;">
          <h2 style="color:#062B63;">📢 Nueva Campaña Asignada</h2>
          <p>Se te asignó la campaña <strong>${campaign.name}</strong>.</p>
          <p>Fechas: ${campaign.start_date} → ${campaign.end_date}</p>
          <a href="https://bullfyibsystem.lovable.app/ib-externo" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver mis Campañas</a>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div>
      </div>`;
    }

    for (const profile of profiles) {
      // In-app notification
      await admin.from("notifications").insert({
        user_id: profile.id,
        type: notifType,
        title: notifTitle,
        message: notifMessage,
      });
      notified++;

      // Push notification
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", profile.id);

      if (subs && subs.length > 0) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              user_id: profile.id,
              title: notifTitle,
              message: notifMessage,
            }),
          });
        } catch (e) {
          console.error("Push failed for", profile.id, e);
        }
      }

      // Email via Resend
      if (resendKey && profile.correo) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "Bullfy IB System <noreply@bullfytech.online>",
              to: [profile.correo],
              subject: emailSubject,
              html: emailHtml,
            }),
          });
        } catch (e) {
          console.error("Email failed for", profile.correo, e);
        }
      }
    }

    return new Response(JSON.stringify({ notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
