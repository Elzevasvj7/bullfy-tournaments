import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DollarSign, User, Users, Crown, FileText, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RequestAttachmentsViewer from "./RequestAttachmentsViewer";
import type { RequestAttachment } from "@/components/ib-externo/RequestAttachmentsUploader";

interface ChainNode {
  nombre: string;
  correo?: string;
  gross: number;
  net: number;
  type: "master_ib1" | "master_extra" | "requester" | "sub_ib";
}

interface CompensationData {
  total_linea?: number;
  solicitante?: {
    es_master_extra?: boolean;
    es_sub_ib?: boolean;
    master_numero?: number;
    nombre?: string;
    correo?: string;
    sub_ib_id?: string;
    dolares_antes?: number;
    dolares_despues?: number;
  };
  master_ib1?: {
    nombre?: string;
    dolares_por_lote?: number;
  };
  otros_master_ibs?: Array<{
    numero?: number;
    nombre?: string;
    correo?: string;
    dolares_por_lote?: number;
  }>;
  sub_ibs_existentes?: Array<{
    nombre?: string;
    correo?: string;
    dolares_por_lote?: number;
  }>;
  sub_ib_dolar_lote?: number;
  parent_sub_ib_id?: string;
  // Generic/especial fields
  tipo?: string;
  descripcion?: string;
  cantidad?: string;
  notas?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestType: string;
  subIbNombre: string;
  subIbCorreo?: string;
  compensationData: CompensationData;
  notes: string | null;
  requesterName?: string;
  ibId?: string;
  isExternalView?: boolean;
  attachments?: RequestAttachment[];
}

