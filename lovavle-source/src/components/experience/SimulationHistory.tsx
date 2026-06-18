import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, Search, Filter, Eye, Calendar, Wrench, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useExperienceSession } from "@/hooks/useExperienceSession";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Simulation {
  id: string;
  tool_name: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  created_at: string;
}

const TOOL_LABELS: Record<string, string> = {
  revenue: "IB Revenue Simulator",
  growth: "Growth Projection Engine",
  community: "Community Value Calculator",
  "risk-lot": "Risk Lot Size Calculator",
  "pip-value": "Pip Value Calculator",
  empire: "IB Empire Builder",
  rank: "IB Rank Simulator",
  funnel: "Funnel Builder",
  propfirm: "PropFirm Simulator",
  network: "Network Simulator",
  comparison: "Broker Comparison",
  score: "IB Success Score",
  advisor: "AI IB Advisor",
};

const TOOL_CATEGORIES: Record<string, string> = {
  revenue: "Core", growth: "Core", community: "Core",
  "risk-lot": "Trading", "pip-value": "Trading",
  empire: "Avanzado", rank: "Gamificación", funnel: "Marketing",
  propfirm: "Trading", network: "Avanzado", comparison: "Análisis",
  score: "Gamificación", advisor: "AI",
};

const categoryColor = (cat: string) => {
  const map: Record<string, string> = {
    Core: "bg-primary/10 text-primary border-primary/20",
    Trading: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    Avanzado: "bg-chart-4/10 text-chart-4 border-chart-4/20",
    Gamificación: "bg-chart-5/10 text-chart-5 border-chart-5/20",
    Marketing: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    Análisis: "bg-accent text-accent-foreground border-border",
    AI: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  };
  return map[cat] ?? "bg-muted text-muted-foreground border-border";
};

const formatValue = (val: unknown): string => {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") return val.toLocaleString("es-MX", { maximumFractionDigits: 2 });
  if (typeof val === "boolean") return val ? "Sí" : "No";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

const SimulationHistory = () => {
  const { sessionId } = useExperienceSession();
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toolFilter, setToolFilter] = useState("all");
  const [detail, setDetail] = useState<Simulation | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("experience_simulations")
        .select("id, tool_name, inputs, results, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      setSimulations((data as Simulation[]) ?? []);
      setLoading(false);
    };
    load();
  }, [sessionId]);

  const toolOptions = useMemo(() => {
    const unique = [...new Set(simulations.map(s => s.tool_name))];
    return unique.sort();
  }, [simulations]);

  const filtered = useMemo(() => {
    let list = simulations;
    if (toolFilter !== "all") list = list.filter(s => s.tool_name === toolFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (TOOL_LABELS[s.tool_name] ?? s.tool_name).toLowerCase().includes(q) ||
        JSON.stringify(s.results).toLowerCase().includes(q)
      );
    }
    return list;
  }, [simulations, toolFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <History className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Historial</span>
          </div>
          <h1 className="text-2xl font-bold">Mis Simulaciones</h1>
          <p className="text-sm text-muted-foreground">
            {simulations.length} simulación{simulations.length !== 1 ? "es" : ""} en esta sesión
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{simulations.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <Wrench className="w-5 h-5 text-chart-2 mx-auto mb-1" />
            <p className="text-2xl font-bold">{toolOptions.length}</p>
            <p className="text-xs text-muted-foreground">Herramientas</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <Calendar className="w-5 h-5 text-chart-4 mx-auto mb-1" />
            <p className="text-2xl font-bold">
              {simulations.length > 0
                ? format(new Date(simulations[0].created_at), "dd MMM", { locale: es })
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Última</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <Filter className="w-5 h-5 text-chart-3 mx-auto mb-1" />
            <p className="text-2xl font-bold">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Mostrando</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar simulación..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={toolFilter} onValueChange={setToolFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Todas las herramientas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las herramientas</SelectItem>
            {toolOptions.map(t => (
              <SelectItem key={t} value={t}>{TOOL_LABELS[t] ?? t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-12 text-center space-y-2">
            <History className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Sin simulaciones</p>
            <p className="text-sm text-muted-foreground">
              {simulations.length === 0
                ? "Aún no has realizado ninguna simulación. ¡Prueba una herramienta!"
                : "No hay simulaciones que coincidan con tu búsqueda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-card/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Herramienta</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(sim => {
                  const cat = TOOL_CATEGORIES[sim.tool_name] ?? "Otro";
                  return (
                    <TableRow key={sim.id}>
                      <TableCell className="font-medium">
                        {TOOL_LABELS[sim.tool_name] ?? sim.tool_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={categoryColor(cat)}>{cat}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(sim.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(sim)} className="gap-1.5">
                          <Eye className="w-4 h-4" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  {TOOL_LABELS[detail.tool_name] ?? detail.tool_name}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(detail.created_at), "dd MMMM yyyy, HH:mm:ss", { locale: es })}
                </p>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Inputs */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Inputs</h4>
                  <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-1.5">
                    {Object.entries(detail.inputs).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin datos de entrada</p>
                    ) : (
                      Object.entries(detail.inputs).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm gap-2">
                          <span className="text-muted-foreground truncate">{k}</span>
                          <span className="font-medium text-right">{formatValue(v)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Results */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resultados</h4>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                    {Object.entries(detail.results).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin resultados</p>
                    ) : (
                      Object.entries(detail.results).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm gap-2">
                          <span className="text-muted-foreground truncate">{k}</span>
                          <span className="font-bold text-primary text-right">{formatValue(v)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SimulationHistory;
