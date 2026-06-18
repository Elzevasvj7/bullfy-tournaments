import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toastUtils";
import { Users, ArrowRightLeft, Search, ChevronDown, ChevronUp, Eye } from "lucide-react";

interface BDProfile {
  id: string;
  nombre: string;
  correo: string;
  status: string;
  ibCount: number;
}

interface IBRow {
  id: string;
  nombre_ib: string;
  correo_ib: string;
  modelo_negocio: string;
  status: string;
  created_at: string;
  created_by: string | null;
}

const BusinessDevelopers = () => {
  const { isGlobalAdmin, isAdmin } = useAuth();
  const [bds, setBds] = useState<BDProfile[]>([]);
  const [ibs, setIbs] = useState<IBRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedBD, setExpandedBD] = useState<string | null>(null);

  // Reassign dialog
  const [reassignDialog, setReassignDialog] = useState<{ open: boolean; ib: IBRow | null }>({ open: false, ib: null });
  const [targetBD, setTargetBD] = useState("");
  const [reassigning, setReassigning] = useState(false);

  // Detail dialog
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; bd: BDProfile | null }>({ open: false, bd: null });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get all users with BD role
      const { data: bdRoles } = await supabase.from("user_roles").select("user_id").eq("role", "bd");
      const bdUserIds = bdRoles?.map((r) => r.user_id) ?? [];

      if (bdUserIds.length === 0) {
        setBds([]);
        setIbs([]);
        setLoading(false);
        return;
      }

      const [profilesRes, ibsRes] = await Promise.all([
        supabase.from("profiles").select("id, nombre, correo, status").in("id", bdUserIds),
        supabase.from("ibs").select("id, nombre_ib, correo_ib, modelo_negocio, status, created_at, created_by"),
      ]);

      const allIbs: IBRow[] = ibsRes.data ?? [];
      setIbs(allIbs);

      // Count IBs per BD
      const countMap: Record<string, number> = {};
      allIbs.forEach((ib) => {
        if (ib.created_by) countMap[ib.created_by] = (countMap[ib.created_by] || 0) + 1;
      });

      const bdProfiles: BDProfile[] = (profilesRes.data ?? []).map((p) => ({
        ...p,
        ibCount: countMap[p.id] || 0,
      }));

      setBds(bdProfiles);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar datos");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredBDs = useMemo(() => {
    if (!search) return bds;
    const q = search.toLowerCase();
    return bds.filter((b) => b.nombre.toLowerCase().includes(q) || b.correo.toLowerCase().includes(q));
  }, [bds, search]);

  const ibsForBD = (bdId: string) => ibs.filter((ib) => ib.created_by === bdId);

  const handleReassign = async () => {
    if (!reassignDialog.ib || !targetBD) return;
    setReassigning(true);
    
    const currentBD = bds.find((b) => b.id === reassignDialog.ib?.created_by);
    const newBD = bds.find((b) => b.id === targetBD);
    
    // Update created_by and nombre_bd on ibs table
    const { error } = await supabase
      .from("ibs")
      .update({ created_by: targetBD, nombre_bd: newBD?.nombre ?? "" })
      .eq("id", reassignDialog.ib.id);

    if (error) {
      toast.error("Error al reasignar: " + error.message);
    } else {
      // Log history
      await supabase.from("ib_bd_history").insert({
        ib_id: reassignDialog.ib.id,
        bd_anterior_id: reassignDialog.ib.created_by,
        bd_anterior_nombre: currentBD?.nombre ?? reassignDialog.ib.nombre_ib,
        bd_nuevo_id: targetBD,
        bd_nuevo_nombre: newBD?.nombre ?? "",
      });
      
      toast.success(`IB "${reassignDialog.ib.nombre_ib}" reasignado a ${newBD?.nombre ?? "BD"}`);
      setReassignDialog({ open: false, ib: null });
      setTargetBD("");
      await fetchData();
    }
    setReassigning(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      approved: { label: "Aprobado", variant: "default" },
      pending: { label: "Pendiente", variant: "secondary" },
      rejected: { label: "Rechazado", variant: "destructive" },
      disabled: { label: "Deshabilitado", variant: "outline" },
    };
    const cfg = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const modelBadge = (model: string) => {
    const colors: Record<string, string> = {
      Brokeraje: "bg-blue-500/20 text-blue-400",
      PropFirm: "bg-emerald-500/20 text-emerald-400",
      Ambos: "bg-amber-500/20 text-amber-400",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[model] || "bg-muted text-muted-foreground"}`}>
        {model}
      </span>
    );
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
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total BDs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{bds.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total IBs asignados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{ibs.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">BDs activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{bds.filter((b) => b.status === "approved").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar BD por nombre o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* BD Table */}
      <Card className="border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BD</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">IBs asignados</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBDs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No se encontraron Business Developers
                </TableCell>
              </TableRow>
            ) : (
              filteredBDs.map((bd) => {
                const isExpanded = expandedBD === bd.id;
                const bdIbs = ibsForBD(bd.id);
                return (
                  <> 
                    <TableRow key={bd.id} className="cursor-pointer" onClick={() => setExpandedBD(isExpanded ? null : bd.id)}>
                      <TableCell className="font-medium font-mono uppercase text-xs tracking-wide">{bd.nombre}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{bd.correo}</TableCell>
                      <TableCell className="text-center">{statusBadge(bd.status)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-primary/30 text-primary">{bd.ibCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${bd.id}-expanded`}>
                        <TableCell colSpan={5} className="p-0">
                          <div className="bg-secondary/30 border-t border-border px-6 py-4">
                            {bdIbs.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-3">Este BD no tiene IBs asignados</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">IB</TableHead>
                                    <TableHead className="text-xs">Correo</TableHead>
                                    <TableHead className="text-xs">Modelo</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs text-right">Reasignar</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {bdIbs.map((ib) => (
                                    <TableRow key={ib.id}>
                                      <TableCell className="text-sm font-medium">{ib.nombre_ib}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{ib.correo_ib}</TableCell>
                                      <TableCell>{modelBadge(ib.modelo_negocio)}</TableCell>
                                      <TableCell>{statusBadge(ib.status)}</TableCell>
                                      <TableCell className="text-right">
                                        {(isAdmin || isGlobalAdmin) && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setReassignDialog({ open: true, ib });
                                              setTargetBD("");
                                            }}
                                          >
                                            <ArrowRightLeft className="w-3.5 h-3.5" />
                                            Reasignar
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Reassign Dialog */}
      <Dialog open={reassignDialog.open} onOpenChange={(open) => { if (!open) setReassignDialog({ open: false, ib: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reasignar IB</DialogTitle>
            <DialogDescription>
              Reasignar <span className="font-semibold text-foreground">{reassignDialog.ib?.nombre_ib}</span> a otro Business Developer. Este cambio quedará registrado en la auditoría.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">BD actual</p>
              <p className="text-sm font-medium font-mono uppercase">
                {bds.find((b) => b.id === reassignDialog.ib?.created_by)?.nombre ?? "Sin asignar"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nuevo BD</p>
              <Select value={targetBD} onValueChange={setTargetBD}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar BD destino" />
                </SelectTrigger>
                <SelectContent>
                  {bds
                    .filter((b) => b.id !== reassignDialog.ib?.created_by && b.status === "approved")
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.nombre} ({b.correo})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialog({ open: false, ib: null })}>
              Cancelar
            </Button>
            <Button onClick={handleReassign} disabled={!targetBD || reassigning}>
              {reassigning ? "Reasignando..." : "Confirmar reasignación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessDevelopers;
