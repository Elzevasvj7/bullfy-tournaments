import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/lib/toastUtils";
import { Search, Eye, ArrowRightLeft, History, FileText, ScrollText, BarChart3, Pencil, Mail, DollarSign, GitBranch, Radio, Copy, ExternalLink, TrendingUp, Video, Shield, ShoppingCart } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import IBEditDialog from "./IBEditDialog";
import IBLiveFeaturePermissions from "./IBLiveFeaturePermissions";
import { generateLineageReportPDF } from "@/services/generateLineageReport";

interface IBItem {
  id: string;
  nombre_ib: string;
  correo_ib: string;
  nombre_bd: string;
  modelo_negocio: string;
  tipo_acuerdo_brokeraje: string | null;
  lugar_operacion: string;
  status: string;
  created_at: string;
  created_by: string | null;
  tipo_id: string;
  id_ib: string;
  tipo_persona: string;
  representante_legal: string | null;
  tipo_id_representante: string | null;
  id_representante: string | null;
  direccion_empresa: string | null;
  contacto_corporativo: string | null;
  negociaciones_especiales: string | null;
  comision_dolares_por_lote: number | null;
  tiene_comision_por_lote: boolean | null;
}

interface BDHistory {
  id: string;
  bd_anterior_nombre: string;
  bd_nuevo_nombre: string;
  created_at: string;
}

interface UpdateReport {
  id: string;
  report_type: string;
  report_number: string;
  created_at: string;
  modelo_negocio?: string;
  tipo_acuerdo?: string | null;
}

interface UpdateGroup {
  date: string;
  modelo_negocio?: string;
  tipo_acuerdo?: string | null;
  reports: UpdateReport[];
}

interface LineageNode {
  nombre: string;
  label: string; // e.g. "IB Principal (Master IB1)", "Master IB2", "Sub IB"
  dolares_por_lote: number | null;
}

interface AgreementConditions {
  spread_config: { symbol: string; dolares_ib_original: number; nuevo_dolar_ib: number | null }[];
  cpa_config: { rango_deposito: string; cpa_pagar: number }[];
  hybrid_config: { rango_deposito: string; cpa_pagar: number; dolares_por_lote: number }[];
  propfirm_config: { rango_ventas: string; porcentaje_comision: number }[];
  sub_ib_lote?: number | null;
  lineage?: LineageNode[];
}

