import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PortalBranding {
  primary_color: string;
  accent_color: string;
  card_color: string | null;
  logo_url: string | null;
  login_bg_image_url: string | null;
  login_bg_color: string;
  display_name_override: string | null;
}

const DEFAULT_BRANDING: PortalBranding = {
  primary_color: "#146EF5",
  accent_color: "#83CBFF",
  card_color: null,
  logo_url: null,
  login_bg_image_url: null,
  login_bg_color: "#062B63",
  display_name_override: null,
};

// ────────────────────────────────────────────────────────────────────────────
// Cache local del branding por portalId — elimina FOUC en visitas repetidas.
//
// Problema original: la primera renderización siempre arrancaba con
// DEFAULT_BRANDING (azul Bullfy) y recién después de un fetch async a
// Supabase aplicaba los colores reales del portal. Eso producía 2-3 frames
// de paint visibles para el usuario (clásico FOUC).
//
// Estrategia: stale-while-revalidate por portalId vía localStorage.
//  - Al guardar branding en localStorage en cada fetch exitoso.
//  - En el siguiente mount, usar la lectura sincrónica del cache como
//    valor inicial del useState → el primer paint ya tiene los colores
//    correctos del portal.
//  - El fetch a Supabase sigue ocurriendo en background y revalida; si
//    el IB cambió el branding desde la admin UI, el estado se actualiza
//    a los ~300ms (revalidate) y los nuevos colores se aplican.
//
// Solo elimina FOUC en visitas REPETIDAS. La primera visita histórica
// de cada portalId todavía muestra DEFAULT_BRANDING durante el fetch
// inicial, pero solo una vez por browser; luego queda cacheado para
// siempre (salvo borrado manual del localStorage).
//
// Versionado del cache: cualquier cambio incompatible en `PortalBranding`
// debe bumpear LS_VERSION para invalidar entradas viejas.
// ────────────────────────────────────────────────────────────────────────────
const LS_VERSION = 1;
const LS_PREFIX = `bullfy-portal-branding-v${LS_VERSION}-`;

function readCachedBranding(portalId: string | undefined): PortalBranding | null {
  if (typeof window === "undefined" || !portalId) return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + portalId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Sanity check mínimo: si el shape no tiene primary_color string, lo descartamos.
    if (!parsed || typeof parsed.primary_color !== "string") return null;
    return parsed as PortalBranding;
  } catch {
    return null;
  }
}

function writeCachedBranding(portalId: string | undefined, branding: PortalBranding): void {
  if (typeof window === "undefined" || !portalId) return;
  try {
    window.localStorage.setItem(LS_PREFIX + portalId, JSON.stringify(branding));
  } catch {
    // Ignorar errores de quota / private browsing / etc.
  }
}

export function hexToHSL(hex: string): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Returns a darker variant of a hex color (factor 0.7 = ~30% less intensity). */
export function dimHex(hex: string, factor = 0.7): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
  }
  r = Math.round(r * factor); g = Math.round(g * factor); b = Math.round(b * factor);
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Favicon por portal — SOLO para white-labels especiales (hoy club-financiero).
//
// El resto de IBs y sus usuarios conservan el favicon de Bullfy. Esto se gatea
// por slug a propósito: tener un logo propio (logo_url) NO implica favicon
// propio; solo los portales listados aquí lo reciben. Mismo criterio que el
// bootstrap de index.html y el bloque CSS scopeado para club-financiero.
//
// Al desmontar (o al cambiar de portal) se restauran los <link> originales,
// así un usuario que sale del portal del club vuelve a ver el favicon de Bullfy.
// ────────────────────────────────────────────────────────────────────────────
// Portales white-label "totales": ocultan TODA marca Bullfy (favicon, logo en
// el flujo de live, etc.). Centralizado aquí para usarlo en varios lugares.
export const WHITE_LABEL_SLUGS = new Set(["club-financiero"]);

export function isWhiteLabelPortal(slug: string | null | undefined): boolean {
  return !!slug && WHITE_LABEL_SLUGS.has(slug);
}

export function usePortalFavicon(slug: string | undefined, logoUrl: string | null) {
  useEffect(() => {
    if (!slug || !logoUrl || !WHITE_LABEL_SLUGS.has(slug)) return;
    if (typeof document === "undefined") return;

    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'),
    );
    if (links.length === 0) return;

    const prev = links.map((el) => ({ el, href: el.getAttribute("href") }));
    links.forEach((el) => el.setAttribute("href", logoUrl));

    return () => {
      prev.forEach(({ el, href }) => {
        if (href === null) el.removeAttribute("href");
        else el.setAttribute("href", href);
      });
    };
  }, [slug, logoUrl]);
}

