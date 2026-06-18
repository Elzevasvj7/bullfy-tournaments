// ============================================================================
// Notificaciones transaccionales del portal (QA C7) — proveedor Resend.
// ----------------------------------------------------------------------------
// Helper compartido para enviar emails de eventos del portal (compra,
// inscripción, retiro, aprobación, expiración). Best-effort: NUNCA lanza ni
// bloquea el flujo principal; si Resend no está configurado, registra y sigue.
//
// Destinatarios:
//  - Usuario final: partner_users.email
//  - IB (dueño del portal): partner_portals → ibs.correo_ib
//
// Marca/branding: usa partner_portals.display_name en el encabezado y construye
// el enlace al portal respetando el dominio propio de los white-label.
// ============================================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "noreply@bullfytech.online";
const PUBLIC_BASE_URL = "https://bullfytech.online";

// Dominios propios de white-label (sincronizado con src/lib/portalRouting.ts).
const PORTAL_PRIMARY_DOMAIN: Record<string, string> = {
  "club-financiero": "clubfinanciero.pro",
};

export interface PortalInfo {
  id: string;
  display_name: string;
  nombre_portal: string;
  ib_email: string | null;
  from_email: string;   // remitente del portal (propio si está configurado, si no Bullfy)
}

/** Resuelve nombre + slug del portal y el email del IB dueño. */
export async function getPortalInfo(supabase: any, portalId: string): Promise<PortalInfo | null> {
  const { data } = await supabase
    .from("partner_portals")
    .select("id, display_name, nombre_portal, email_from_address, ibs:ib_id(correo_ib)")
    .eq("id", portalId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    display_name: data.display_name,
    nombre_portal: data.nombre_portal,
    ib_email: (data as any).ibs?.correo_ib ?? null,
    from_email: ((data as any).email_from_address || "").trim() || FROM_EMAIL,
  };
}

/** Email + nombre de un partner_user. */
async function getPartnerUser(supabase: any, partnerUserId: string): Promise<{ email: string; nombre: string } | null> {
  const { data } = await supabase
    .from("partner_users")
    .select("email, nombre")
    .eq("id", partnerUserId)
    .maybeSingle();
  return data ? { email: data.email, nombre: data.nombre } : null;
}

function portalUrl(slug: string): string {
  const dom = PORTAL_PRIMARY_DOMAIN[slug];
  return dom ? `https://${dom}` : `${PUBLIC_BASE_URL}/partner/${slug}`;
}

/** Envoltura HTML consistente con la marca del portal. */
function layout(portalName: string, title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const ctaHtml = cta
    ? `<div style="text-align:center;margin:26px 0;">
         <a href="${cta.url}" style="background:#146EF5;color:#ffffff;font-size:14px;border-radius:8px;padding:13px 26px;text-decoration:none;font-weight:bold;display:inline-block;">${cta.label}</a>
       </div>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#062B63;padding:22px;text-align:center;border-radius:8px 8px 0 0;">
      <h1 style="color:#83CBFF;margin:0;font-size:24px;letter-spacing:1px;">${portalName}</h1>
    </div>
    <div style="padding:28px 24px;border:1px solid #e0e0e0;border-top:none;">
      <h2 style="color:#062B63;font-size:20px;margin:0 0 16px;">${title}</h2>
      ${bodyHtml}
      ${ctaHtml}
    </div>
    <div style="text-align:center;padding:14px 24px;border-top:1px solid #e0e0e0;">
      <p style="color:#A0B1BD;font-size:11px;margin:0;">${portalName}</p>
    </div>
  </div>`;
}

const p = (text: string) => `<p style="color:#475569;font-size:14px;line-height:1.55;margin:0 0 12px;">${text}</p>`;

/** Envío de email — best-effort. Devuelve true si Resend aceptó. */
async function sendEmail(to: string | null | undefined, subject: string, html: string, fromName: string, fromEmail: string = FROM_EMAIL): Promise<boolean> {
  if (!to) return false;
  if (!RESEND_API_KEY) {
    console.warn("[notifications] RESEND_API_KEY ausente — email omitido:", subject);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject, html }),
    });
    if (!res.ok) console.error("[notifications] Resend error", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("[notifications] sendEmail excepción", e);
    return false;
  }
}

