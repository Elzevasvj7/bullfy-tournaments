// Resuelve la identidad de remitente de email para un portal.
//
// Si el portal tiene `email_from_address` configurado (dominio verificado en
// Resend), los correos salen desde esa dirección con su nombre y SIN marca
// Bullfy (white-label). Si no, se usa la marca/remitente Bullfy por defecto —
// el comportamiento actual para todos los portales que no lo hayan configurado.

const DEFAULT_FROM_NAME = "Bullfy";
const DEFAULT_FROM_EMAIL = "noreply@bullfytech.online";

export interface PortalEmailIdentity {
  fromName: string;
  fromEmail: string;
  from: string;        // "Nombre <email>" listo para Resend
  brandName: string;   // marca para asunto/cuerpo
  isWhiteLabel: boolean;
}

const FALLBACK: PortalEmailIdentity = {
  fromName: DEFAULT_FROM_NAME,
  fromEmail: DEFAULT_FROM_EMAIL,
  from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
  brandName: DEFAULT_FROM_NAME,
  isWhiteLabel: false,
};

export async function getPortalEmailIdentity(
  supabase: any,
  portalId: string | null | undefined,
): Promise<PortalEmailIdentity> {
  if (!portalId) return FALLBACK;
  try {
    const { data } = await supabase
      .from("partner_portals")
      .select("display_name, email_from_name, email_from_address")
      .eq("id", portalId)
      .maybeSingle();
    if (!data) return FALLBACK;

    const addr = (data.email_from_address || "").trim();
    if (!addr) return FALLBACK; // sin dominio propio → marca Bullfy por defecto

    const name = (data.email_from_name || data.display_name || DEFAULT_FROM_NAME).trim();
    return {
      fromName: name,
      fromEmail: addr,
      from: `${name} <${addr}>`,
      brandName: name,
      isWhiteLabel: true,
    };
  } catch {
    return FALLBACK;
  }
}
