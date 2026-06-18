// ============================================================================
// Dominios propios (white-label) que sirven UN portal partner en su raíz.
// ============================================================================
// Cada hostname aquí queda "amarrado" a un único slug de partner_portals: al
// cargar la app en ese dominio, solo se muestra ese portal (en la raíz, sin
// /partner/<slug> en la URL). El resto de la app (panel Bullfy, otros IBs) NO
// es accesible por ese dominio.
//
// bullfytech.online y *.lovable.app NO están aquí → funcionan como siempre.
//
// Mantener sincronizado con el bootstrap inline de index.html (que aplica el
// branding pre-paint usando el mismo mapeo hostname → slug).
export const CUSTOM_DOMAIN_PORTALS: Record<string, string> = {
  "clubfinanciero.pro": "club-financiero",
  "www.clubfinanciero.pro": "club-financiero",
};

/** Slug del portal atado al hostname actual, o null si es un dominio normal. */
export function getCustomDomainSlug(): string | null {
  if (typeof window === "undefined") return null;
  return CUSTOM_DOMAIN_PORTALS[window.location.hostname] ?? null;
}

// Dominio público (apex) por portal white-label, para construir enlaces
// EXTERNOS (ej. links de invitación a streams) que deben abrir en el dominio
// propio del IB, no en bullfytech.online.
const PORTAL_PRIMARY_DOMAIN: Record<string, string> = {
  "club-financiero": "clubfinanciero.pro",
};

/**
 * Origin público canónico de un portal para enlaces externos.
 *  - White-label (club-financiero) → "https://clubfinanciero.pro".
 *  - Resto → null (el caller usa window.location.origin / bullfytech.online).
 */
export function portalPublicOrigin(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const d = PORTAL_PRIMARY_DOMAIN[slug];
  return d ? `https://${d}` : null;
}

/**
 * Base path de las rutas de un portal.
 *  - En su dominio propio (clubfinanciero.pro) → "" (raíz limpia: /, /app, /admin…).
 *  - En bullfytech.online → "/partner/<slug>".
 * Úsalo para construir navegaciones y enlaces internos del portal.
 */
export function portalBasePath(slug: string): string {
  const custom = getCustomDomainSlug();
  if (custom && custom === slug) return "";
  return `/partner/${slug}`;
}