const IBMaintenance = () => {
  const { user, isAdmin, isGlobalAdmin, isBD } = useAuth();
  const [ibs, setIbs] = useState<IBItem[]>([]);
  const [subIbs, setSubIbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailIB, setDetailIB] = useState<IBItem | null>(null);
  const [bdHistory, setBdHistory] = useState<BDHistory[]>([]);
  const [updateGroups, setUpdateGroups] = useState<UpdateGroup[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editIB, setEditIB] = useState<IBItem | null>(null);
  const [invitingIB, setInvitingIB] = useState<string | null>(null);
  const [conditions, setConditions] = useState<AgreementConditions | null>(null);
  const [invitedIbIds, setInvitedIbIds] = useState<Set<string>>(new Set());
  const [partnerIbIds, setPartnerIbIds] = useState<Set<string>>(new Set());
  const [partnerSlugs, setPartnerSlugs] = useState<Record<string, string>>({});
  const [tickersEnabled, setTickersEnabled] = useState<Record<string, boolean>>({});
  const [videoStudioEnabled, setVideoStudioEnabled] = useState<Record<string, boolean>>({});
  const [tierStreamsEnabled, setTierStreamsEnabled] = useState<Record<string, boolean>>({});
  const [commerceEnabled, setCommerceEnabled] = useState<Record<string, boolean>>({});
  const [platformFee, setPlatformFee] = useState<Record<string, number>>({});
  const [tradingRoomOverrides, setTradingRoomOverrides] = useState<Record<string, boolean>>({});
  const [livePermsTarget, setLivePermsTarget] = useState<{ userId: string; ibName: string } | null>(null);
  const [ibUserMap, setIbUserMap] = useState<Record<string, string>>({});

  const fetchIBs = async () => {
    setLoading(true);
    const [ibRes, subRes, profilesRes, portalsRes, commerceRes, ibUserRes, tradingOverrideRes] = await Promise.all([
      supabase
        .from("ibs")
        .select("id, nombre_ib, correo_ib, nombre_bd, modelo_negocio, tipo_acuerdo_brokeraje, lugar_operacion, status, created_at, created_by, tipo_id, id_ib, tipo_persona, representante_legal, tipo_id_representante, id_representante, direccion_empresa, contacto_corporativo, negociaciones_especiales, comision_dolares_por_lote, tiene_comision_por_lote")
        .order("created_at", { ascending: false }) as any,
      supabase
        .from("sub_ibs")
        .select("id, ib_id, nombre, correo, tipo_id, id_documento, dolares_por_lote, es_master_ib, master_ib_numero, parent_sub_ib_id, created_at")
        .order("created_at", { ascending: false }) as any,
      supabase
        .from("profiles")
        .select("ib_id, sub_ib_id")
        .not("ib_id", "is", null) as any,
      supabase
        .from("partner_portals")
        .select("ib_id, sub_ib_id, nombre_portal, tickers_enabled, video_studio_enabled, tier_streams_enabled, platform_fee_percentage") as any,
      supabase
        .from("portal_commerce_access")
        .select("ib_id, enabled") as any,
      supabase
        .from("profiles")
        .select("id, ib_id, sub_ib_id")
        .or("ib_id.not.is.null,sub_ib_id.not.is.null") as any,
      supabase
        .from("trading_room_ib_overrides")
        .select("ib_id, enabled") as any,
    ]);

    if (ibRes.error) {
      toast.error("Error al cargar IBs");
    } else {
      setIbs(ibRes.data ?? []);
    }
    setSubIbs(subRes.data ?? []);

    // Build sets of IB/Sub-IB ids that have been invited or have partner portals
    const invited = new Set<string>();
    (profilesRes.data ?? []).forEach((p: any) => {
      if (p.ib_id) invited.add(p.ib_id);
      if (p.sub_ib_id) invited.add(p.sub_ib_id);
    });
    setInvitedIbIds(invited);

    const partners = new Set<string>();
    const slugs: Record<string, string> = {};
    const tickers: Record<string, boolean> = {};
    const videoStudio: Record<string, boolean> = {};
    const tierStreams: Record<string, boolean> = {};
    const fees: Record<string, number> = {};
    (portalsRes.data ?? []).forEach((p: any) => {
      const key = p.sub_ib_id || p.ib_id;
      if (key) {
        partners.add(key);
        slugs[key] = p.nombre_portal;
        tickers[key] = !!p.tickers_enabled;
        videoStudio[key] = !!p.video_studio_enabled;
        tierStreams[key] = !!p.tier_streams_enabled;
        fees[key] = Number(p.platform_fee_percentage) || 0;
      }
    });
    setPartnerIbIds(partners);
    setPartnerSlugs(slugs);
    setTickersEnabled(tickers);
    setVideoStudioEnabled(videoStudio);
    setTierStreamsEnabled(tierStreams);
    setPlatformFee(fees);

    const commerce: Record<string, boolean> = {};
    (commerceRes.data ?? []).forEach((c: any) => {
      if (c.ib_id) commerce[c.ib_id] = !!c.enabled;
    });
    setCommerceEnabled(commerce);

    const tradingOverrides: Record<string, boolean> = {};
    (tradingOverrideRes.data ?? []).forEach((row: any) => {
      if (row.ib_id) tradingOverrides[row.ib_id] = !!row.enabled;
    });
    setTradingRoomOverrides(tradingOverrides);

    // Build IB/Sub-IB id -> user_id map for live feature permissions
    const userMap: Record<string, string> = {};
    (ibUserRes.data ?? []).forEach((p: any) => {
      if (p.ib_id) userMap[p.ib_id] = p.id;
      if (p.sub_ib_id) userMap[p.sub_ib_id] = p.id;
    });
    setIbUserMap(userMap);

    setLoading(false);
  };

  useEffect(() => {
    fetchIBs();
  }, []);

  const openDetail = async (ib: IBItem) => {
    setDetailIB(ib);
    setLoadingHistory(true);
    setConditions(null);

    const isSubIb = (ib as any)._isSubIb;
    const parentIbId = isSubIb
      ? subIbs.find(s => s.id === (ib as any)._realSubIbId)?.ib_id
      : ib.id;
    const lookupId = parentIbId || ib.id;

    // Fetch BD history, reports, and conditions in parallel
    const [historyRes, reportsRes, spreadRes, cpaRes, hybridRes, propfirmRes] = await Promise.all([
      supabase
        .from("ib_bd_history")
        .select("id, bd_anterior_nombre, bd_nuevo_nombre, created_at")
        .eq("ib_id", lookupId)
        .order("created_at", { ascending: false }),
      supabase
        .from("reports")
        .select("id, report_type, report_number, data, created_at")
        .eq("ib_id", lookupId)
        .order("created_at", { ascending: false }),
      supabase
        .from("ib_spread_config")
        .select("symbol, dolares_ib_original, nuevo_dolar_ib")
        .eq("ib_id", lookupId),
      supabase
        .from("ib_cpa_config")
        .select("rango_deposito, cpa_pagar")
        .eq("ib_id", lookupId),
      supabase
        .from("ib_hybrid_config")
        .select("rango_deposito, cpa_pagar, dolares_por_lote")
        .eq("ib_id", lookupId),
      supabase
        .from("ib_propfirm_config")
        .select("rango_ventas, porcentaje_comision")
        .eq("ib_id", lookupId),
    ]);

    // Build lineage for Sub IBs
    let lineage: LineageNode[] | undefined;
    const isSubIbDetail = (ib as any)._isSubIb;
    const realSubIbId = (ib as any)._realSubIbId;

    if (isSubIbDetail && realSubIbId) {
      // Walk up the parent_sub_ib_id chain to build the lineage
      const chain: LineageNode[] = [];
      const allSubsForIb = subIbs.filter(s => s.ib_id === lookupId);
      
      // Start from the current sub IB and walk up
      let currentId: string | null = realSubIbId;
      while (currentId) {
        const sub = allSubsForIb.find(s => s.id === currentId);
        if (!sub) break;
        const label = sub.es_master_ib ? `Master IB${sub.master_ib_numero || ""}` : "Sub IB";
        chain.unshift({
          nombre: sub.nombre,
          label,
          dolares_por_lote: sub.dolares_por_lote,
        });
        currentId = sub.parent_sub_ib_id || null;
      }

      // Add the root IB at the top using the spread config total (nuevo_dolar_ib)
      const rootIb = ibs.find(i => i.id === lookupId);
      if (rootIb) {
        // Use spread config total as the root's full allocation
        const spreadTotal = spreadRes.data?.[0]?.nuevo_dolar_ib ?? spreadRes.data?.[0]?.dolares_ib_original ?? 0;
        chain.unshift({
          nombre: rootIb.nombre_ib,
          label: "IB Principal (Master IB1)",
          dolares_por_lote: spreadTotal,
        });
      }

      // Convert raw allocations to retained amounts:
      // Each node retains its allocation minus the next node's allocation
      for (let i = 0; i < chain.length - 1; i++) {
        const current = chain[i].dolares_por_lote ?? 0;
        const next = chain[i + 1].dolares_por_lote ?? 0;
        chain[i].dolares_por_lote = current - next;
      }
      // Last node (the sub IB being viewed) keeps its full allocation

      lineage = chain;
    }

    setBdHistory(historyRes.data ?? []);

    // Set conditions
    const subIbLote = isSubIbDetail
      ? subIbs.find(s => s.id === realSubIbId)?.dolares_por_lote ?? null
      : null;
    setConditions({
      spread_config: spreadRes.data ?? [],
      cpa_config: cpaRes.data ?? [],
      hybrid_config: hybridRes.data ?? [],
      propfirm_config: propfirmRes.data ?? [],
      sub_ib_lote: subIbLote,
      lineage,
    });

    // Group update reports
    const updateReports = (reportsRes.data ?? []).filter(
      (r: any) => r.data && r.data._is_update
    );
    const grouped: Record<string, UpdateGroup> = {};
    for (const r of updateReports) {
      const minuteKey = r.created_at.slice(0, 16);
      if (!grouped[minuteKey]) {
        grouped[minuteKey] = {
          date: r.created_at,
          modelo_negocio: (r as any).data?.modelo_negocio,
          tipo_acuerdo: (r as any).data?.tipo_acuerdo_brokeraje,
          reports: [],
        };
      }
      grouped[minuteKey].reports.push({
        id: r.id,
        report_type: r.report_type,
        report_number: r.report_number,
        created_at: r.created_at,
      });
    }
    setUpdateGroups(Object.values(grouped));
    setLoadingHistory(false);
  };

  const handleLineageReport = async (ib: IBItem) => {
    const isSubIb = (ib as any)._isSubIb;
    const ibId = isSubIb
      ? subIbs.find(s => s.id === (ib as any)._realSubIbId)?.ib_id
      : ib.id;
    if (!ibId) return;

    try {
      toast.info("Generando reporte de línea descendente...");

      // Fetch spread config for root $/lote and all sub IBs
      const [spreadRes, subRes] = await Promise.all([
        supabase.from("ib_spread_config").select("nuevo_dolar_ib, dolares_ib_original").eq("ib_id", ibId).limit(1),
        supabase.from("sub_ibs").select("id, nombre, correo, dolares_por_lote, es_master_ib, master_ib_numero, parent_sub_ib_id").eq("ib_id", ibId),
      ]);

      const rootIb = ibs.find(i => i.id === ibId);
      if (!rootIb) { toast.error("IB no encontrado"); return; }

      const rootLote = spreadRes.data?.[0]?.nuevo_dolar_ib ?? spreadRes.data?.[0]?.dolares_ib_original ?? 0;
      const allSubs = subRes.data ?? [];

      // Build tree entries recursively
      interface TreeNode { sub: any; children: TreeNode[]; }
      const buildTree = (parentId: string | null): TreeNode[] => {
        return allSubs
          .filter(s => (s.parent_sub_ib_id || null) === parentId)
          .map(s => ({ sub: s, children: buildTree(s.id) }));
      };

      const entries: { nombre: string; correo: string; rol: string; dolares_por_lote: number | null; depth: number }[] = [];

      // Root entry
      entries.push({
        nombre: rootIb.nombre_ib,
        correo: rootIb.correo_ib,
        rol: "IB Principal (Master IB1)",
        dolares_por_lote: rootLote,
        depth: 0,
      });

      const walkTree = (nodes: TreeNode[], depth: number) => {
        for (const node of nodes) {
          const rol = node.sub.es_master_ib ? `Master IB${node.sub.master_ib_numero || ""}` : "Sub IB";
          entries.push({
            nombre: node.sub.nombre,
            correo: node.sub.correo,
            rol,
            dolares_por_lote: node.sub.dolares_por_lote,
            depth,
          });
          walkTree(node.children, depth + 1);
        }
      };

      const rootTree = buildTree(null);
      walkTree(rootTree, 1);

      const pdf = await generateLineageReportPDF({
        ib_nombre: rootIb.nombre_ib,
        ib_correo: rootIb.correo_ib,
        nombre_bd: rootIb.nombre_bd,
        modelo_negocio: rootIb.modelo_negocio,
        ib_id: ibId,
        total_dolares_lote: rootLote,
        entries,
      });

      pdf.save(`Lineage_${rootIb.nombre_ib.replace(/\s+/g, "_")}.pdf`);
      toast.success("Reporte generado exitosamente");
    } catch (err: any) {
      toast.error("Error al generar reporte: " + (err.message || err));
    }
  };

  // Build unified list: IBs + Sub IBs from DB
  const allRows = useMemo(() => {
    const rows: (IBItem & { _isSubIb?: boolean; _parentIbName?: string; _lineageChain?: string; _masterLabel?: string })[] = [];

    // Helper: build upward chain label for a sub IB
    const buildChain = (sub: any, ib: IBItem): string => {
      const names: string[] = [];
      let currentId = sub.parent_sub_ib_id;
      const ibSubIbs = subIbs.filter(s => s.ib_id === ib.id);
      const visited = new Set<string>();
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const parent = ibSubIbs.find(s => s.id === currentId);
        if (!parent) break;
        names.unshift(parent.nombre);
        currentId = parent.parent_sub_ib_id;
      }
      // Root IB is always at the top
      names.unshift(ib.nombre_ib);
      return names.join(" → ");
    };

    for (const ib of ibs) {
      rows.push(ib);
      // Add sub IBs belonging to this IB right after it
      const children = subIbs.filter(s => s.ib_id === ib.id);
      for (const sub of children) {
        const masterLabel = sub.es_master_ib ? `Master IB${sub.master_ib_numero || ""}` : "";
        // Direct parent name (not always root)
        const directParent = sub.parent_sub_ib_id
          ? subIbs.find(s => s.id === sub.parent_sub_ib_id)
          : null;
        const parentName = directParent ? directParent.nombre : ib.nombre_ib;
        const lineageChain = buildChain(sub, ib);

        rows.push({
          id: `sub_${sub.id}`,
          nombre_ib: sub.nombre,
          correo_ib: sub.correo,
          nombre_bd: ib.nombre_bd,
          modelo_negocio: ib.modelo_negocio,
          tipo_acuerdo_brokeraje: ib.tipo_acuerdo_brokeraje,
          lugar_operacion: ib.lugar_operacion,
          status: ib.status,
          created_at: sub.created_at,
          created_by: ib.created_by,
          tipo_id: sub.tipo_id,
          id_ib: sub.id_documento,
          tipo_persona: ib.tipo_persona,
          representante_legal: null,
          tipo_id_representante: null,
          id_representante: null,
          direccion_empresa: null,
          contacto_corporativo: null,
          negociaciones_especiales: null,
          _isSubIb: true,
          _realSubIbId: sub.id,
          _parentIbName: parentName,
          _lineageChain: lineageChain,
          _masterLabel: masterLabel,
        } as any);
      }
    }
    return rows;
  }, [ibs, subIbs]);

  const filteredIBs = useMemo(() => {
    if (!search) return allRows;
    const q = search.toLowerCase();
    return allRows.filter(
      (ib) =>
        ib.nombre_ib.toLowerCase().includes(q) ||
        ib.correo_ib.toLowerCase().includes(q) ||
        ib.nombre_bd.toLowerCase().includes(q) ||
        ((ib as any)._parentIbName?.toLowerCase().includes(q) ?? false)
    );
  }, [allRows, search]);

  // Check for duplicate emails
  const emailCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allRows.forEach((ib) => {
      const email = ib.correo_ib.toLowerCase();
      counts[email] = (counts[email] || 0) + 1;
    });
    return counts;
  }, [allRows]);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Activo", variant: "default" },
      draft: { label: "Borrador", variant: "secondary" },
      pending: { label: "Pendiente", variant: "outline" },
    };
    const cfg = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const reportTypeIcon = (type: string) => {
    switch (type) {
      case "technical": return <FileText className="w-3 h-3" />;
      case "agreement": return <ScrollText className="w-3 h-3" />;
      case "performance": return <BarChart3 className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  const reportTypeLabel = (type: string) => {
    switch (type) {
      case "technical": return "Reporte Técnico";
      case "agreement": return "Agreement";
      case "performance": return "Performance";
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total IBs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{ibs.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sub IBs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{subIbs.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Correos únicos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{Object.keys(emailCounts).length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duplicados detectados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {Object.values(emailCounts).filter((c) => c > 1).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, correo o BD..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className="border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>IB</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>BD Asignado</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIBs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No se encontraron IBs
                </TableCell>
              </TableRow>
            ) : (
              filteredIBs.map((ib) => {
                const isDuplicate = emailCounts[ib.correo_ib.toLowerCase()] > 1;
                const isSubIb = (ib as any)._isSubIb;
                const parentName = (ib as any)._parentIbName;
                return (
                  <TableRow key={ib.id} className={`${isDuplicate ? "bg-destructive/5" : ""} ${isSubIb ? "bg-muted/30" : ""}`}>
                    <TableCell>
                      {isSubIb ? (
                        (ib as any)._masterLabel ? (
                          <Badge variant="outline" className="text-[10px]">Sub IB / {(ib as any)._masterLabel}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Sub IB</Badge>
                        )
                      ) : (
                        <Badge variant="default" className="text-[10px]">IB</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {ib.nombre_ib}
                      {isSubIb && (ib as any)._masterLabel && (
                        <span className="text-[10px] text-primary ml-1">({(ib as any)._masterLabel})</span>
                      )}
                      {isSubIb && (ib as any)._lineageChain && (
                        <span className="block text-[10px] text-muted-foreground">↳ {(ib as any)._lineageChain}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ib.correo_ib}
                      {isDuplicate && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">
                          Duplicado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs uppercase text-muted-foreground">
                      {ib.nombre_bd}
                    </TableCell>
                    <TableCell className="text-xs">{ib.modelo_negocio}</TableCell>
                    <TableCell className="text-center">{statusBadge(ib.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(ib.created_at)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {(ib.status === "configured" || isAdmin || isGlobalAdmin || (isBD && ib.created_by === user?.id)) && (() => {
                        const entityId = isSubIb ? (ib as any)._realSubIbId : ib.id;
                        const alreadyInvited = invitedIbIds.has(entityId);
                        const handleInvite = async () => {
                          setInvitingIB(ib.id);
                          try {
                            const inviteIbId = isSubIb ? (ib as any)._realSubIbId : ib.id;
                            const { data, error } = await supabase.functions.invoke("invite-ib-externo", {
                              body: { ib_id: inviteIbId, correo_ib: ib.correo_ib, nombre_ib: ib.nombre_ib, resend: alreadyInvited },
                            });
                            if (error) throw error;
                            if (data && !data.success && data.ok === false) throw new Error(data.error || "Error desconocido");
                            toast.success(`${alreadyInvited ? "Reenviado" : "Invitación enviada"} a ${ib.correo_ib}`);
                            setInvitedIbIds(prev => new Set(prev).add(inviteIbId));
                          } catch (err: any) {
                            toast.error("Error al enviar invitación: " + (err.message || err));
                          }
                          setInvitingIB(null);
                        };
                        return alreadyInvited ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs text-primary hover:text-primary"
                            disabled={invitingIB === ib.id}
                            onClick={handleInvite}
                            title="Reenviar correo de invitación"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {invitingIB === ib.id ? "Reenviando..." : "Reenviar correo"}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs"
                            disabled={invitingIB === ib.id}
                            onClick={handleInvite}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {invitingIB === ib.id ? "Enviando..." : "Invitar Portal"}
                          </Button>
                        );
                      })()}
                      {(isAdmin || isGlobalAdmin) && (
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setEditIB(ib)}>
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </Button>
                      )}
                      {(
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => handleLineageReport(ib)}>
                          <GitBranch className="w-3.5 h-3.5" /> Línea
                        </Button>
                      )}
                      {(isAdmin || isGlobalAdmin) && (() => {
                        const entityId = isSubIb ? (ib as any)._realSubIbId : ib.id;
                        const alreadyHasPartner = partnerIbIds.has(entityId);
                        return alreadyHasPartner ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-xs text-primary hover:text-primary"
                              onClick={() => {
                                const slug = partnerSlugs[entityId];
                                const url = `${window.location.origin}/partner/${slug}`;
                                navigator.clipboard.writeText(url);
                                toast.success(`Link copiado: /partner/${slug}`);
                              }}
                              title={`/partner/${partnerSlugs[entityId]}`}
                            >
                              <Copy className="w-3.5 h-3.5" /> Partner Portal
                            </Button>
                            <div
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border cursor-pointer"
                              title={tickersEnabled[entityId] ? "Tickers financieros habilitados" : "Tickers financieros deshabilitados"}
                              onClick={async () => {
                                const newVal = !tickersEnabled[entityId];
                                const slug = partnerSlugs[entityId];
                                const { error } = await (supabase.from as any)("partner_portals")
                                  .update({ tickers_enabled: newVal })
                                  .eq("nombre_portal", slug);
                                if (error) {
                                  toast.error("Error: " + error.message);
                                } else {
                                  setTickersEnabled(prev => ({ ...prev, [entityId]: newVal }));
                                  toast.success(newVal ? "Tickers habilitados para este portal" : "Tickers deshabilitados para este portal");
                                }
                              }}
                            >
                              <TrendingUp className={`w-3 h-3 ${tickersEnabled[entityId] ? "text-green-500" : "text-muted-foreground"}`} />
                              <Switch checked={!!tickersEnabled[entityId]} className="scale-75" tabIndex={-1} />
                            </div>
                            <div
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border cursor-pointer"
                              title={videoStudioEnabled[entityId] ? "Video Studio habilitado" : "Video Studio deshabilitado"}
                              onClick={async () => {
                                const newVal = !videoStudioEnabled[entityId];
                                const slug = partnerSlugs[entityId];
                                const { error } = await (supabase.from as any)("partner_portals")
                                  .update({ video_studio_enabled: newVal })
                                  .eq("nombre_portal", slug);
                                if (error) {
                                  toast.error("Error: " + error.message);
                                } else {
                                  setVideoStudioEnabled(prev => ({ ...prev, [entityId]: newVal }));
                                  toast.success(newVal ? "Video Studio habilitado para este portal" : "Video Studio deshabilitado para este portal");
                                }
                              }}
                            >
                              <Video className={`w-3 h-3 ${videoStudioEnabled[entityId] ? "text-green-500" : "text-muted-foreground"}`} />
                              <Switch checked={!!videoStudioEnabled[entityId]} className="scale-75" tabIndex={-1} />
                            </div>
                            {/* Tier Streams toggle */}
                            {isGlobalAdmin && (
                              <div
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border cursor-pointer"
                                title={tierStreamsEnabled[entityId] ? "Streams por Tier habilitado" : "Streams por Tier deshabilitado"}
                                onClick={async () => {
                                  const newVal = !tierStreamsEnabled[entityId];
                                  const slug = partnerSlugs[entityId];
                                  const { error } = await (supabase.from as any)("partner_portals")
                                    .update({ tier_streams_enabled: newVal })
                                    .eq("nombre_portal", slug);
                                  if (error) {
                                    toast.error("Error: " + error.message);
                                  } else {
                                    setTierStreamsEnabled(prev => ({ ...prev, [entityId]: newVal }));
                                    toast.success(newVal ? "Streams por Tier habilitado" : "Streams por Tier deshabilitado");
                                  }
                                }}
                              >
                                <Shield className={`w-3 h-3 ${tierStreamsEnabled[entityId] ? "text-green-500" : "text-muted-foreground"}`} />
                                <Switch checked={!!tierStreamsEnabled[entityId]} className="scale-75" tabIndex={-1} />
                              </div>
                            )}
                            {/* eCommerce toggle */}
                            {(isAdmin || isGlobalAdmin) && (() => {
                              const ibIdForCommerce = isSubIb
                                ? subIbs.find(s => s.id === (ib as any)._realSubIbId)?.ib_id
                                : ib.id;
                              if (!ibIdForCommerce) return null;
                              return (
                                <div
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border cursor-pointer"
                                  title={commerceEnabled[ibIdForCommerce] ? "Bullfy eCommerce habilitado" : "Bullfy eCommerce deshabilitado"}
                                  onClick={async () => {
                                    const newVal = !commerceEnabled[ibIdForCommerce];
                                    const existing = commerceEnabled[ibIdForCommerce] !== undefined;
                                    let error: any;
                                    if (existing) {
                                      ({ error } = await supabase
                                        .from("portal_commerce_access")
                                        .update({ enabled: newVal, updated_by: user?.id })
                                        .eq("ib_id", ibIdForCommerce));
                                    } else {
                                      ({ error } = await supabase
                                        .from("portal_commerce_access")
                                        .insert({ ib_id: ibIdForCommerce, enabled: newVal, updated_by: user?.id }));
                                    }
                                    if (error) {
                                      toast.error("Error: " + error.message);
                                    } else {
                                      setCommerceEnabled(prev => ({ ...prev, [ibIdForCommerce]: newVal }));
                                      toast.success(newVal ? "Bullfy eCommerce habilitado" : "Bullfy eCommerce deshabilitado");
                                    }
                                  }}
                                >
                                  <ShoppingCart className={`w-3 h-3 ${commerceEnabled[ibIdForCommerce] ? "text-green-500" : "text-muted-foreground"}`} />
                                  <Switch checked={!!commerceEnabled[ibIdForCommerce]} className="scale-75" tabIndex={-1} />
                                </div>
                              );
                            })()}
                            {/* Bullfy Platform Fee (% por venta) — solo global admin */}
                            {isGlobalAdmin && (() => {
                              const slug = partnerSlugs[entityId];
                              if (!slug) return null;
                              return (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border" title="Bullfy Platform Fee: % que cobra la plataforma por cada venta del portal">
                                  <span className="text-[10px] text-muted-foreground">Fee</span>
                                  <Input
                                    type="number" min={0} max={100} step="0.01"
                                    defaultValue={platformFee[entityId] ?? 0}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={async (e) => {
                                      const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                      if (v === (platformFee[entityId] ?? 0)) return;
                                      const { error } = await (supabase.from as any)("partner_portals")
                                        .update({ platform_fee_percentage: v }).eq("nombre_portal", slug);
                                      if (error) { toast.error("Error: " + error.message); }
                                      else { setPlatformFee(prev => ({ ...prev, [entityId]: v })); toast.success(`Platform fee: ${v}%`); }
                                    }}
                                    className="w-14 h-6 text-xs text-right px-1"
                                  />
                                  <span className="text-[10px] text-muted-foreground">%</span>
                                </div>
                              );
                            })()}
                            {isGlobalAdmin && !isSubIb && (
                              <div
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border cursor-pointer"
                                title={tradingRoomOverrides[ib.id] ? "Bullfy Trading Room de prueba habilitado" : "Bullfy Trading Room de prueba deshabilitado"}
                                onClick={async () => {
                                  const newVal = !tradingRoomOverrides[ib.id];
                                  let error: any;
                                  if (tradingRoomOverrides[ib.id] !== undefined) {
                                    ({ error } = await supabase
                                      .from("trading_room_ib_overrides")
                                      .update({ enabled: newVal, enabled_by: user?.id, reason: newVal ? "Override de pruebas" : null })
                                      .eq("ib_id", ib.id));
                                  } else {
                                    ({ error } = await supabase
                                      .from("trading_room_ib_overrides")
                                      .insert({ ib_id: ib.id, enabled: newVal, enabled_by: user?.id, reason: "Override de pruebas" }));
                                  }
                                  if (error) {
                                    toast.error("Error: " + error.message);
                                  } else {
                                    setTradingRoomOverrides(prev => ({ ...prev, [ib.id]: newVal }));
                                    toast.success(newVal ? "Trading Room de prueba habilitado para este IB" : "Trading Room de prueba deshabilitado para este IB");
                                  }
                                }}
                              >
                                <Shield className={`w-3 h-3 ${tradingRoomOverrides[ib.id] ? "text-green-500" : "text-muted-foreground"}`} />
                                <Switch checked={!!tradingRoomOverrides[ib.id]} className="scale-75" tabIndex={-1} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={async () => {
                              const portalName = prompt("Nombre del portal (slug URL, ej: mi-comunidad):");
                              if (!portalName) return;
                              const displayName = prompt("Nombre visible del portal (ej: Mi Comunidad Trading):") || portalName;
                              const slug = portalName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
                              const isSubIbRow = !!(ib as any)._isSubIb;
                              const realSubIbId = (ib as any)._realSubIbId;
                              const parentIbId = isSubIbRow
                                ? subIbs.find(s => s.id === realSubIbId)?.ib_id
                                : ib.id;
                              const { error } = await supabase.from("partner_portals").insert({
                                ib_id: parentIbId,
                                sub_ib_id: isSubIbRow ? realSubIbId : null,
                                nombre_portal: slug,
                                display_name: displayName,
                                enabled_by: user?.id,
                              });
                              if (error) {
                                if (error.code === "23505") toast.error("Ese nombre de portal ya está en uso");
                                else toast.error("Error: " + error.message);
                              } else {
                                toast.success(`Portal "${slug}" habilitado. Acceso: /partner/${slug}`);
                                setPartnerIbIds(prev => new Set(prev).add(entityId));
                                setPartnerSlugs(prev => ({ ...prev, [entityId]: slug }));
                              }
                            }}
                          >
                            <Radio className="w-3.5 h-3.5" /> Partner
                          </Button>
                        );
                      })()}
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => openDetail(ib)}>
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </Button>
                      {(isAdmin || isGlobalAdmin) && (() => {
                        const entityId = isSubIb ? (ib as any)._realSubIbId : ib.id;
                        const targetUserId = ibUserMap[entityId];
                        if (!targetUserId) return null;
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs text-primary hover:text-primary"
                            onClick={() => setLivePermsTarget({ userId: targetUserId, ibName: ib.nombre_ib })}
                            title="Permisos de Video (Bullfy Live)"
                          >
                            <Video className="w-3.5 h-3.5" /> Permisos Video
                          </Button>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailIB} onOpenChange={(open) => { if (!open) setDetailIB(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailIB?.nombre_ib}</DialogTitle>
            <DialogDescription>{detailIB?.correo_ib}</DialogDescription>
          </DialogHeader>
          {detailIB && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">BD Actual</p>
                  <p className="font-medium font-mono uppercase text-xs">{detailIB.nombre_bd}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Modelo</p>
                  <p className="font-medium">{detailIB.modelo_negocio}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Región</p>
                  <p className="font-medium">{detailIB.lugar_operacion}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  {statusBadge(detailIB.status)}
                </div>
                {detailIB.tipo_acuerdo_brokeraje && (
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo Acuerdo</p>
                    <p className="font-medium">{detailIB.tipo_acuerdo_brokeraje}</p>
                  </div>
                )}
              </div>

              {/* Agreement Conditions */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> Condiciones del Acuerdo
                </p>
                {loadingHistory ? (
                  <p className="text-xs text-muted-foreground">Cargando...</p>
                ) : !conditions ? (
                  <p className="text-xs text-muted-foreground/60">Sin datos</p>
                ) : (
                  <div className="space-y-3">
                    {/* Lineage chain for Sub IBs */}
                    {(detailIB as any)?._isSubIb && conditions.lineage && conditions.lineage.length > 0 && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                        <p className="text-xs font-semibold text-primary mb-1">Línea de distribución $/Lote</p>
                        <div className="space-y-1">
                          {conditions.lineage.map((node, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-foreground">
                                {idx > 0 && <span className="text-muted-foreground mr-1">{"└─"}</span>}
                                {node.nombre}
                                <span className="text-muted-foreground ml-1">({node.label})</span>
                              </span>
                              <span className="font-mono font-bold text-foreground">
                                ${node.dolares_por_lote ?? 0}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* IB principal lote (non Sub IB) — from spread config */}
                    {!(detailIB as any)?._isSubIb && conditions?.spread_config?.[0] && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-primary mb-1">$/Lote del IB (Master IB1)</p>
                        <p className="text-lg font-bold text-foreground">${conditions.spread_config[0].nuevo_dolar_ib ?? conditions.spread_config[0].dolares_ib_original}</p>
                      </div>
                    )}

                    {/* Comisión por lote operado (independent, informational only) */}
                    {!(detailIB as any)?._isSubIb && (detailIB as any)?.tiene_comision_por_lote && (detailIB as any)?.comision_dolares_por_lote != null && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Comisión adicional por lote operado</p>
                        <p className="text-lg font-bold text-foreground">${(detailIB as any).comision_dolares_por_lote}</p>
                        <p className="text-xs text-muted-foreground mt-1">Este valor es independiente de la distribución $/lote</p>
                      </div>
                    )}

                    {/* Rebates (spread config) */}
                    {conditions.spread_config.length > 0 && (
                      <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                        <p className="text-xs font-semibold text-foreground mb-2">Rebates — $/Lote</p>
                        {!(detailIB as any)?._isSubIb && (
                          <p className="text-xs text-muted-foreground mb-2">
                            $/Lote: <span className="font-bold text-foreground">${conditions.spread_config[0]?.nuevo_dolar_ib ?? conditions.spread_config[0]?.dolares_ib_original}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* CPA config */}
                    {conditions.cpa_config.length > 0 && (
                      <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                        <p className="text-xs font-semibold text-foreground mb-2">CPA — Costo Por Adquisición</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[11px] h-7">Rango Depósito</TableHead>
                              <TableHead className="text-[11px] h-7 text-right">CPA</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {conditions.cpa_config.map((c, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs py-1">{c.rango_deposito}</TableCell>
                                <TableCell className="text-xs py-1 text-right font-medium">${c.cpa_pagar}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Hybrid config */}
                    {conditions.hybrid_config.length > 0 && (
                      <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                        <p className="text-xs font-semibold text-foreground mb-2">Híbrido — CPA + Rebates</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[11px] h-7">Rango Depósito</TableHead>
                              <TableHead className="text-[11px] h-7 text-right">CPA</TableHead>
                              <TableHead className="text-[11px] h-7 text-right">$/Lote</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {conditions.hybrid_config.map((h, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs py-1">{h.rango_deposito}</TableCell>
                                <TableCell className="text-xs py-1 text-right">${h.cpa_pagar}</TableCell>
                                <TableCell className="text-xs py-1 text-right font-medium">${h.dolares_por_lote}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* PropFirm config */}
                    {conditions.propfirm_config.length > 0 && (
                      <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                        <p className="text-xs font-semibold text-foreground mb-2">PropFirm — Comisiones</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[11px] h-7">Rango Ventas</TableHead>
                              <TableHead className="text-[11px] h-7 text-right">Comisión</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {conditions.propfirm_config.map((p, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs py-1">{p.rango_ventas}</TableCell>
                                <TableCell className="text-xs py-1 text-right font-medium">{p.porcentaje_comision}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* No conditions */}
                    {conditions.spread_config.length === 0 && conditions.cpa_config.length === 0 && conditions.hybrid_config.length === 0 && conditions.propfirm_config.length === 0 && !((detailIB as any)?._isSubIb && conditions.sub_ib_lote) && (
                      <p className="text-xs text-muted-foreground/60">Sin condiciones configuradas</p>
                    )}
                  </div>
                )}
              </div>

              {/* BD History */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Historial de reasignaciones
                </p>
                {loadingHistory ? (
                  <p className="text-xs text-muted-foreground">Cargando...</p>
                ) : bdHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">Sin reasignaciones</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {bdHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border/50 text-xs">
                        <ArrowRightLeft className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-mono uppercase">{h.bd_anterior_nombre}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono uppercase">{h.bd_nuevo_nombre}</span>
                        <span className="ml-auto text-muted-foreground">{formatDate(h.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agreement Change History */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Historial de cambios en el acuerdo
                </p>
                {loadingHistory ? (
                  <p className="text-xs text-muted-foreground">Cargando...</p>
                ) : updateGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">Sin modificaciones al acuerdo</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {updateGroups.map((group, idx) => (
                      <div key={idx} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400">
                            Actualización
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{formatDateTime(group.date)}</span>
                        </div>
                        {(group.modelo_negocio || group.tipo_acuerdo) && (
                          <p className="text-[11px] text-muted-foreground">
                            Modelo: <span className="text-foreground font-medium">{group.modelo_negocio || "—"}</span>
                            {group.tipo_acuerdo && (
                              <> · Acuerdo: <span className="text-foreground font-medium">{group.tipo_acuerdo}</span></>
                            )}
                          </p>
                        )}
                        <div className="space-y-1">
                          {group.reports.map((r) => (
                            <div key={r.id} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded bg-secondary/30">
                              {reportTypeIcon(r.report_type)}
                              <span className="text-muted-foreground">{reportTypeLabel(r.report_type)}</span>
                              <span className="font-mono text-foreground font-medium">{r.report_number}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editIB && (
        <IBEditDialog
          ib={editIB}
          open={!!editIB}
          onOpenChange={(open) => {
            if (!open) {
              setEditIB(null);
              fetchIBs(); // refresh list when dialog closes
            }
          }}
          onSaved={() => {}} // don't refresh while dialog is open to preserve state
        />
      )}

      {/* Live Feature Permissions Dialog */}
      {livePermsTarget && (
        <IBLiveFeaturePermissions
          open={!!livePermsTarget}
          onOpenChange={(open) => { if (!open) setLivePermsTarget(null); }}
          userId={livePermsTarget.userId}
          ibName={livePermsTarget.ibName}
        />
      )}
    </div>
  );
};

export default IBMaintenance;
