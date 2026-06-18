import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Users, DollarSign, User, Eye, CheckCircle, Clock } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface SubIBRequest {
  id: string;
  ib_id: string;
  sub_ib_nombre: string;
  sub_ib_correo: string;
  status: string;
  compensation_data: any;
  created_at: string;
  updated_at: string;
  notes: string | null;
  // Live $/lote from sub_ibs table (for completed requests)
  live_sub_ib_lote?: number | null;
  live_requester_lote?: number | null;
}

const IBExternoSubIBs = () => {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<SubIBRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubIBRequest | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("ib_external_requests")
        .select("id, ib_id, sub_ib_nombre, sub_ib_correo, status, compensation_data, created_at, updated_at, notes")
        .eq("requested_by", user.id)
        .eq("request_type", "sub_ib")
        .order("created_at", { ascending: false });
      if (error) { toast.error("Error al cargar Sub IBs"); setLoading(false); return; }

      const reqs: SubIBRequest[] = data ?? [];

      // For completed requests, fetch live $/lote from sub_ibs
      const completedReqs = reqs.filter(r => r.status === "completado");
      if (completedReqs.length > 0) {
        const ibIds = [...new Set(completedReqs.map(r => r.ib_id))];
        const { data: subIbs } = await supabase
          .from("sub_ibs")
          .select("correo, dolares_por_lote, ib_id, alias, nombre")
          .in("ib_id", ibIds);

        // Also fetch requester's own live $/lote
        const subIbId = profile?.sub_ib_id;
        let requesterLiveLote: number | null = null;
        if (subIbId) {
          const { data: reqSub } = await supabase
            .from("sub_ibs")
            .select("dolares_por_lote")
            .eq("id", subIbId)
            .single();
          if (reqSub) requesterLiveLote = reqSub.dolares_por_lote;
        }

        for (const req of reqs) {
          if (req.status === "completado" && subIbs) {
            const match = subIbs.find(s => s.correo === req.sub_ib_correo && s.ib_id === req.ib_id);
            if (match) {
              req.live_sub_ib_lote = match.dolares_por_lote;
              // Override display name with alias if available
              if (match.alias) req.sub_ib_nombre = match.alias;
            }
          }
          req.live_requester_lote = requesterLiveLote;
        }
      }

      setRequests(reqs);
      setLoading(false);
    };
    load();
  }, [user, profile]);

  const completados = requests.filter((r) => r.status === "completado");
  const enProceso = requests.filter((r) => ["pendiente_bd", "aprobado_bd", "en_proceso_ops"].includes(r.status));

  const cd = selected?.compensation_data || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mis Sub IBs</h2>
        <p className="text-sm text-muted-foreground mt-1">Sub IBs que has incorporado a tu línea (cadena hacia abajo)</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : requests.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No tienes Sub IBs registrados aún.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* Active Sub IBs */}
          {completados.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" /> Sub IBs Activos ({completados.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completados.map((req) => (
                  <Card key={req.id} className="border-green-500/20 hover:border-green-500/40 transition-colors cursor-pointer" onClick={() => setSelected(req)}>
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{req.sub_ib_nombre}</p>
                            <p className="text-xs text-muted-foreground">{req.sub_ib_correo}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px]">
                          Activo
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-primary" />
                          <span className="text-sm font-bold text-primary">${req.live_sub_ib_lote ?? req.compensation_data?.sub_ib_dolar_lote ?? 0}/lote</span>
                        </div>
                        <Button variant="ghost" size="sm" className="ml-auto gap-1 text-xs text-muted-foreground">
                          <Eye className="w-3.5 h-3.5" /> Ver condiciones
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* In-process Sub IBs */}
          {enProceso.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" /> En Proceso ({enProceso.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enProceso.map((req) => (
                  <Card key={req.id} className="border-yellow-500/20 opacity-80 cursor-pointer" onClick={() => setSelected(req)}>
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-yellow-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{req.sub_ib_nombre}</p>
                            <p className="text-xs text-muted-foreground">{req.sub_ib_correo}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-[10px]">
                          En proceso
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">${req.compensation_data?.sub_ib_dolar_lote ?? 0}/lote (pendiente)</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Conditions Detail Dialog — only show downward info */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Condiciones: {selected?.sub_ib_nombre}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Requester (logged-in user) allocation for this specific agreement */}
              {(() => {
                const subIbLote = selected.live_sub_ib_lote ?? cd.sub_ib_dolar_lote ?? 0;
                const requesterBase = selected.live_requester_lote ?? cd.solicitante?.dolares_antes ?? 0;
                const requesterInThisDeal = requesterBase - subIbLote;
                return (
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Tú</p>
                    <p className="text-sm font-medium text-foreground">{cd.solicitante?.nombre || "—"}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span className="text-lg font-bold text-primary">${requesterInThisDeal}/lote</span>
                      <span className="text-xs text-muted-foreground ml-1">(base: ${requesterBase})</span>
                    </div>
                  </div>
                );
              })()}

              {/* Sub IB Info */}
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Sub IB</p>
                <p className="text-sm font-medium text-foreground">{selected.sub_ib_nombre}</p>
                <p className="text-xs text-muted-foreground">{selected.sub_ib_correo}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-lg font-bold text-primary">${selected.live_sub_ib_lote ?? cd.sub_ib_dolar_lote ?? 0}/lote</span>
                </div>
              </div>

              {/* Status */}
              <div className="p-3 rounded-lg border border-border bg-secondary/10">
                <p className="text-xs text-muted-foreground font-medium mb-1">Estado</p>
                <Badge variant="outline" className={
                  selected.status === "completado"
                    ? "bg-green-500/10 text-green-400 border-green-500/30"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                }>
                  {selected.status === "completado" ? "Activo / Completado" : selected.status}
                </Badge>
              </div>

              {selected.notes && (
                <div className="p-3 rounded-lg border border-border bg-secondary/10">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Notas</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IBExternoSubIBs;
