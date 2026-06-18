import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Eye, ArrowRight, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_fields: string[] | null;
  user_id: string | null;
  created_at: string;
}

const TABLE_OPTIONS = [
  { value: "all", label: "Todas las tablas" },
  { value: "ops_queue", label: "Cola de trabajo" },
  { value: "ops_requests", label: "Solicitudes" },
  { value: "ibs", label: "IBs" },
  { value: "profiles", label: "Perfiles" },
  { value: "reports", label: "Reportes" },
  { value: "sub_ibs", label: "Sub IBs" },
];

const ACTION_OPTIONS = [
  { value: "all", label: "Todas las acciones" },
  { value: "INSERT", label: "Creación" },
  { value: "UPDATE", label: "Actualización" },
  { value: "DELETE", label: "Eliminación" },
];

const PAGE_SIZE = 25;

const AuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, nombre");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => { map[p.id] = p.nombre; });
      setProfilesMap(map);
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
    if (actionFilter !== "all") query = query.eq("action", actionFilter);
    if (searchTerm.trim()) query = query.ilike("record_id", `%${searchTerm.trim()}%`);

    const { data, error, count } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setEntries((data as AuditEntry[]) ?? []);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [tableFilter, actionFilter, searchTerm, page]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { setPage(0); }, [tableFilter, actionFilter, searchTerm]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const actionBadge = (action: string) => {
    const map: Record<string, string> = {
      INSERT: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      UPDATE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      DELETE: "bg-destructive/20 text-destructive border-destructive/30",
    };
    const labels: Record<string, string> = { INSERT: "Creación", UPDATE: "Actualización", DELETE: "Eliminación" };
    return <Badge className={map[action] || ""}>{labels[action] || action}</Badge>;
  };

  const tableLabel = (name: string) => {
    const found = TABLE_OPTIONS.find((t) => t.value === name);
    return found ? found.label : name;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABLE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID de registro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando registros...
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No se encontraron registros de auditoría</p>
        </div>
      ) : (
        <div className="bg-gradient-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Fecha</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Tabla</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Acción</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Usuario</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Campos</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs">{tableLabel(entry.table_name)}</Badge>
                    </td>
                    <td className="p-4">{actionBadge(entry.action)}</td>
                    <td className="p-4 text-sm text-foreground">
                      {entry.user_id ? (profilesMap[entry.user_id] || entry.user_id.slice(0, 8) + "...") : "Sistema"}
                    </td>
                    <td className="p-4">
                      {entry.changed_fields && entry.changed_fields.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.changed_fields.slice(0, 3).map((f) => (
                            <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                          ))}
                          {entry.changed_fields.length > 3 && (
                            <Badge variant="secondary" className="text-xs">+{entry.changed_fields.length - 3}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Button size="sm" variant="ghost" onClick={() => setDetailEntry(entry)} className="text-primary hover:text-primary gap-1">
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{totalCount} registros — Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailEntry} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle de auditoría
              {detailEntry && actionBadge(detailEntry.action)}
            </DialogTitle>
          </DialogHeader>
          {detailEntry && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 text-sm">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Tabla</p>
                    <p className="text-foreground font-medium">{tableLabel(detailEntry.table_name)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ID del registro</p>
                    <p className="text-foreground font-mono text-xs">{detailEntry.record_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Usuario</p>
                    <p className="text-foreground">{detailEntry.user_id ? (profilesMap[detailEntry.user_id] || detailEntry.user_id) : "Sistema"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="text-foreground">{formatDate(detailEntry.created_at)}</p>
                  </div>
                </div>

                {/* Changed fields for UPDATE */}
                {detailEntry.action === "UPDATE" && detailEntry.changed_fields && detailEntry.changed_fields.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Campos modificados</p>
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {detailEntry.changed_fields.map((field) => (
                        <div key={field} className="p-3 flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs shrink-0">{field}</Badge>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-destructive/80 text-xs truncate bg-destructive/10 px-2 py-0.5 rounded">
                              {detailEntry.old_data?.[field] !== undefined ? String(detailEntry.old_data[field]) : "—"}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-emerald-400 text-xs truncate bg-emerald-500/10 px-2 py-0.5 rounded">
                              {detailEntry.new_data?.[field] !== undefined ? String(detailEntry.new_data[field]) : "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full data for INSERT */}
                {detailEntry.action === "INSERT" && detailEntry.new_data && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Datos creados</p>
                    <pre className="bg-secondary/30 rounded-lg p-3 text-xs overflow-auto text-foreground">
                      {JSON.stringify(detailEntry.new_data, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Full data for DELETE */}
                {detailEntry.action === "DELETE" && detailEntry.old_data && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Datos eliminados</p>
                    <pre className="bg-destructive/10 rounded-lg p-3 text-xs overflow-auto text-foreground">
                      {JSON.stringify(detailEntry.old_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLog;
