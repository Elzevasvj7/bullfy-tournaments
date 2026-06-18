// White-label de marca por portal.
//
// Algunos portales (ver WHITE_LABEL_SLUGS en usePortalBranding) deben ocultar
// TODA la marca "Bullfy" a sus usuarios y a su propio IB. En vez de esparcir
// condicionales por todo el árbol, los layouts (PartnerClientLayout /
// PartnerAdminLayout) proveen `isWhiteLabel` por contexto y los componentes
// envuelven los textos visibles con `brandText(...)`.
//
// IMPORTANTE: brandText solo debe aplicarse a TEXTO visible de marca. NO usarlo
// sobre valores funcionales (p. ej. el nombre real del servidor MT5
// "Bullfy-Trade", que el usuario necesita para conectar y no debe cambiar).

import { createContext, useContext } from "react";

interface PortalBrandValue {
  isWhiteLabel: boolean;
}

const PortalBrandContext = createContext<PortalBrandValue>({ isWhiteLabel: false });

export const PortalBrandProvider = PortalBrandContext.Provider;

export function usePortalBrand(): PortalBrandValue {
  return useContext(PortalBrandContext);
}

/** Quita la marca "Bullfy" de un texto y limpia espacios/paréntesis vacíos. */
export function stripBullfy(text: string): string {
  return text
    .replace(/\s*\(\s*Bullfy\s*\)/gi, "") // "(Bullfy)" → ""
    .replace(/Bullfy[\s-]*/gi, "")          // "Bullfy " / "Bullfy-" → ""
    .replace(/\(\s*\)/g, "")                // paréntesis que quedaron vacíos
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Devuelve el texto con o sin marca Bullfy según el portal sea white-label. */
export function brandText(isWhiteLabel: boolean, text: string): string {
  return isWhiteLabel ? stripBullfy(text) : text;
}