// ─── Notificadores de alto nivel (todos best-effort) ─────────────────────────

/** Compra confirmada → al usuario; aviso de venta → al IB. */
export async function notifyPurchaseConfirmed(
  supabase: any,
  opts: { portalId: string; partnerUserId: string; orderNumber: string | number; total: number; concept?: string },
): Promise<void> {
  try {
    const portal = await getPortalInfo(supabase, opts.portalId);
    if (!portal) return;
    const user = await getPartnerUser(supabase, opts.partnerUserId);
    const url = portalUrl(portal.nombre_portal);
    const totalFmt = `$${Number(opts.total).toFixed(2)}`;
    const concept = opts.concept || "tu compra";

    if (user) {
      await sendEmail(user.email, `Pago confirmado — ${portal.display_name}`,
        layout(portal.display_name, "¡Pago confirmado!",
          p(`Hola <strong>${user.nombre}</strong>,`) +
          p(`Confirmamos tu pago de <strong>${totalFmt}</strong> por ${concept}. Tu acceso ya está activo.`) +
          p(`Nº de orden: <strong>#${opts.orderNumber}</strong>`),
          { label: "Ir al portal", url }),
        portal.display_name, portal.from_email);
    }
    if (portal.ib_email) {
      await sendEmail(portal.ib_email, `Nueva venta (#${opts.orderNumber}) — ${portal.display_name}`,
        layout(portal.display_name, "Nueva venta",
          p(`Se confirmó una venta de <strong>${totalFmt}</strong>${user ? ` de <strong>${user.nombre}</strong> (${user.email})` : ""}.`) +
          p(`Nº de orden: <strong>#${opts.orderNumber}</strong>`)),
        portal.display_name, portal.from_email);
    }
  } catch (e) { console.error("[notifications] notifyPurchaseConfirmed", e); }
}

/** Inscripción a evento/clase → al usuario; aviso → al IB. */
export async function notifyRegistration(
  supabase: any,
  opts: { portalId: string; partnerUserId: string; kind: "evento" | "clase"; title: string; startsAt?: string | null },
): Promise<void> {
  try {
    const portal = await getPortalInfo(supabase, opts.portalId);
    if (!portal) return;
    const user = await getPartnerUser(supabase, opts.partnerUserId);
    const url = portalUrl(portal.nombre_portal);
    const when = opts.startsAt ? ` (${new Date(opts.startsAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })})` : "";

    if (user) {
      await sendEmail(user.email, `Inscripción confirmada — ${opts.title}`,
        layout(portal.display_name, "¡Inscripción confirmada!",
          p(`Hola <strong>${user.nombre}</strong>,`) +
          p(`Quedaste inscrito en el ${opts.kind} <strong>${opts.title}</strong>${when}.`),
          { label: "Ver detalles", url }),
        portal.display_name, portal.from_email);
    }
    if (portal.ib_email) {
      await sendEmail(portal.ib_email, `Nueva inscripción — ${opts.title}`,
        layout(portal.display_name, "Nueva inscripción",
          p(`${user ? `<strong>${user.nombre}</strong> (${user.email})` : "Un usuario"} se inscribió en el ${opts.kind} <strong>${opts.title}</strong>${when}.`)),
        portal.display_name, portal.from_email);
    }
  } catch (e) { console.error("[notifications] notifyRegistration", e); }
}

