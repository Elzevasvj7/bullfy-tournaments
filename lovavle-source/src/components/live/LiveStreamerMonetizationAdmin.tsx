import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toastUtils";
import { DollarSign, Users, Settings, Save, Eye, CheckCircle, Wallet } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StreamerRow {
  host_id: string;
  host_name: string;
  enabled: boolean;
  custom_dolares_por_lead: number | null;
  custom_bono_visualizaciones_monto: number | null;
  custom_bono_streams_monto: number | null;
  custom_bono_interacciones_monto: number | null;
  custom_bono_votacion_monto: number | null;
  total_earnings: number;
  pending_earnings: number;
  total_streams: number;
  has_record: boolean;
}

const LiveStreamerMonetizationAdmin = () => {
  const [streamers, setStreamers] = useState<StreamerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editStreamer, setEditStreamer] = useState<StreamerRow | null>(null);
  const [editValues, setEditValues] = useState<Partial<StreamerRow>>({});
  const [saving, setSaving] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    fetchWithdrawals();
  }, []);

  const fetchData = async () => {
    // Fetch all hosts who have ever streamed
    const { data: rooms } = await supabase
      .from("live_rooms")
      .select("host_id")
      .eq("status", "ended");

    let hostIds = [...new Set((rooms || []).map(r => r.host_id))];
    if (hostIds.length === 0) { setLoading(false); return; }

    // Filter to only IB Externo hosts
    const { data: ibExternoRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "ib_externo")
      .in("user_id", hostIds);

    hostIds = (ibExternoRoles || []).map(r => r.user_id);
    if (hostIds.length === 0) { setLoading(false); return; }

    // Fetch profiles, monetization configs, and earnings in parallel
    const [profilesRes, monetizationRes, earningsRes, roomCountRes] = await Promise.all([
      supabase.from("profiles").select("id, nombre").in("id", hostIds),
      supabase.from("live_streamer_monetization").select("*").in("host_id", hostIds),
      supabase.from("live_streamer_earnings").select("host_id, earnings_total, status").in("host_id", hostIds),
      supabase.from("live_rooms").select("host_id").eq("status", "ended").in("host_id", hostIds),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.nombre]));
    const monetizationMap = new Map((monetizationRes.data || []).map(m => [m.host_id, m]));

    // Aggregate earnings
    const earningsMap: Record<string, { total: number; pending: number }> = {};
    (earningsRes.data || []).forEach(e => {
      if (!earningsMap[e.host_id]) earningsMap[e.host_id] = { total: 0, pending: 0 };
      earningsMap[e.host_id].total += Number(e.earnings_total);
      if (e.status === "pending") earningsMap[e.host_id].pending += Number(e.earnings_total);
    });

    // Count streams per host
    const streamCount: Record<string, number> = {};
    (roomCountRes.data || []).forEach(r => {
      streamCount[r.host_id] = (streamCount[r.host_id] || 0) + 1;
    });

    const rows: StreamerRow[] = hostIds.map(hid => {
      const mon = monetizationMap.get(hid) as any;
      return {
        host_id: hid,
        host_name: profileMap.get(hid) || "Desconocido",
        enabled: mon ? mon.enabled : true,
        custom_dolares_por_lead: mon?.custom_dolares_por_lead ?? null,
        custom_bono_visualizaciones_monto: mon?.custom_bono_visualizaciones_monto ?? null,
        custom_bono_streams_monto: mon?.custom_bono_streams_monto ?? null,
        custom_bono_interacciones_monto: mon?.custom_bono_interacciones_monto ?? null,
        custom_bono_votacion_monto: mon?.custom_bono_votacion_monto ?? null,
        total_earnings: earningsMap[hid]?.total || 0,
        pending_earnings: earningsMap[hid]?.pending || 0,
        total_streams: streamCount[hid] || 0,
        has_record: !!mon,
      };
    }).sort((a, b) => b.total_streams - a.total_streams);

    setStreamers(rows);
    setLoading(false);
  };

  const fetchWithdrawals = async () => {
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false });
    
    // Fetch profile names for host_ids
    const hostIds = [...new Set((data || []).map((d: any) => d.host_id))];
    if (hostIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, nombre").in("id", hostIds);
      const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.nombre]));
      setWithdrawals((data || []).map((w: any) => ({ ...w, host_name: nameMap.get(w.host_id) || "Desconocido" })));
    } else {
      setWithdrawals([]);
    }
  };

  const handleWithdrawalAction = async (id: string, status: "approved" | "rejected", notes?: string) => {
    const { error } = await supabase
      .from("withdrawal_requests")
      .update({ status, reviewed_at: new Date().toISOString(), notes: notes || null } as any)
      .eq("id", id);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success(status === "approved" ? "Retiro aprobado" : "Retiro rechazado");
    fetchWithdrawals();
  };

  const toggleEnabled = async (streamer: StreamerRow) => {
    const newEnabled = !streamer.enabled;
    if (streamer.has_record) {
      const { error } = await supabase
        .from("live_streamer_monetization")
        .update({ enabled: newEnabled })
        .eq("host_id", streamer.host_id);
      if (error) { toast.error("Error: " + error.message); return; }
    } else {
      const { error } = await supabase
        .from("live_streamer_monetization")
        .insert({ host_id: streamer.host_id, enabled: newEnabled });
      if (error) { toast.error("Error: " + error.message); return; }
    }
    toast.success(newEnabled ? "Monetización habilitada" : "Monetización deshabilitada");
    fetchData();
  };

  const openEdit = (s: StreamerRow) => {
    setEditStreamer(s);
    setEditValues({
      custom_dolares_por_lead: s.custom_dolares_por_lead,
      custom_bono_visualizaciones_monto: s.custom_bono_visualizaciones_monto,
      custom_bono_streams_monto: s.custom_bono_streams_monto,
      custom_bono_interacciones_monto: s.custom_bono_interacciones_monto,
      custom_bono_votacion_monto: s.custom_bono_votacion_monto,
    });
  };

  const handleSaveOverrides = async () => {
    if (!editStreamer) return;
    setSaving(true);

    const payload = {
      host_id: editStreamer.host_id,
      enabled: editStreamer.enabled,
      custom_dolares_por_lead: editValues.custom_dolares_por_lead ?? null,
      custom_bono_visualizaciones_monto: editValues.custom_bono_visualizaciones_monto ?? null,
      custom_bono_streams_monto: editValues.custom_bono_streams_monto ?? null,
      custom_bono_interacciones_monto: editValues.custom_bono_interacciones_monto ?? null,
      custom_bono_votacion_monto: editValues.custom_bono_votacion_monto ?? null,
    };

    if (editStreamer.has_record) {
      const { error } = await supabase
        .from("live_streamer_monetization")
        .update(payload)
        .eq("host_id", editStreamer.host_id);
      if (error) { toast.error("Error: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("live_streamer_monetization")
        .insert(payload);
      if (error) { toast.error("Error: " + error.message); setSaving(false); return; }
    }

    toast.success("Configuración guardada");
    setEditStreamer(null);
    setSaving(false);
    fetchData();
  };

  const handleApproveEarnings = async (hostId: string) => {
    // Aprueba (status→'paid') Y acredita al wallet unificado del host (income_type='live'),
    // de forma atómica e idempotente en el servidor. El retiro es único (wallet unificado).
    const { data, error } = await (supabase.rpc as any)("approve_and_credit_live_earnings", {
      _host_id: hostId,
    });
    if (error) { toast.error("Error: " + error.message); return; }
    if (data && data.credited === false) {
      toast.success("Ganancias aprobadas. (No se pudo acreditar al wallet: el host aún no tiene portal/host vinculado; se reintenta al re-aprobar.)");
    } else {
      toast.success("Ganancias aprobadas y acreditadas al wallet del IB");
    }
    fetchData();
  };

  const totalPending = streamers.reduce((s, r) => s + r.pending_earnings, 0);
  const totalPaid = streamers.reduce((s, r) => s + (r.total_earnings - r.pending_earnings), 0);
  const enabledCount = streamers.filter(s => s.enabled).length;

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{streamers.length}</p>
              <p className="text-sm text-muted-foreground">Streamers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="w-5 h-5 text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold">{enabledCount}</p>
              <p className="text-sm text-muted-foreground">Monetización Activa</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10"><DollarSign className="w-5 h-5 text-yellow-500" /></div>
            <div>
              <p className="text-2xl font-bold">${totalPending.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Pendiente de Pago</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><DollarSign className="w-5 h-5 text-blue-500" /></div>
            <div>
              <p className="text-2xl font-bold">${totalPaid.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Total Pagado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Streamers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Control de Monetización por Streamer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {streamers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p>No hay streamers registrados aún</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Streamer</TableHead>
                  <TableHead className="text-center">Streams</TableHead>
                  <TableHead className="text-center">Monetización</TableHead>
                  <TableHead className="text-center">Override</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streamers.map(s => (
                  <TableRow key={s.host_id}>
                    <TableCell className="font-medium">{s.host_name}</TableCell>
                    <TableCell className="text-center">{s.total_streams}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={s.enabled} onCheckedChange={() => toggleEnabled(s)} />
                    </TableCell>
                    <TableCell className="text-center">
                      {(s.custom_dolares_por_lead !== null || s.custom_bono_visualizaciones_monto !== null ||
                        s.custom_bono_streams_monto !== null || s.custom_bono_interacciones_monto !== null ||
                        s.custom_bono_votacion_monto !== null)
                        ? <Badge variant="default" className="text-xs">Personalizado</Badge>
                        : <Badge variant="outline" className="text-xs">Global</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-right">${s.pending_earnings.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">${s.total_earnings.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)} className="gap-1">
                          <Settings className="w-3 h-3" /> Config
                        </Button>
                        {s.pending_earnings > 0 && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-600/30 hover:bg-green-500/10">
                                <CheckCircle className="w-3 h-3" /> Aprobar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Aprobar ganancias de {s.host_name}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se marcarán ${s.pending_earnings.toFixed(2)} como pagadas. Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleApproveEarnings(s.host_id)}>
                                  Confirmar Aprobación
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editStreamer} onOpenChange={o => !o && setEditStreamer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Monetización — {editStreamer?.host_name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deja vacío para usar la configuración global. Ingresa un valor para sobrescribir.
          </p>
          <div className="space-y-3 mt-2">
            <div className="flex items-center gap-3">
              <Label className="w-40 text-sm">USD por Lead:</Label>
              <Input
                type="number" step="0.01" placeholder="Global"
                value={editValues.custom_dolares_por_lead ?? ""}
                onChange={e => setEditValues(p => ({ ...p, custom_dolares_por_lead: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-40 text-sm">Bono Vistas $:</Label>
              <Input
                type="number" step="0.01" placeholder="Global"
                value={editValues.custom_bono_visualizaciones_monto ?? ""}
                onChange={e => setEditValues(p => ({ ...p, custom_bono_visualizaciones_monto: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-40 text-sm">Bono Streams $:</Label>
              <Input
                type="number" step="0.01" placeholder="Global"
                value={editValues.custom_bono_streams_monto ?? ""}
                onChange={e => setEditValues(p => ({ ...p, custom_bono_streams_monto: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-40 text-sm">Bono Interacciones $:</Label>
              <Input
                type="number" step="0.01" placeholder="Global"
                value={editValues.custom_bono_interacciones_monto ?? ""}
                onChange={e => setEditValues(p => ({ ...p, custom_bono_interacciones_monto: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-40 text-sm">Bono Votación $:</Label>
              <Input
                type="number" step="0.01" placeholder="Global"
                value={editValues.custom_bono_votacion_monto ?? ""}
                onChange={e => setEditValues(p => ({ ...p, custom_bono_votacion_monto: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-32"
              />
            </div>
          </div>
          <Button onClick={handleSaveOverrides} disabled={saving} className="w-full gap-2 mt-2">
            <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Requests */}
      {withdrawals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" /> Solicitudes de Retiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Streamer</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Red</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.host_name}</TableCell>
                    <TableCell className="text-sm">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-bold">${Number(w.amount).toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">{w.wallet_address}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{w.currency} {w.network}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={w.status === "approved" || w.status === "processed" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>
                        {w.status === "pending" ? "Pendiente" : w.status === "approved" ? "Aprobado" : w.status === "processed" ? "Procesado" : "Rechazado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {w.status === "pending" && (
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="outline" className="gap-1 text-green-600" onClick={() => handleWithdrawalAction(w.id, "approved")}>
                            <CheckCircle className="w-3 h-3" /> Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => handleWithdrawalAction(w.id, "rejected")}>
                            Rechazar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LiveStreamerMonetizationAdmin;
