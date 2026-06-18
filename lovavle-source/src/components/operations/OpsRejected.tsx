import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { XCircle, Eye, Copy, Wrench, FileText, UserPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import OpsViewDialog from "./OpsViewDialog";
import IBExternoDetailDialog from "./IBExternoDetailDialog";
import OpsRequestBitacora from "./OpsRequestBitacora";
import { useAuth } from "@/hooks/useAuth";

interface RejectedItem {
  id: string;
  ib_id: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  assigned_to: string | null;
  type: "deal" | "solicitud" | "ib_externo";
  ibs: { nombre_ib: string; nombre_bd: string; correo_ib: string; modelo_negocio: string } | null;
  description?: string;
  sub_ib_nombre?: string;
  sub_ib_correo?: string;
  request_type?: string;
  requested_by?: string;
  compensation_data?: any;
  notes?: string | null;
  created_by?: string;
  taken_by?: string | null;
  taken_at?: string | null;
  completed_at?: string | null;
}

const OpsRejected = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<RejectedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [viewDialog, setViewDialog] = useState<{ open: boolean; ibId: string; opsQueueId: string; ibName: string }>({ open: false, ibId: "", opsQueueId: "", ibName: "" });
  const [ibExternoDetail, setIbExternoDetail] = useState<RejectedItem | null>(null);
  const [bitacoraItem, setBitacoraItem] = useState<RejectedItem | null>(null);

  const fetchRejected = async () => {
    setLoading(true);
    const [queueRes, reqRes, ibExtRes] = await Promise.all([
      supabase.from("ops_queue").select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio)").eq("status", "rechazado").order("created_at", { ascending: false }),
      supabase.from("ops_requests").select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio)").eq("status", "rechazado").order("created_at", { ascending: false }),
      supabase.from("ib_external_requests").select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio)").eq("status", "rechazado").order("created_at", { ascending: false }),
    ]);

    const deals: RejectedItem[] = ((queueRes.data as any[]) ?? []).map((d) => ({
      id: d.id, ib_id: d.ib_id, status: "rechazado", rejection_reason: d.rejection_reason,
      created_at: d.created_at, assigned_to: d.assigned_to, type: "deal" as const,
      ibs: d.ibs, notes: d.notes,
    }));

    const reqs: RejectedItem[] = ((reqRes.data as any[]) ?? []).map((r) => ({
      id: r.id, ib_id: r.ib_id, status: "rechazado", rejection_reason: r.rejection_reason,
      created_at: r.created_at, assigned_to: r.assigned_to, type: "solicitud" as const,
      ibs: r.ibs ? { ...r.ibs, correo_ib: r.ibs.correo_ib || "" } : null,
      description: r.description, created_by: r.created_by, taken_by: r.taken_by,
      taken_at: r.taken_at, completed_at: r.completed_at, notes: r.notes,
    }));

    const ibExts: RejectedItem[] = ((ibExtRes.data as any[]) ?? []).map((r) => ({
      id: r.id, ib_id: r.ib_id, status: "rechazado",
      rejection_reason: r.bd_rejection_reason,
      created_at: r.created_at, assigned_to: r.ops_assigned_to, type: "ib_externo" as const,
      ibs: r.ibs, sub_ib_nombre: r.sub_ib_nombre, sub_ib_correo: r.sub_ib_correo,
      request_type: r.request_type, requested_by: r.requested_by,
      compensation_data: r.compensation_data, notes: r.notes, attachments: r.attachments,
      description: r.request_type === "sub_ib"
        ? `Nuevo Sub IB: ${r.sub_ib_nombre}`
        : r.notes || `${r.request_type}: ${r.sub_ib_nombre}`,
    }));

    setItems([...deals, ...reqs, ...ibExts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, nombre");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => { map[p.id] = p.nombre; });
      setProfilesMap(map);
    }
  };

  useEffect(() => {
    fetchRejected();
    fetchProfiles();
  }, []);

  const typeBadge = (type: string, requestType?: string) => {
    if (type === "deal") return <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary"><Wrench className="w-3 h-3" />Deal</Badge>;
    if (type === "ib_externo") {
      if (requestType === "sub_ib") return <Badge variant="outline" className="text-xs gap-1 border-emerald-500/30 text-emerald-400"><UserPlus className="w-3 h-3" />Nuevo Sub IB</Badge>;
      return <Badge variant="outline" className="text-xs gap-1 border-purple-500/30 text-purple-400"><FileText className="w-3 h-3" />Especial</Badge>;
    }
    return <Badge variant="outline" className="text-xs gap-1 border-amber-500/30 text-amber-400"><FileText className="w-3 h-3" />Solicitud</Badge>;
  };

  if (loading) return <p className="text-muted-foreground">Cargando rechazados...</p>;
  if (items.length === 0) return <div className="text-center py-12 text-muted-foreground"><p>No hay tickets rechazados</p></div>;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-muted-foreground font-medium">Tipo</th>
                <th className="text-left p-4 text-muted-foreground font-medium">IB</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Detalle</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Motivo de Rechazo</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Rechazado por</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Fecha</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.type}-${item.id}`} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="p-4">{typeBadge(item.type, item.request_type)}</td>
                  <td className="p-4">
                    <div>
                      <p className="text-foreground font-medium">{item.ibs?.nombre_ib || "—"}</p>
                      {(() => {
                        const email = item.type === "ib_externo" ? (item.sub_ib_correo || item.ibs?.correo_ib) : item.ibs?.correo_ib;
                        if (!email) return null;
                        return (
                          <div className="flex items-center gap-1 mt-0.5">
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={email}>{email}</p>
                            <button onClick={() => { navigator.clipboard.writeText(email); toast({ title: "Correo copiado", description: email }); }} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Copiar correo">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-muted-foreground text-sm max-w-[200px] truncate" title={item.description}>{item.description || item.ibs?.nombre_bd || "—"}</p>
                  </td>
                  <td className="p-4">
                    <div className="max-w-[250px]">
                      <p className="text-sm text-destructive bg-destructive/10 rounded px-2 py-1 border border-destructive/20">
                        {item.rejection_reason || "Sin motivo especificado"}
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">{item.assigned_to ? (profilesMap[item.assigned_to] || "—") : "—"}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("es-MX")}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1.5">
                      {item.type === "deal" && (
                        <Button size="sm" variant="ghost" onClick={() => setViewDialog({ open: true, ibId: item.ib_id, opsQueueId: item.id, ibName: item.ibs?.nombre_ib || "IB" })} className="text-primary hover:text-primary gap-1">
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </Button>
                      )}
                      {item.type === "ib_externo" && (
                        <Button size="sm" variant="ghost" onClick={() => setIbExternoDetail(item)} className="text-primary hover:text-primary gap-1">
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </Button>
                      )}
                      {item.type === "solicitud" && (
                        <Button size="sm" variant="ghost" onClick={() => setBitacoraItem(item)} className="text-primary hover:text-primary gap-1">
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <OpsViewDialog
        open={viewDialog.open}
        onOpenChange={(open) => setViewDialog(open ? viewDialog : { open: false, ibId: "", opsQueueId: "", ibName: "" })}
        ibId={viewDialog.ibId}
        opsQueueId={viewDialog.opsQueueId}
        ibName={viewDialog.ibName}
        userId={user?.id}
      />

      {ibExternoDetail && (
        <IBExternoDetailDialog
          open={!!ibExternoDetail}
          onOpenChange={(open) => { if (!open) setIbExternoDetail(null); }}
          requestType={ibExternoDetail.request_type || "sub_ib"}
          subIbNombre={ibExternoDetail.sub_ib_nombre || ""}
          subIbCorreo={ibExternoDetail.sub_ib_correo}
          compensationData={ibExternoDetail.compensation_data || {}}
          notes={ibExternoDetail.notes}
          requesterName={ibExternoDetail.requested_by ? profilesMap[ibExternoDetail.requested_by] : undefined}
          ibId={ibExternoDetail.ib_id}
          attachments={Array.isArray((ibExternoDetail as any).attachments) ? (ibExternoDetail as any).attachments : []}
        />
      )}

      {bitacoraItem && (
        <OpsRequestBitacora
          open={!!bitacoraItem}
          onOpenChange={(open) => { if (!open) setBitacoraItem(null); }}
          request={{
            id: bitacoraItem.id,
            ib_id: bitacoraItem.ib_id,
            description: bitacoraItem.description || "",
            status: bitacoraItem.status,
            created_by: bitacoraItem.created_by || "",
            assigned_to: bitacoraItem.assigned_to,
            taken_by: bitacoraItem.taken_by || null,
            created_at: bitacoraItem.created_at,
            taken_at: bitacoraItem.taken_at || null,
            completed_at: bitacoraItem.completed_at || null,
            notes: bitacoraItem.notes || null,
            ibs: bitacoraItem.ibs ? { nombre_ib: bitacoraItem.ibs.nombre_ib, nombre_bd: bitacoraItem.ibs.nombre_bd, modelo_negocio: bitacoraItem.ibs.modelo_negocio } : null,
          }}
          profilesMap={new Map(Object.entries(profilesMap))}
          opsUsersMap={new Map(Object.entries(profilesMap))}
        />
      )}
    </div>
  );
};

export default OpsRejected;