/** Retiro solicitado/procesado → al usuario. */
export async function notifyWithdrawal(
  supabase: any,
  opts: { portalId: string; partnerUserId: string; status: "solicitado" | "procesado" | "fallido"; amount: number },
): Promise<void> {
  try {
    const portal = await getPortalInfo(supabase, opts.portalId);
    if (!portal) return;
    const user = await getPartnerUser(supabase, opts.partnerUserId);
    if (!user) return;
    const amountFmt = `${Number(opts.amount).toFixed(2)} USDT`;
    const titles: Record<string, string> = {
      solicitado: "Retiro solicitado",
      procesado: "Retiro procesado",
      fallido: "Retiro no procesado",
    };
    const bodies: Record<string, string> = {
      solicitado: `Recibimos tu solicitud de retiro por <strong>${amountFmt}</strong>. Te avisaremos cuando se procese.`,
      procesado: `Tu retiro de <strong>${amountFmt}</strong> fue procesado correctamente.`,
      fallido: `Tu retiro de <strong>${amountFmt}</strong> no pudo procesarse y el saldo fue devuelto a tu wallet.`,
    };
    await sendEmail(user.email, `${titles[opts.status]} — ${portal.display_name}`,
      layout(portal.display_name, titles[opts.status],
        p(`Hola <strong>${user.nombre}</strong>,`) + p(bodies[opts.status])),
      portal.display_name);
  } catch (e) { console.error("[notifications] notifyWithdrawal", e); }
}

/** Usuario nuevo pendiente de aprobación → al IB. */
export async function notifyApprovalPending(
  supabase: any,
  opts: { portalId: string; userName: string; userEmail: string },
): Promise<void> {
  try {
    const portal = await getPortalInfo(supabase, opts.portalId);
    if (!portal || !portal.ib_email) return;
    const url = portalUrl(portal.nombre_portal);
    await sendEmail(portal.ib_email, `Usuario por aprobar — ${portal.display_name}`,
      layout(portal.display_name, "Nuevo usuario por aprobar",
        p(`<strong>${opts.userName}</strong> (${opts.userEmail}) se registró y está pendiente de tu aprobación.`),
        { label: "Revisar usuarios", url }),
      portal.display_name);
  } catch (e) { console.error("[notifications] notifyApprovalPending", e); }
}

/** Cuenta aprobada → al usuario. */
export async function notifyApprovalGranted(
  supabase: any,
  opts: { portalId: string; partnerUserId: string },
): Promise<void> {
  try {
    const portal = await getPortalInfo(supabase, opts.portalId);
    if (!portal) return;
    const user = await getPartnerUser(supabase, opts.partnerUserId);
    if (!user) return;
    const url = portalUrl(portal.nombre_portal);
    await sendEmail(user.email, `Cuenta aprobada — ${portal.display_name}`,
      layout(portal.display_name, "¡Tu cuenta fue aprobada!",
        p(`Hola <strong>${user.nombre}</strong>,`) +
        p(`Tu cuenta en <strong>${portal.display_name}</strong> ya está activa. Ya puedes ingresar.`),
        { label: "Ingresar al portal", url }),
      portal.display_name);
  } catch (e) { console.error("[notifications] notifyApprovalGranted", e); }
}

/** Suscripción por expirar → al usuario (usado por el cron). */
export async function notifySubscriptionExpiring(
  supabase: any,
  opts: { portalId: string; partnerUserId: string; expiresAt: string; daysLeft: number },
): Promise<void> {
  try {
    const portal = await getPortalInfo(supabase, opts.portalId);
    if (!portal) return;
    const user = await getPartnerUser(supabase, opts.partnerUserId);
    if (!user) return;
    const url = portalUrl(portal.nombre_portal);
    const when = new Date(opts.expiresAt).toLocaleDateString("es-CO", { dateStyle: "medium" } as any);
    await sendEmail(user.email, `Tu suscripción vence pronto — ${portal.display_name}`,
      layout(portal.display_name, "Tu suscripción está por vencer",
        p(`Hola <strong>${user.nombre}</strong>,`) +
        p(`Tu suscripción vence el <strong>${when}</strong> (en ${opts.daysLeft} día(s)). Renueva para no perder el acceso.`),
        { label: "Renovar ahora", url }),
      portal.display_name);
  } catch (e) { console.error("[notifications] notifySubscriptionExpiring", e); }
}
