import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashPassword } from "../_shared/partner-password.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBLIC_BASE_URL = "https://bullfytech.online";

function buildWelcomeHtml(opts: {
  nombre: string;
  portalName: string;
  portalUrl: string;
  email: string;
}) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#062B63;padding:24px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#83CBFF;font-size:22px;letter-spacing:1px;">${opts.portalName}</h1>
      </div>
      <div style="background:#ffffff;padding:28px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
        <h2 style="margin:0 0 12px;color:#062B63;font-size:20px;">¡Bienvenido, ${opts.nombre}!</h2>
        <p style="font-size:15px;line-height:1.55;color:#334155;margin:0 0 16px;">
          Tu cuenta en <b>${opts.portalName}</b> ha quedado activa. Desde aquí podrás acceder a los streams en vivo,
          academia, productos y todo el contenido exclusivo del portal.
        </p>
        <p style="font-size:14px;color:#475569;margin:0 0 20px;">
          <b>Correo de acceso:</b> ${opts.email}<br/>
          <b>Contraseña:</b> la que acabas de configurar
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${opts.portalUrl}" style="background:#146EF5;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
            Acceder al portal
          </a>
        </div>
        <p style="font-size:13px;color:#64748b;margin:24px 0 0;">
          Guarda este enlace: <a href="${opts.portalUrl}" style="color:#146EF5;">${opts.portalUrl}</a><br/>
          ¿Olvidaste tu contraseña? Úsa la opción "¿Olvidaste tu contraseña?" en esa misma página.
        </p>
      </div>
      <p style="text-align:center;font-size:11px;color:#94a3b8;margin:16px 0 0;">© Bullfy Tech</p>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nombre, correo, telefono, room_id, room_title, portal_id, invite_code, password } = await req.json();

    if (!nombre || !correo || !room_id) {
      return new Response(
        JSON.stringify({ error: "nombre, correo, and room_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get default pipeline stage
    const { data: stageData } = await supabaseAdmin
      .from("lead_pipeline_stages")
      .select("id")
      .eq("is_default", true)
      .limit(1)
      .single();

    const defaultStageId = stageData?.id || null;

    // If portal_id is provided, fetch the portal's info (referral + slug + name)
    let portalReferralLink: string | null = null;
    let portalSlug: string | null = null;
    let portalDisplayName: string | null = null;
    if (portal_id) {
      const { data: portalData } = await supabaseAdmin
        .from("partner_portals")
        .select("bullfy_referral_link, nombre_portal, display_name")
        .eq("id", portal_id)
        .maybeSingle();
      portalReferralLink = (portalData?.bullfy_referral_link as string | null) || null;
      portalSlug = (portalData?.nombre_portal as string | null) || null;
      portalDisplayName = (portalData?.display_name as string | null) || portalSlug;
    }

    // Upsert lead by correo + source to avoid duplicates
    const emailNorm = correo.trim().toLowerCase();
    const { data: existingLead } = await supabaseAdmin
      .from("stream_leads")
      .select("id, stream_count, opportunity_score, partner_portal_id, bullfy_referral_link")
      .eq("correo", emailNorm)
      .maybeSingle();

    let leadId: string;

    if (existingLead) {
      const newCount = (existingLead.stream_count || 0) + 1;
      const newScore = Math.min(100, (existingLead.opportunity_score || 0) + 5);

      const updatePayload: Record<string, unknown> = {
        stream_count: newCount,
        opportunity_score: newScore,
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
      };
      if (portal_id) {
        updatePayload.partner_portal_id = portal_id;
        if (portalReferralLink) {
          updatePayload.bullfy_referral_link = portalReferralLink;
        }
      }

      const { error: updateErr } = await supabaseAdmin
        .from("stream_leads")
        .update(updatePayload)
        .eq("id", existingLead.id);

      if (updateErr) console.error("Error updating lead:", updateErr);
      leadId = existingLead.id;
    } else {
      const { data: newLead, error: insertErr } = await supabaseAdmin
        .from("stream_leads")
        .insert({
          nombre: nombre.trim(),
          correo: emailNorm,
          telefono: telefono?.trim() || null,
          source: "live_stream",
          partner_portal_id: portal_id || null,
          bullfy_referral_link: portalReferralLink,
          pipeline_stage_id: defaultStageId,
          opportunity_score: 20,
          stream_count: 1,
          notes: `Stream en vivo: "${room_title || ""}" | Código: ${invite_code || "N/A"}`,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("Error creating lead:", insertErr);
        return new Response(
          JSON.stringify({ error: "Failed to create lead", details: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      leadId = newLead!.id;
    }

    // Partner user logic (GLOBAL email uniqueness across portals)
    let partnerUserId: string | null = null;
    let crossPortalExisting: { portal_name: string; portal_url: string } | null = null;
    let welcomeEmailSent = false;

    if (portal_id) {
      // Look up partner_user by email GLOBALLY (not scoped to this portal)
      const { data: existingPartnerUser } = await supabaseAdmin
        .from("partner_users")
        .select("id, password_hash, status, portal_id")
        .ilike("email", emailNorm)
        .maybeSingle();

      if (existingPartnerUser && existingPartnerUser.portal_id !== portal_id) {
        // CROSS-PORTAL CONFLICT: account belongs to another portal
        const { data: ownerPortal } = await supabaseAdmin
          .from("partner_portals")
          .select("nombre_portal, display_name")
          .eq("id", existingPartnerUser.portal_id)
          .maybeSingle();
        const ownerSlug = ownerPortal?.nombre_portal || "";
        crossPortalExisting = {
          portal_name: ownerPortal?.display_name || ownerSlug || "otro portal",
          portal_url: ownerSlug ? `${PUBLIC_BASE_URL}/portal/${ownerSlug}` : PUBLIC_BASE_URL,
        };
        console.log(`Cross-portal block: ${emailNorm} already belongs to portal ${existingPartnerUser.portal_id}`);
      } else if (existingPartnerUser) {
        // Same portal — update password / status as before
        partnerUserId = existingPartnerUser.id;
        const updates: Record<string, unknown> = {};
        if (existingPartnerUser.status !== "approved") updates.status = "approved";
        if (!existingPartnerUser.password_hash && password && typeof password === "string" && password.length >= 8) {
          updates.password_hash = await hashPassword(password);
        }
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin.from("partner_users").update(updates).eq("id", existingPartnerUser.id);
        }
      } else {
        // New partner_user
        const insertData: Record<string, unknown> = {
          portal_id,
          email: emailNorm,
          nombre: nombre.trim(),
          telefono: telefono?.trim() || null,
          status: "approved",
          tier: "general",
        };
        if (password && typeof password === "string" && password.length >= 8) {
          insertData.password_hash = await hashPassword(password);
        } else {
          // Sin contraseña elegida: valor aleatorio de alta entropía (no es
          // un credential usable; el usuario deberá usar "olvidé mi contraseña").
          insertData.password_hash = await hashPassword(crypto.randomUUID() + crypto.randomUUID());
        }

        const { data: created, error: puErr } = await supabaseAdmin
          .from("partner_users")
          .insert(insertData)
          .select("id")
          .single();

        if (puErr) {
          console.error("Error creating partner_user:", puErr);
        } else {
          partnerUserId = created?.id ?? null;
          console.log(`Created partner_user: ${emailNorm} for portal ${portal_id}`);

          // Send welcome email (best-effort, non-blocking on failure)
          if (portalSlug && portalDisplayName) {
            try {
              const portalUrl = `${PUBLIC_BASE_URL}/portal/${portalSlug}`;
              const html = buildWelcomeHtml({
                nombre: nombre.trim(),
                portalName: portalDisplayName,
                portalUrl,
                email: emailNorm,
              });
              const { error: mailErr } = await supabaseAdmin.functions.invoke("send-transactional-email", {
                body: {
                  to: emailNorm,
                  subject: `Bienvenido a ${portalDisplayName}`,
                  html,
                },
              });
              if (mailErr) console.error("Welcome email error:", mailErr);
              else welcomeEmailSent = true;
            } catch (e) {
              console.error("Welcome email exception:", e);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        lead_id: leadId,
        partner_user_id: partnerUserId,
        cross_portal_existing: crossPortalExisting,
        welcome_email_sent: welcomeEmailSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("register-stream-guest error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