export function usePortalBranding(portalId: string | undefined) {
  // Init lazy: si tenemos branding cacheado para este portalId, usarlo
  // como estado inicial para que el PRIMER paint ya tenga los colores
  // correctos. Si no hay cache (primera visita histórica), arrancamos
  // con DEFAULT_BRANDING y el fetch async lo reemplaza.
  const [branding, setBranding] = useState<PortalBranding>(
    () => readCachedBranding(portalId) ?? DEFAULT_BRANDING,
  );
  // Si ya teníamos cache al inicializar, no estamos "loading" desde la
  // perspectiva del UI (ya tenemos algo válido para mostrar). Igualmente
  // hacemos revalidate en background.
  const [loading, setLoading] = useState(() => readCachedBranding(portalId) === null);

  useEffect(() => {
    if (!portalId) {
      setBranding(DEFAULT_BRANDING);
      setLoading(false);
      return;
    }

    // Si el portalId cambió (navegación SPA entre portales), re-aplicar
    // optimísticamente desde cache antes del fetch.
    const cached = readCachedBranding(portalId);
    if (cached) {
      setBranding(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;

    const doFetch = async () => {
      const { data } = await supabase
        .from("partner_portal_branding")
        .select("*")
        .eq("portal_id", portalId)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        let logo_url: string | null = null;
        let login_bg_image_url: string | null = null;

        if (data.logo_path) {
          const { data: u } = supabase.storage.from("portal-branding").getPublicUrl(data.logo_path as string);
          logo_url = u.publicUrl;
        }
        if (data.login_bg_image_path) {
          const { data: u } = supabase.storage.from("portal-branding").getPublicUrl(data.login_bg_image_path as string);
          login_bg_image_url = u.publicUrl;
        }

        const next: PortalBranding = {
          primary_color: (data.primary_color as string) || DEFAULT_BRANDING.primary_color,
          accent_color: (data.accent_color as string) || DEFAULT_BRANDING.accent_color,
          card_color: ((data as any).card_color as string) || null,
          logo_url,
          login_bg_image_url,
          login_bg_color: (data.login_bg_color as string) || DEFAULT_BRANDING.login_bg_color,
          display_name_override: data.display_name_override as string | null,
        };

        setBranding(next);
        writeCachedBranding(portalId, next);
      }
      setLoading(false);
    };

    doFetch();

    return () => {
      cancelled = true;
    };
  }, [portalId]);

  return { branding, loading };
}

/**
 * Injects portal branding as CSS variables on <html>.
 * MUST be called ONLY at the layout root (PartnerAdminLayout, PartnerClientLayout,
 * PartnerLogin, PartnerResetPassword). Calling it from nested components causes
 * cleanup races that revert --primary to the default theme when the nested
 * component unmounts on section change.
 */
export function usePortalBrandingCss(branding: PortalBranding) {
  useEffect(() => {
    const root = document.documentElement;
    const primaryHSL = hexToHSL(branding.primary_color);
    const accentHSL = hexToHSL(branding.accent_color);

    root.style.setProperty("--primary", primaryHSL);
    root.style.setProperty("--primary-foreground", "0 0% 100%");
    root.style.setProperty("--accent", accentHSL);

    const skinCards = !!branding.card_color;
    const bgValue = branding.login_bg_color || "";
    const isGradient = /gradient\(/i.test(bgValue);
    if (skinCards) {
      const cardHSL = hexToHSL(branding.card_color as string);
      root.style.setProperty("--card", cardHSL);
      root.style.setProperty("--secondary", cardHSL);
      root.style.setProperty("--muted", cardHSL);
      if (isGradient) {
        root.style.setProperty("--background", "0 0% 9%");
        document.body.style.backgroundImage = bgValue;
        document.body.style.backgroundAttachment = "fixed";
      } else {
        const bgHSL = hexToHSL(bgValue);
        root.style.setProperty("--background", bgHSL);
      }
    }

    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--accent");
      if (skinCards) {
        root.style.removeProperty("--card");
        root.style.removeProperty("--secondary");
        root.style.removeProperty("--muted");
        root.style.removeProperty("--background");
        if (isGradient) {
          document.body.style.backgroundImage = "";
          document.body.style.backgroundAttachment = "";
        }
      }
    };
  }, [branding.primary_color, branding.accent_color, branding.login_bg_color, branding.card_color]);
}
