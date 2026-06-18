import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, lead_id, lead_name, assigned_bd_id, previous_bd_id, performed_by, notas, status } = await req.json();

    // Get performer name
    let performerName = "Sistema";
    if (performed_by) {
      const { data: perf } = await supabaseAdmin.from("profiles").select("nombre").eq("id", performed_by).single();
      if (perf) performerName = perf.nombre;
    }

    // Get all admin_bd users
    const { data: adminBdRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin_bd");
    const adminBdIds = (adminBdRoles ?? []).map((r: any) => r.user_id);

    // Get all bd users
    const { data: bdRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["bd", "admin_bd"]);
    const allBdIds = [...new Set((bdRoles ?? []).map((r: any) => r.user_id))];

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const notifications: any[] = [];
    const emailTargets: { userId: string; subject: string; html: string }[] = [];

    const leadLabel = lead_name || "Lead sin nombre";

    const buildEmailHtml = (title: string, body: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>
        <div style="padding:24px;background:#ffffff;">
          <h2 style="color:#062B63;">${title}</h2>
          ${body}
          <a href="https://bullfyibsystem.lovable.app/experience-leads" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Leads</a>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System — Notificación automática</div>
      </div>`;

    if (action === "assigned") {
      // Get assigned BD name
      let bdName = "BD";
      if (assigned_bd_id) {
        const { data: bdProf } = await supabaseAdmin.from("profiles").select("nombre").eq("id", assigned_bd_id).single();
        if (bdProf) bdName = bdProf.nombre;
      }

      // Notify assigned BD (bell + email)
      if (assigned_bd_id) {
        notifications.push({
          user_id: assigned_bd_id,
          type: "experience_lead_assigned",
          title: "Lead asignado a ti",
          message: `Se te asignó el lead "${leadLabel}" por ${performerName}.`,
          reference_id: lead_id,
          reference_type: "experience_lead",
        });
        emailTargets.push({
          userId: assigned_bd_id,
          subject: `🎯 Lead asignado: ${leadLabel}`,
          html: buildEmailHtml("🎯 Lead Asignado", `<p>Se te ha asignado el lead <strong>${leadLabel}</strong> por <strong>${performerName}</strong>.</p><p>Revisa los detalles y da seguimiento.</p>`),
        });
      }

      // Notify previous BD if reassignment
      if (previous_bd_id && previous_bd_id !== assigned_bd_id) {
        notifications.push({
          user_id: previous_bd_id,
          type: "experience_lead_reassigned",
          title: "Lead reasignado",
          message: `El lead "${leadLabel}" fue reasignado a ${bdName} por ${performerName}.`,
          reference_id: lead_id,
          reference_type: "experience_lead",
        });
      }

      // Notify all admin_bd (bell + email)
      for (const adminId of adminBdIds) {
        if (adminId !== performed_by) {
          notifications.push({
            user_id: adminId,
            type: "experience_lead_assigned",
            title: "Lead asignado",
            message: `El lead "${leadLabel}" fue asignado a ${bdName} por ${performerName}.`,
            reference_id: lead_id,
            reference_type: "experience_lead",
          });
          emailTargets.push({
            userId: adminId,
            subject: `🎯 Lead asignado: ${leadLabel} → ${bdName}`,
            html: buildEmailHtml("🎯 Lead Asignado", `<p>El lead <strong>${leadLabel}</strong> fue asignado a <strong>${bdName}</strong> por <strong>${performerName}</strong>.</p>`),
          });
        }
      }
    } else if (action === "status_change") {
      const statusLabels: Record<string, string> = {
        nuevo: "Nuevo", contactado: "Contactado", calificado: "Calificado",
        en_negociacion: "En Negociación", convertido: "Convertido", descartado: "Descartado",
      };
      const statusLabel = statusLabels[status] || status;

      // Notify admin_bd always (bell + email)
      for (const adminId of adminBdIds) {
        notifications.push({
          user_id: adminId,
          type: status === "descartado" ? "experience_lead_discarded" : "experience_lead_status",
          title: status === "descartado" ? "Lead descartado" : "Cambio de status en lead",
          message: `El lead "${leadLabel}" cambió a "${statusLabel}" por ${performerName}.${notas ? ` Nota: ${notas}` : ""}`,
          reference_id: lead_id,
          reference_type: "experience_lead",
        });
        emailTargets.push({
          userId: adminId,
          subject: status === "descartado"
            ? `❌ Lead descartado: ${leadLabel}`
            : `📋 Lead "${leadLabel}" → ${statusLabel}`,
          html: buildEmailHtml(
            status === "descartado" ? "❌ Lead Descartado" : `📋 Cambio de Status`,
            `<p>El lead <strong>${leadLabel}</strong> cambió a <strong>${statusLabel}</strong> por <strong>${performerName}</strong>.</p>${notas ? `<p><em>Nota: ${notas}</em></p>` : ""}`
          ),
        });
      }

      // Notify assigned BD if not the performer
      if (assigned_bd_id && assigned_bd_id !== performed_by) {
        notifications.push({
          user_id: assigned_bd_id,
          type: "experience_lead_status",
          title: "Cambio de status en tu lead",
          message: `El lead "${leadLabel}" cambió a "${statusLabel}".`,
          reference_id: lead_id,
          reference_type: "experience_lead",
        });
      }
    } else if (action === "new_lead") {
      // Notify all BDs and admin_bds
      for (const bdId of allBdIds) {
        notifications.push({
          user_id: bdId,
          type: "experience_contact",
          title: "Nuevo lead desde IB Experience",
          message: `${leadLabel} ha completado el formulario de contacto.`,
          reference_id: lead_id,
          reference_type: "experience_lead",
        });
      }
      // Email only to admin_bd
      for (const adminId of adminBdIds) {
        emailTargets.push({
          userId: adminId,
          subject: `🎯 Nuevo Lead: ${leadLabel}`,
          html: buildEmailHtml("🎯 Nuevo Lead desde IB Experience", `<p>Un nuevo lead ha llegado: <strong>${leadLabel}</strong>.</p><p>Revisa los detalles y asígnalo a un Business Developer.</p>`),
        });
      }
    }

    // Insert bell notifications
    if (notifications.length > 0) {
      await supabaseAdmin.from("notifications").insert(notifications);
    }

    // Send emails
    if (RESEND_API_KEY && emailTargets.length > 0) {
      // Get emails for all target users
      const targetUserIds = [...new Set(emailTargets.map(e => e.userId))];
      const { data: profiles } = await supabaseAdmin.from("profiles").select("id, correo").in("id", targetUserIds);
      const emailMap: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { if (p.correo) emailMap[p.id] = p.correo; });

      for (const target of emailTargets) {
        const email = emailMap[target.userId];
        if (!email) continue;
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: "Bullfy IB System <noreply@bullfytech.online>",
              to: [email],
              subject: target.subject,
              html: target.html,
            }),
          });
        } catch (e) {
          console.error("Email send error:", e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
