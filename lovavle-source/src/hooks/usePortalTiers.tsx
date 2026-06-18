// Fuente ÚNICA de los niveles de un portal.
//
// Reemplaza los arreglos TIERS hardcodeados (general/vip/platino) que estaban
// repetidos en 6+ componentes. Los niveles ahora son propios de cada IB
// (tabla partner_tiers, por portal_id).
//
// RLS: el dueño del portal (autenticado) ve TODOS sus niveles (activos e
// inactivos); el público/cliente solo ve los activos. La misma query sirve para
// ambos contextos porque RLS filtra lo que cada quien puede ver.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PortalTier {
  id: string;
  portal_id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  is_default: boolean;
  active: boolean;
}

export function usePortalTiers(portalId: string | null | undefined) {
  const [tiers, setTiers] = useState<PortalTier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTiers = useCallback(async () => {
    if (!portalId) { setTiers([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase.from as any)("partner_tiers")
      .select("id, portal_id, slug, name, description, color, sort_order, is_default, active")
      .eq("portal_id", portalId)
      .order("sort_order", { ascending: true });
    setTiers((data as PortalTier[]) || []);
    setLoading(false);
  }, [portalId]);

  useEffect(() => { fetchTiers(); }, [fetchTiers]);

  // Etiqueta visible para un slug. Fallback legible para slugs legacy/desconocidos.
  const labelFor = useCallback(
    (slug: string | null | undefined): string => {
      if (!slug) return "—";
      const t = tiers.find(x => x.slug === slug);
      if (t) return t.name;
      return slug.charAt(0).toUpperCase() + slug.slice(1);
    },
    [tiers],
  );

  return { tiers, loading, refetch: fetchTiers, labelFor };
}
