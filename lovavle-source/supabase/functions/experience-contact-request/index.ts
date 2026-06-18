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
    const { session_id, opportunity_score, level, tools_used, badges, nombre, correo, telefono, pais, empresa, tamano_comunidad, interes, comentario } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all BD users (bd + admin_bd) for bell notifications
    const { data: allBdUsers } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["bd", "admin_bd"]);

    const leadInfo = nombre
      ? `${nombre} (${correo || "sin correo"}, ${telefono || "sin tel"}, ${pais || "sin país"})`
      : `Session ${session_id}`;

    if (allBdUsers && allBdUsers.length > 0) {
      // Bell notifications to ALL BDs (bd + admin_bd)
      const notifications = allBdUsers.map((u: any) => ({
        user_id: u.user_id,
        type: "experience_contact",
        title: "Nuevo lead desde IB Experience",
        message: `${leadInfo} — Score ${opportunity_score || 0}/100 (${level || "Explorer"}). Herramientas: ${(tools_used || []).length}`,
        reference_id: session_id,
        reference_type: "experience_lead",
      }));

      await supabaseAdmin.from("notifications").insert(notifications);

      // Send email notifications ONLY to admin_bd users
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const adminBdUsers = allBdUsers.filter((u: any) => u.role === "admin_bd");
        
        if (adminBdUsers.length > 0) {
          const adminBdUserIds = adminBdUsers.map((u: any) => u.user_id);
          const { data: adminBdProfiles } = await supabaseAdmin
            .from("profiles")
            .select("correo")
            .in("id", adminBdUserIds);

          if (adminBdProfiles && adminBdProfiles.length > 0) {
            const adminBdEmails = adminBdProfiles.map((p: any) => p.correo).filter(Boolean);

            if (adminBdEmails.length > 0) {
              const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #062B63; padding: 20px; text-align: center;">
                    <h1 style="color: #83CBFF; margin: 0;">Bullfy IB System</h1>
                  </div>
                  <div style="padding: 24px; background: #ffffff;">
                    <h2 style="color: #062B63;">🎯 Nuevo Lead desde IB Experience</h2>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #062B63;">Nombre</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${nombre || "No proporcionado"}</td></tr>
                      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #062B63;">Correo</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${correo || "No proporcionado"}</td></tr>
                      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #062B63;">Teléfono</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${telefono || "No proporcionado"}</td></tr>
                      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #062B63;">País</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${pais || "No proporcionado"}</td></tr>
                      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #062B63;">Score</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${opportunity_score || 0}/100</td></tr>
                      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #062B63;">Nivel</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${level || "Explorer"}</td></tr>
                      <tr><td style="padding: 8px; font-weight: bold; color: #062B63;">Herramientas</td><td style="padding: 8px;">${(tools_used || []).length} usadas</td></tr>
                    </table>
                  </div>
                  <div style="background: #f5f5f5; padding: 16px; text-align: center; color: #666; font-size: 12px;">
                    Bullfy IB System — Notificación automática
                  </div>
                </div>
              `;

              try {
                const resendResponse = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                  },
                  body: JSON.stringify({
                    from: "Bullfy IB System <noreply@bullfytech.online>",
                    to: adminBdEmails,
                    subject: `🎯 Nuevo Lead: ${nombre || "Anónimo"} — Score ${opportunity_score || 0}/100`,
                    html: emailHtml,
                  }),
                });

                const resendData = await resendResponse.json();
                if (!resendResponse.ok) {
                  console.error("Resend email failed for experience lead", resendData);
                } else {
                  console.log("Experience lead email sent via Resend to admin_bd", { id: resendData.id });
                }
              } catch (emailError) {
                console.error("Failed to send experience lead email", emailError);
              }
            }
          }
        }
      }
    }

    // Update/create experience lead record
    const { data: existingLead } = await supabaseAdmin
      .from("experience_leads")
      .select("id")
      .eq("session_id", session_id)
      .maybeSingle();

    const leadData = {
      opportunity_score,
      level,
      tools_used,
      badges,
      status: "nuevo",
      nombre: nombre || null,
      correo: correo || null,
      telefono: telefono || null,
      pais: pais || null,
      empresa: empresa || null,
      tamano_comunidad: tamano_comunidad || null,
      interes: interes || null,
      comentario: comentario || null,
      updated_at: new Date().toISOString(),
    };

    let leadId: string;
    if (existingLead) {
      await supabaseAdmin
        .from("experience_leads")
        .update(leadData)
        .eq("id", existingLead.id);
      leadId = existingLead.id;
    } else {
      const { data: newLead } = await supabaseAdmin.from("experience_leads").insert({
        session_id,
        ...leadData,
      }).select("id").single();
      leadId = newLead?.id;

      // Trigger new lead notification via the dedicated edge function
      if (leadId) {
        try {
          const baseUrl = Deno.env.get("SUPABASE_URL")!;
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
          await fetch(`${baseUrl}/functions/v1/experience-lead-action`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              action: "new_lead",
              lead_id: leadId,
              lead_name: nombre || "Lead sin nombre",
            }),
          });
        } catch (e) {
          console.error("Failed to trigger new lead notification:", e);
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