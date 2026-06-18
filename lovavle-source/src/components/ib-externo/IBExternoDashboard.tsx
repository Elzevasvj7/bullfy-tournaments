import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toastUtils";
import { Clock, CheckCircle, XCircle, Loader2, Eye, UserPlus, Sparkles, FileSearch, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import IBExternoDetailDialog from "@/components/operations/IBExternoDetailDialog";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Request {
  id: string;
  ib_id: string;
  sub_ib_nombre: string;
  sub_ib_correo: string;
  status: string;
  request_type: string;
  created_at: string;
  updated_at: string;
  bd_rejection_reason: string | null;
  notes: string | null;
  compensation_data: any;
  attachments: any;
}

interface HistoryItem {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendiente_bd: { label: "Pendiente BD", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  aprobado_bd: { label: "Aprobado BD", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: CheckCircle },
  en_proceso_ops: { label: "En Proceso", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: Loader2 },
  completado: { label: "Completado", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  rechazado: { label: "Rechazado", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
};

const IBExternoDashboard = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyDialog, setHistoryDialog] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [detailRequest, setDetailRequest] = useState<Request | null>(null);
  const [statusFilter, setStatusFilter] = useState("todas");

  const fetchRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("ib_external_requests")
      .select("id, ib_id, sub_ib_nombre, sub_ib_correo, status, request_type, created_at, updated_at, bd_rejection_reason, notes, compensation_data, attachments")
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error al cargar solicitudes");
    } else {
      setRequests(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel("ib-ext-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "ib_external_requests" }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const openHistory = async (requestId: string) => {
    setHistoryDialog(requestId);
    setLoadingHistory(true);
    const { data } = await supabase
      .from("ib_external_request_history")
      .select("id, action, details, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    setHistory(data ?? []);
    setLoadingHistory(false);
  };

  const counts = {
    total: requests.length,
    pendiente: requests.filter((r) => r.status === "pendiente_bd").length,
    en_proceso: requests.filter((r) => ["aprobado_bd", "en_proceso_ops"].includes(r.status)).length,
    completado: requests.filter((r) => r.status === "completado").length,
  };

  const filteredRequests = statusFilter === "todas"
    ? requests
    : statusFilter === "pendiente"
      ? requests.filter((r) => r.status === "pendiente_bd")
      : statusFilter === "en_proceso"
        ? requests.filter((r) => ["aprobado_bd", "en_proceso_ops"].includes(r.status))
        : statusFilter === "completado"
          ? requests.filter((r) => r.status === "completado")
          : statusFilter === "rechazado"
            ? requests.filter((r) => r.status === "rechazado")
            : requests;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mis Solicitudes</h2>
        <p className="text-sm text-muted-foreground mt-1">Seguimiento de tus solicitudes a operaciones</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-2xl font-bold text-foreground">{counts.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{counts.pendiente}</p>
          <p className="text-xs text-muted-foreground">Pendientes</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{counts.en_proceso}</p>
          <p className="text-xs text-muted-foreground">En Proceso</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <p className="text-2xl font-bold text-green-400">{counts.completado}</p>
          <p className="text-xs text-muted-foreground">Completados</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Solicitudes</CardTitle>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
            <TabsList className="h-8">
              <TabsTrigger value="todas" className="text-xs px-2.5 h-7">Todas ({counts.total})</TabsTrigger>
              <TabsTrigger value="pendiente" className="text-xs px-2.5 h-7">Pendientes ({counts.pendiente})</TabsTrigger>
              <TabsTrigger value="en_proceso" className="text-xs px-2.5 h-7">En Proceso ({counts.en_proceso})</TabsTrigger>
              <TabsTrigger value="completado" className="text-xs px-2.5 h-7">Completados ({counts.completado})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{statusFilter === "todas" ? "No tienes solicitudes aún." : "No hay solicitudes con este filtro."}</p>
              {statusFilter === "todas" && (
                <Link to="/ib-portal/nueva?tipo=sub_ib" className="text-primary hover:underline text-sm mt-2 block">
                  Crear primera solicitud →
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creada</TableHead>
                    <TableHead>Última actualización</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((req) => {
                    const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pendiente_bd;
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {req.request_type === "sub_ib" ? "Sub IB" : req.request_type === "especial" ? "Especial" : req.request_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            <span>{req.sub_ib_nombre}</span>
                            {Array.isArray(req.attachments) && req.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground" title={`${req.attachments.length} archivo(s) adjunto(s)`}>
                                <Paperclip className="w-3 h-3" />
                                {req.attachments.length}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${cfg.color} gap-1 text-[10px]`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                          {req.status === "rechazado" && req.bd_rejection_reason && (
                            <p className="text-[10px] text-destructive mt-1">{req.bd_rejection_reason}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: es })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(req.updated_at), { addSuffix: true, locale: es })}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailRequest(req)} className="gap-1 text-xs">
                            <FileSearch className="w-3.5 h-3.5" />
                            Ver
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openHistory(req.id)} className="gap-1 text-xs">
                            <Eye className="w-3.5 h-3.5" />
                            Bitácora
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={!!historyDialog} onOpenChange={() => setHistoryDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bitácora de Solicitud</DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin registros.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{h.action}</p>
                    {h.details && <p className="text-xs text-muted-foreground">{h.details}</p>}
                    <p className="text-[10px] text-muted-foreground/60">
                      {new Date(h.created_at).toLocaleString("es-MX")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {detailRequest && (
        <IBExternoDetailDialog
          open={!!detailRequest}
          onOpenChange={() => setDetailRequest(null)}
          requestType={detailRequest.request_type}
          subIbNombre={detailRequest.sub_ib_nombre}
          subIbCorreo={detailRequest.sub_ib_correo}
          compensationData={detailRequest.compensation_data || {}}
          notes={detailRequest.notes}
          ibId={detailRequest.ib_id}
          attachments={Array.isArray(detailRequest.attachments) ? detailRequest.attachments : []}
          isExternalView
        />
      )}
    </div>
  );
};

export default IBExternoDashboard;
