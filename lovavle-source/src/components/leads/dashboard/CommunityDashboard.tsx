import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CommunityCard from "./CommunityCard";
import CommunityWorkspace from "./CommunityWorkspace";
import { Input } from "@/components/ui/input";
import { Search, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PortalRow {
  id: string;
  display_name: string | null;
  nombre_portal: string;
  status: string | null;
}

interface LeadRow {
  id: string;
  partner_portal_id: string | null;
  pipeline_stage_id: string | null;
  assigned_to: string | null;
}

const CommunityDashboard = () => {
  const { user, roles } = useAuth();
  const isVentas = roles.includes("ventas") && !roles.includes("admin_ventas") && !roles.includes("admin") && !roles.includes("global_admin");
  const [search, setSearch] = useState("");
  const [selectedPortal, setSelectedPortal] = useState<PortalRow | null>(null);

  // 1) Portales activos (visibles para admins; el closer ve TODOS pero solo entra a las suyas)
  const { data: portals = [], isLoading: loadingPortals } = useQuery({
    queryKey: ["lead-system-portals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_portals")
        .select("id, display_name, nombre_portal, status")
        .order("display_name");
      if (error) throw error;
      return (data || []) as PortalRow[];
    },
    staleTime: 60_000,
  });

  // 2) Asignaciones del cerrador (vacío para admins → todas asignadas implícitamente)
  const { data: myAssignments = [] } = useQuery({
    queryKey: ["my-community-assignments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("closer_community_assignments")
        .select("portal_id")
        .eq("closer_user_id", user.id);
      if (error) throw error;
      return (data || []).map((r) => r.portal_id as string);
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // 3) Métricas: count por portal y estado. Aprovecha RLS: el closer solo recibe leads de sus comunidades.
  const { data: leadCounts = [] } = useQuery({
    queryKey: ["lead-counts-by-portal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stream_leads")
        .select("id, partner_portal_id, pipeline_stage_id, assigned_to")
        .not("partner_portal_id", "is", null)
        .limit(5000);
      if (error) throw error;
      return (data || []) as LeadRow[];
    },
    staleTime: 30_000,
  });

  // 4) Stages — para clasificar nuevo/pendiente/seguimiento/cerrado
  const { data: stages = [] } = useQuery({
    queryKey: ["lead-pipeline-stages-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_pipeline_stages")
        .select("id, slug, display_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const metricsByPortal = useMemo(() => {
    const stageBySlug = new Map<string, string>();
    stages.forEach((s: any) => stageBySlug.set(s.slug, s.id));

    const nuevoIds = new Set([stageBySlug.get("nuevo"), stageBySlug.get("new")].filter(Boolean) as string[]);
    const segIds = new Set(
      [stageBySlug.get("seguimiento"), stageBySlug.get("followup"), stageBySlug.get("follow_up")].filter(Boolean) as string[],
    );
    const cerradoIds = new Set(
      [stageBySlug.get("ganado"), stageBySlug.get("won"), stageBySlug.get("closed")].filter(Boolean) as string[],
    );

    const map = new Map<string, { nuevos: number; pendientes: number; seguimiento: number; cerrados: number }>();
    for (const lead of leadCounts) {
      if (!lead.partner_portal_id) continue;
      const cur = map.get(lead.partner_portal_id) || { nuevos: 0, pendientes: 0, seguimiento: 0, cerrados: 0 };
      if (!lead.assigned_to) cur.pendientes++;
      if (lead.pipeline_stage_id && nuevoIds.has(lead.pipeline_stage_id)) cur.nuevos++;
      if (lead.pipeline_stage_id && segIds.has(lead.pipeline_stage_id)) cur.seguimiento++;
      if (lead.pipeline_stage_id && cerradoIds.has(lead.pipeline_stage_id)) cur.cerrados++;
      map.set(lead.partner_portal_id, cur);
    }
    return map;
  }, [leadCounts, stages]);

  const assignedSet = useMemo(() => new Set(myAssignments), [myAssignments]);

  const visiblePortals = useMemo(() => {
    const term = search.toLowerCase();
    return portals
      .filter((p) => {
        if (!term) return true;
        const name = (p.display_name || p.nombre_portal || "").toLowerCase();
        return name.includes(term);
      })
      // Para admin_ventas + admin: mostrar todas. Para ventas puro: las suyas primero
      .sort((a, b) => {
        if (isVentas) {
          const aA = assignedSet.has(a.id) ? 0 : 1;
          const bA = assignedSet.has(b.id) ? 0 : 1;
          if (aA !== bA) return aA - bA;
        }
        return (a.display_name || a.nombre_portal).localeCompare(b.display_name || b.nombre_portal);
      });
  }, [portals, search, assignedSet, isVentas]);

  if (selectedPortal) {
    return (
      <CommunityWorkspace
        portal={selectedPortal}
        onBack={() => setSelectedPortal(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Comunidades / Streamers</h3>
            <p className="text-xs text-muted-foreground">
              {isVentas
                ? "Estas son tus comunidades asignadas. Las no asignadas se muestran solo como referencia."
                : "Selecciona una comunidad para abrir su workspace y gestionar sus leads."}
            </p>
          </div>
        </div>
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar comunidad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loadingPortals ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : visiblePortals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No hay comunidades.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {visiblePortals.map((p) => {
            const m = metricsByPortal.get(p.id) || { nuevos: 0, pendientes: 0, seguimiento: 0, cerrados: 0 };
            const total = m.nuevos + m.pendientes + m.seguimiento + m.cerrados;
            const conv = total > 0 ? Math.round((m.cerrados / total) * 100) : 0;
            const assigned = !isVentas || assignedSet.has(p.id);
            return (
              <CommunityCard
                key={p.id}
                portal={p}
                metrics={{ ...m, conversion: conv }}
                assigned={assigned}
                onOpen={() => setSelectedPortal(p)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommunityDashboard;