const IBExternoDetailDialog = ({ open, onOpenChange, requestType, subIbNombre, subIbCorreo, compensationData, notes, requesterName, ibId, isExternalView, attachments }: Props) => {
  const isSubIB = requestType === "sub_ib";
  const [cd, setCd] = useState<CompensationData>(compensationData || {});
  const [chainNodes, setChainNodes] = useState<ChainNode[]>([]);
  const [loadingChain, setLoadingChain] = useState(false);

  useEffect(() => {
    if (!open || !isSubIB || !ibId) return;

    const fetchChain = async () => {
      setLoadingChain(true);
      try {
        const [ibRes, subIbsRes, spreadRes] = await Promise.all([
          supabase.from("ibs").select("nombre_ib, alias").eq("id", ibId).single(),
          supabase.from("sub_ibs").select("id, nombre, correo, es_master_ib, master_ib_numero, dolares_por_lote, alias, parent_sub_ib_id").eq("ib_id", ibId),
          supabase.from("ib_spread_config").select("dolares_ib_original, nuevo_dolar_ib").eq("ib_id", ibId).limit(1),
        ]);

        const allSubIBs = (subIbsRes.data || []) as any[];
        const subIbMap = new Map(allSubIBs.map((s: any) => [s.id, s]));

        const totalLinea = spreadRes.data?.[0]
          ? (spreadRes.data[0].nuevo_dolar_ib ?? spreadRes.data[0].dolares_ib_original)
          : (compensationData?.total_linea ?? 7);

        // Find the requester's sub_ib_id
        const requesterSubIbId = compensationData?.parent_sub_ib_id || compensationData?.solicitante?.sub_ib_id;

        // Walk up parent_sub_ib_id to build ancestor chain (bottom-up)
        const ancestorChain: any[] = [];
        if (requesterSubIbId) {
          let currentId: string | null = requesterSubIbId;
          const visited = new Set<string>();
          while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            const node = subIbMap.get(currentId);
            if (!node) break;
            ancestorChain.push(node);
            currentId = node.parent_sub_ib_id;
          }
        }
        // ancestorChain = [requester, parent, grandparent, ...] → reverse to top-down
        ancestorChain.reverse();

        // Build the display chain with net amounts
        // Chain: [Master IB1, ...ancestors (top→bottom), new sub IB]
        // Master IB1 gross: totalLinea - sum of ALL master IBs' dolares_por_lote
        const masterIBs = allSubIBs.filter((s: any) => s.es_master_ib);
        const allMastersTotal = masterIBs.reduce((sum: number, s: any) => sum + (s.dolares_por_lote ?? 0), 0);
        const masterIB1Gross = totalLinea - allMastersTotal;

        const newSubIbGross = compensationData?.sub_ib_dolar_lote ?? 0;

        // Build gross values array: [IB1_gross, ...chain_gross..., newSubIb_gross]
        const grossValues: number[] = [];
        const nodes: ChainNode[] = [];

        // Master IB1
        grossValues.push(masterIB1Gross);
        nodes.push({
          nombre: ibRes.data?.alias || ibRes.data?.nombre_ib || "Principal",
          gross: masterIB1Gross,
          net: 0, // calculated below
          type: "master_ib1",
        });

        // Ancestor chain nodes
        const requesterSubIbIdStr = requesterSubIbId || "";
        for (const node of ancestorChain) {
          const isMaster = node.es_master_ib;
          const isRequester = node.id === requesterSubIbIdStr;
          grossValues.push(node.dolares_por_lote ?? 0);
          nodes.push({
            nombre: node.alias || node.nombre,
            correo: node.correo,
            gross: node.dolares_por_lote ?? 0,
            net: 0,
            type: isRequester ? "requester" : isMaster ? "master_extra" : "sub_ib",
          });
        }

        // New Sub IB
        grossValues.push(newSubIbGross);
        nodes.push({
          nombre: subIbNombre,
          correo: subIbCorreo,
          gross: newSubIbGross,
          net: newSubIbGross,
          type: "sub_ib",
        });

        // Calculate net: each node's net = gross[i] - gross[i+1]
        // Exception: Master IB1's net = totalLinea - gross[1] (first chain node after IB1)
        for (let i = 0; i < nodes.length - 1; i++) {
          if (i === 0) {
            // Master IB1: net = totalLinea - next node's gross
            nodes[i].net = totalLinea - grossValues[1];
          } else {
            nodes[i].net = grossValues[i] - grossValues[i + 1];
          }
        }

        setCd({ ...compensationData, total_linea: totalLinea });
        setChainNodes(nodes);
      } catch (e) {
        console.error("Error fetching chain:", e);
        setCd(compensationData || {});
        setChainNodes([]);
      } finally {
        setLoadingChain(false);
      }
    };

    fetchChain();
  }, [open, isSubIB, ibId, compensationData, subIbNombre, subIbCorreo]);

  // Update cd when compensationData prop changes
  useEffect(() => {
    if (compensationData) {
      setCd(compensationData);
    }
  }, [compensationData]);

  const getNodeIcon = (type: ChainNode["type"]) => {
    if (type === "master_ib1" || type === "master_extra") return <Crown className="w-3.5 h-3.5 text-amber-400" />;
    return <User className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const getNodeStyle = (node: ChainNode, isLast: boolean) => {
    if (isLast) return "border-2 border-dashed border-primary/40 bg-primary/5";
    if (node.type === "master_ib1") return "border border-border bg-secondary/10";
    if (node.type === "master_extra") return "border border-amber-500/20 bg-amber-500/5";
    if (node.type === "requester") return "border border-amber-500/20 bg-amber-500/5";
    return "border border-border bg-secondary/5";
  };

  const getNodeLabel = (node: ChainNode, index: number, isLast: boolean) => {
    if (isLast) return `${node.nombre} (NUEVO)`;
    if (node.type === "master_ib1") return `Master IB1 — ${node.nombre}`;
    if (node.type === "master_extra") {
      return isExternalView ? `Tú — ${node.nombre}` : `Master IB — ${node.nombre}`;
    }
    if (node.type === "requester") {
      return isExternalView ? `Tú — ${node.nombre}` : node.nombre;
    }
    return node.nombre;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSubIB ? <Users className="w-5 h-5 text-primary" /> : <Sparkles className="w-5 h-5 text-amber-400" />}
            {isSubIB ? "Detalle: Nuevo Sub IB" : "Detalle: Solicitud Especial"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request type badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={isSubIB ? "border-primary/30 text-primary" : "border-amber-500/30 text-amber-400"}>
              {isSubIB ? "Nuevo Sub IB" : "Solicitud Especial"}
            </Badge>
            {requesterName && (
              <span className="text-xs text-muted-foreground">Solicitado por: <strong>{requesterName}</strong></span>
            )}
          </div>

          {isSubIB ? (
            <>
              {/* New Sub IB info */}
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Nuevo Sub IB a configurar</p>
                <p className="text-sm font-medium text-foreground">{subIbNombre}</p>
                {subIbCorreo && <p className="text-xs text-muted-foreground">{subIbCorreo}</p>}
                <div className="flex items-center gap-1.5 mt-2">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-bold text-primary">${cd.sub_ib_dolar_lote ?? 0}/lote</span>
                </div>
              </div>

              {/* $/lote distribution chain */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  {isExternalView ? "Distribución de $/Lote" : `Distribución de $/Lote — Total línea: $${cd.total_linea ?? 0}`}
                </p>

                {loadingChain ? (
                  <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Cargando distribución...</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {chainNodes
                      .filter((node, index) => {
                        if (!isExternalView) return true;
                        // External view: only requester + new sub IB (last node)
                        return node.type === "requester" || index === chainNodes.length - 1;
                      })
                      .map((node, idx, filteredArr) => {
                        const isLast = idx === filteredArr.length - 1;
                        const isNewSubIb = isLast;

                        return (
                          <div key={idx} className={`flex items-center justify-between p-2.5 rounded-lg ${getNodeStyle(node, isNewSubIb)}`}>
                            <div className="flex items-center gap-2">
                              {isNewSubIb ? <User className="w-3.5 h-3.5 text-primary" /> : getNodeIcon(node.type)}
                              <div>
                                <p className={`text-sm font-medium ${isNewSubIb ? "text-primary" : "text-foreground"}`}>
                                  {getNodeLabel(node, idx, isNewSubIb)}
                                </p>
                                {node.correo && !isNewSubIb && (
                                  <p className="text-[10px] text-muted-foreground">{node.correo}</p>
                                )}
                                {isNewSubIb && subIbCorreo && (
                                  <p className="text-[10px] text-muted-foreground">{subIbCorreo}</p>
                                )}
                              </div>
                            </div>
                            <span className={`text-sm font-bold ${isNewSubIb ? "text-primary" : node.type === "master_extra" || node.type === "requester" ? "text-amber-400" : "text-foreground"}`}>
                              ${node.net}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Special/generic request */
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-border bg-secondary/10 space-y-2">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Descripción de la solicitud
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{cd.descripcion || notes || "Sin descripción"}</p>
                {cd.cantidad && (
                  <p className="text-sm text-muted-foreground">Cantidad: <strong>{cd.cantidad}</strong></p>
                )}
                {cd.notas && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground font-medium">Notas adicionales</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{cd.notas}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ops notes */}
          {notes && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Notas operativas</p>
              <p className="text-sm text-foreground p-3 rounded-lg border border-border bg-secondary/10 whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {attachments && attachments.length > 0 && (
            <RequestAttachmentsViewer attachments={attachments} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IBExternoDetailDialog;
