import { useEffect, useState, useCallback } from "react";
import { Copy, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Clock, User, FileText, MessageSquare, History } from "lucide-react";
import { DEAL_STATUSES } from "@/lib/dealStatuses";
import OpsRequestBitacora from "./OpsRequestBitacora";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";

interface OpsRequest {
  id: string;
  ib_id: string;
  description: string;
  status: string;
  created_by: string;
  assigned_to: string | null;
  taken_by: string | null;
  created_at: string;
  taken_at: string | null;
  completed_at: string | null;
  notes: string | null;
  target_department: string;
  ibs: { nombre_ib: string; nombre_bd: string; correo_ib: string; modelo_negocio: string } | null;
}

interface OpsUser {
  id: string;
  nombre: string;
}

interface IBOption {
  id: string;
  nombre_ib: string;
}

const REQUEST_STATUSES = DEAL_STATUSES.filter(s => ["nuevo", "en_proceso", "configurado"].includes(s.value));
const STORAGE_KEY = "bullfy:operaciones:requests-state";

const OpsRequests = () => {
  const { user, isAdmin, isAdminOperaciones, isOperaciones, isBD, isAdminBD, isVentas, isAdminVentas, isDealing } = useAuth();
  const [persistedState, setPersistedState] = useSessionStorageState(STORAGE_KEY, {
    filter: "all",
    showCreate: false,
    selectedIb: "",
    reqDescription: "",
    showAssign: false,
    assignTargetId: "",
    assignUserId: "",
    showNotes: false,
    notesTargetId: "",
    notesText: "",
    showBitacora: false,
    bitacoraRequestId: "",
    ibAssociated: true,
    targetDepartment: "operaciones",
  });
  const [requests, setRequests] = useState<OpsRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(persistedState.filter);
  const [opsUsers, setOpsUsers] = useState<Map<string, string>>(new Map());
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());

  // Create dialog
  const [showCreate, setShowCreate] = useState(persistedState.showCreate);
  const [ibOptions, setIbOptions] = useState<IBOption[]>([]);
  const [selectedIb, setSelectedIb] = useState(persistedState.selectedIb);
  const [reqDescription, setReqDescription] = useState(persistedState.reqDescription);
  const [ibAssociated, setIbAssociated] = useState(persistedState.ibAssociated);
  const [targetDepartment, setTargetDepartment] = useState(persistedState.targetDepartment);
  const [creating, setCreating] = useState(false);

  // Assign dialog
  const [showAssign, setShowAssign] = useState(persistedState.showAssign);
  const [assignTarget, setAssignTarget] = useState<OpsRequest | null>(null);
  const [assignUserId, setAssignUserId] = useState(persistedState.assignUserId);
  const [opsUsersList, setOpsUsersList] = useState<OpsUser[]>([]);

  // Notes dialog
  const [showNotes, setShowNotes] = useState(persistedState.showNotes);
  const [notesTarget, setNotesTarget] = useState<OpsRequest | null>(null);
  const [notesText, setNotesText] = useState(persistedState.notesText);

  // Bitácora dialog
  const [showBitacora, setShowBitacora] = useState(persistedState.showBitacora);
  const [bitacoraRequest, setBitacoraRequest] = useState<OpsRequest | null>(null);

  const canManage = isAdmin || isAdminOperaciones || isOperaciones || isDealing;
  const canAssign = isAdmin || isAdminOperaciones;
  const canChangeStatusForReq = (req: OpsRequest) => {
    if (isAdmin || isAdminOperaciones) return true;
    if (isOperaciones) return req.taken_by === user?.id || req.assigned_to === user?.id;
    if (isDealing) return req.taken_by === user?.id || req.assigned_to === user?.id;
    return false;
  };

  const fetchRequests = useCallback(async () => {
    let query = supabase
      .from("ops_requests")
      .select("*, ibs(nombre_ib, nombre_bd, correo_ib, modelo_negocio)")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRequests((data as unknown as OpsRequest[]) ?? []);
    }
    setLoading(false);
  }, [filter]);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, nombre");
    if (data) {
      const map = new Map<string, string>();
      data.forEach(p => map.set(p.id, p.nombre));
      setProfilesMap(map);
    }
  }, []);

  const fetchOpsUsers = useCallback(async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["operaciones", "admin_operaciones", "dealing"]);
    if (roles) {
      const ids = [...new Set(roles.map(r => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, nombre").in("id", ids);
      if (profiles) {
        const map = new Map<string, string>();
        const list: OpsUser[] = [];
        profiles.forEach(p => {
          map.set(p.id, p.nombre);
          list.push({ id: p.id, nombre: p.nombre });
        });
        setOpsUsers(map);
        setOpsUsersList(list);
      }
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchProfiles();
    fetchOpsUsers();

    const channel = supabase
      .channel("ops-requests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ops_requests" }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests, fetchProfiles, fetchOpsUsers]);

  useEffect(() => {
    if (!requests.length) return;

    if (persistedState.assignTargetId) {
      const request = requests.find((entry) => entry.id === persistedState.assignTargetId);
      if (request && persistedState.showAssign) setAssignTarget(request);
    }

    if (persistedState.notesTargetId) {
      const request = requests.find((entry) => entry.id === persistedState.notesTargetId);
      if (request && persistedState.showNotes) setNotesTarget(request);
    }

    if (persistedState.bitacoraRequestId) {
      const request = requests.find((entry) => entry.id === persistedState.bitacoraRequestId);
      if (request && persistedState.showBitacora) setBitacoraRequest(request);
    }
  }, [persistedState.assignTargetId, persistedState.bitacoraRequestId, persistedState.notesTargetId, persistedState.showAssign, persistedState.showBitacora, persistedState.showNotes, requests]);

  useEffect(() => {
    setPersistedState({
      filter,
      showCreate,
      selectedIb,
      reqDescription,
      showAssign,
      assignTargetId: assignTarget?.id || "",
      assignUserId,
      showNotes,
      notesTargetId: notesTarget?.id || "",
      notesText,
      showBitacora,
      bitacoraRequestId: bitacoraRequest?.id || "",
      ibAssociated,
      targetDepartment,
    });
  }, [assignTarget, assignUserId, bitacoraRequest, filter, ibAssociated, targetDepartment, notesTarget, notesText, persistedState, reqDescription, selectedIb, setPersistedState, showAssign, showBitacora, showCreate, showNotes]);

  // Fetch IBs for creation - admins/ops see all, BDs see own
  const openCreateDialog = async () => {
    if (!user) return;
    let query = supabase.from("ibs").select("id, nombre_ib").order("nombre_ib");
    if (isBD && !isAdmin && !isAdminOperaciones && !isOperaciones) {
      query = query.eq("created_by", user.id);
    }
    const { data } = await query;
    setIbOptions(data ?? []);
    setSelectedIb("");
    setReqDescription("");
    setIbAssociated(true);
    setTargetDepartment("operaciones");
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!reqDescription.trim() || !user) return;
    if (targetDepartment === 'operaciones' && ibAssociated && !selectedIb) return;
    setCreating(true);
    const insertData: Record<string, unknown> = {
      description: reqDescription.trim(),
      created_by: user.id,
      target_department: targetDepartment,
    };
    if (targetDepartment === 'operaciones' && ibAssociated && selectedIb) {
      insertData.ib_id = selectedIb;
    }
    const { error } = await supabase.from("ops_requests").insert(insertData as any);
    setCreating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Solicitud creada", description: targetDepartment === 'dealing' ? "Tu solicitud fue enviada al equipo de Dealing." : "Tu solicitud fue enviada al equipo de operaciones." });
      setShowCreate(false);
      fetchRequests();
    }
  };

  const handleTake = async (req: OpsRequest) => {
    if (!user) return;
    const { error } = await supabase.from("ops_requests").update({
      status: "en_proceso",
      taken_by: user.id,
      taken_at: new Date().toISOString(),
    }).eq("id", req.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Solicitud tomada" }); fetchRequests(); }
  };

  const handleComplete = async (req: OpsRequest) => {
    const { error } = await supabase.from("ops_requests").update({
      status: "configurado",
      completed_at: new Date().toISOString(),
    }).eq("id", req.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Solicitud completada" }); fetchRequests(); }
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignUserId) return;
    const { error } = await supabase.from("ops_requests").update({
      assigned_to: assignUserId,
      status: "en_proceso",
      taken_by: assignUserId,
      taken_at: new Date().toISOString(),
    }).eq("id", assignTarget.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Solicitud asignada" }); setShowAssign(false); fetchRequests(); }
  };

  const handleSaveNotes = async () => {
    if (!notesTarget) return;
    const { error } = await supabase.from("ops_requests").update({ notes: notesText }).eq("id", notesTarget.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Notas guardadas" }); setShowNotes(false); fetchRequests(); }
  };

  const formatTime = (from: string, to?: string | null) => {
    const start = new Date(from).getTime();
    const end = to ? new Date(to).getTime() : Date.now();
    const ms = end - start;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const statusBadge = (status: string) => {
    const cfg = REQUEST_STATUSES.find(s => s.value === status);
    return <Badge variant={cfg?.variant ?? "outline"}>{cfg?.label ?? status}</Badge>;
  };

  if (loading) return <p className="text-muted-foreground">Cargando solicitudes...</p>;

  return (
    <div className="space-y-4">
      {/* Header with create button for BDs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todas</Button>
          {REQUEST_STATUSES.map(s => (
            <Button key={s.value} size="sm" variant={filter === s.value ? "default" : "outline"} onClick={() => setFilter(s.value)}>
              {s.label}
            </Button>
          ))}
        </div>
        {(isBD || isAdminBD || isAdmin || isOperaciones || isAdminOperaciones || isVentas || isAdminVentas || isDealing) && (
          <Button onClick={openCreateDialog} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nueva solicitud
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dept.</TableHead>
              <TableHead>IB</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Asignado a</TableHead>
              <TableHead>T. Respuesta</TableHead>
              <TableHead>T. Ejecución</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No hay solicitudes
                </TableCell>
              </TableRow>
            ) : requests.map(req => (
              <TableRow key={req.id}>
                <TableCell>
                  <Badge variant="outline" className={req.target_department === 'dealing' ? 'border-orange-500/30 text-orange-400' : ''}>
                    {req.target_department === 'dealing' ? 'Dealing' : 'Ops'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium text-foreground">{req.ibs?.nombre_ib ?? <span className="text-muted-foreground italic">Solicitud general</span>}</span>
                    {req.ibs?.correo_ib && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]" title={req.ibs.correo_ib}>{req.ibs.correo_ib}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(req.ibs!.correo_ib);
                            toast({ title: "Correo copiado", description: req.ibs!.correo_ib });
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          title="Copiar correo"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{req.description}</TableCell>
                <TableCell>{statusBadge(req.status)}</TableCell>
                <TableCell className="text-sm">{profilesMap.get(req.created_by) ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {req.taken_by ? (opsUsers.get(req.taken_by) || profilesMap.get(req.taken_by) || "—") : "Sin asignar"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {req.taken_at ? formatTime(req.created_at, req.taken_at) : (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(req.created_at)}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {req.taken_at ? (
                    req.completed_at ? formatTime(req.taken_at, req.completed_at) : (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(req.taken_at)}</span>
                    )
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {/* Bitácora */}
                    <Button size="sm" variant="ghost" onClick={() => { setBitacoraRequest(req); setShowBitacora(true); }}>
                      <History className="w-3.5 h-3.5 mr-1" /> Bitácora
                    </Button>
                    {/* Notes */}
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => { setNotesTarget(req); setNotesText(req.notes ?? ""); setShowNotes(true); }}>
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {/* Take */}
                    {canManage && req.status === "nuevo" && !req.taken_by && (
                      <Button size="sm" variant="outline" onClick={() => handleTake(req)}>Tomar</Button>
                    )}
                    {/* Complete - only if assigned to current user (ops) or admin */}
                    {canChangeStatusForReq(req) && req.status === "en_proceso" && (
                      <Button size="sm" variant="outline" onClick={() => handleComplete(req)}>Completar</Button>
                    )}
                    {/* Assign */}
                    {canAssign && req.status === "nuevo" && (
                      <Button size="sm" variant="outline" onClick={() => { setAssignTarget(req); setAssignUserId(""); setShowAssign(true); }}>
                        <User className="w-3.5 h-3.5 mr-1" /> Asignar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Solicitud Operativa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Department selector */}
            <div className="space-y-2">
              <Label>Departamento destino</Label>
              <Select value={targetDepartment} onValueChange={(val) => {
                setTargetDepartment(val);
                if (val === 'dealing') {
                  setIbAssociated(false);
                  setSelectedIb("");
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operaciones">Operaciones</SelectItem>
                  <SelectItem value="dealing">Dealing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetDepartment === 'operaciones' && (
              <div className="flex items-center justify-between">
                <Label htmlFor="ib-toggle">IB Asociado</Label>
                <Switch
                  id="ib-toggle"
                  checked={ibAssociated}
                  onCheckedChange={(checked) => {
                    setIbAssociated(checked);
                    if (!checked) setSelectedIb("");
                  }}
                />
              </div>
            )}
            {targetDepartment === 'operaciones' && ibAssociated && (
              <div className="space-y-2">
                <Label>Seleccionar IB</Label>
                <Select value={selectedIb} onValueChange={setSelectedIb}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un IB" />
                  </SelectTrigger>
                  <SelectContent>
                    {ibOptions.map(ib => (
                      <SelectItem key={ib.id} value={ib.id}>{ib.nombre_ib}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {targetDepartment === 'operaciones' && !ibAssociated && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                Esta solicitud no estará vinculada a ningún IB. Se creará como solicitud general.
              </p>
            )}
            {targetDepartment === 'dealing' && (
              <p className="text-xs text-muted-foreground bg-orange-500/10 border border-orange-500/20 p-3 rounded-md">
                Esta solicitud será enviada al departamento de Dealing. No se asocia a un IB.
              </p>
            )}
            <div className="space-y-2">
              <Label>Descripción del requerimiento</Label>
              <Textarea
                value={reqDescription}
                onChange={e => setReqDescription(e.target.value)}
                placeholder="Describe el requerimiento..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || (targetDepartment === 'operaciones' && ibAssociated && !selectedIb) || !reqDescription.trim()}>
              {creating ? "Creando..." : "Crear solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={showAssign} onOpenChange={(open) => { setShowAssign(open); if (!open) setAssignTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar solicitud</DialogTitle>
          </DialogHeader>
          <Select value={assignUserId} onValueChange={setAssignUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un operador" />
            </SelectTrigger>
            <SelectContent>
              {opsUsersList.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!assignUserId}>Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={showNotes} onOpenChange={(open) => { setShowNotes(open); if (!open) setNotesTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas — {notesTarget?.ibs?.nombre_ib || "Solicitud general"}</DialogTitle>
          </DialogHeader>
          <Textarea value={notesText} onChange={e => setNotesText(e.target.value)} rows={5} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotes(false)}>Cancelar</Button>
            <Button onClick={handleSaveNotes}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bitácora Dialog */}
      {bitacoraRequest && (
        <OpsRequestBitacora
          open={showBitacora}
          onOpenChange={(open) => { setShowBitacora(open); if (!open) setBitacoraRequest(null); }}
          request={bitacoraRequest}
          profilesMap={profilesMap}
          opsUsersMap={opsUsers}
        />
      )}
    </div>
  );
};

export default OpsRequests;
