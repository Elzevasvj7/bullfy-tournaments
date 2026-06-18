import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Users, Building2, GitBranch, Download, Search, LayoutGrid, TableIcon, BarChart3 } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface IBRow {
  id: string;
  nombre_ib: string;
  correo_ib: string;
  nombre_bd: string;
  modelo_negocio: string;
  status: string;
  created_at: string;
  lotes_por_mes: number | null;
  depositos_por_mes: number | null;
  clientes_por_mes: number | null;
  tipo_persona: string;
  lugar_operacion: string;
}

interface SubIBRow {
  id: string;
  ib_id: string;
  nombre: string;
  correo: string;
  es_master_ib: boolean;
  dolares_por_lote: number | null;
  created_at: string;
}

interface BDGroup {
  bd: string;
  ibs: IBRow[];
  subIbs: (SubIBRow & { ibName: string })[];
  totalLotes: number;
  totalDepositos: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  en_proceso: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  configurado: "bg-green-500/10 text-green-700 dark:text-green-300",
  rechazado: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const ReportePorBD = () => {
  const [ibs, setIbs] = useState<IBRow[]>([]);
  const [subIbs, setSubIbs] = useState<SubIBRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBD, setFilterBD] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterModelo, setFilterModelo] = useState<string>("all");

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: ibData, error: ibErr }, { data: subData, error: subErr }] = await Promise.all([
        supabase
          .from("ibs")
          .select("id, nombre_ib, correo_ib, nombre_bd, modelo_negocio, status, created_at, lotes_por_mes, depositos_por_mes, clientes_por_mes, tipo_persona, lugar_operacion")
          .order("nombre_bd", { ascending: true }),
        supabase
          .from("sub_ibs")
          .select("id, ib_id, nombre, correo, es_master_ib, dolares_por_lote, created_at"),
      ]);
      if (ibErr) throw ibErr;
      if (subErr) throw subErr;
      setIbs((ibData ?? []) as IBRow[]);
      setSubIbs((subData ?? []) as SubIBRow[]);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el reporte");
    } finally {
      setLoading(false);
    }
  };

  const bdOptions = useMemo(() => {
    const set = new Set(ibs.map((i) => i.nombre_bd).filter(Boolean));
    return Array.from(set).sort();
  }, [ibs]);

  const modeloOptions = useMemo(() => {
    const set = new Set(ibs.map((i) => i.modelo_negocio).filter(Boolean));
    return Array.from(set).sort();
  }, [ibs]);

  const statusOptions = useMemo(() => {
    const set = new Set(ibs.map((i) => i.status).filter(Boolean));
    return Array.from(set).sort();
  }, [ibs]);

  const filteredIbs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ibs.filter((ib) => {
      if (filterBD !== "all" && ib.nombre_bd !== filterBD) return false;
      if (filterStatus !== "all" && ib.status !== filterStatus) return false;
      if (filterModelo !== "all" && ib.modelo_negocio !== filterModelo) return false;
      if (q) {
        const hay = `${ib.nombre_ib} ${ib.correo_ib} ${ib.nombre_bd}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ibs, filterBD, filterStatus, filterModelo, search]);

  const groups = useMemo<BDGroup[]>(() => {
    const map = new Map<string, BDGroup>();
    filteredIbs.forEach((ib) => {
      const bdKey = ib.nombre_bd || "Sin BD";
      if (!map.has(bdKey)) {
        map.set(bdKey, { bd: bdKey, ibs: [], subIbs: [], totalLotes: 0, totalDepositos: 0 });
      }
      const g = map.get(bdKey)!;
      g.ibs.push(ib);
      g.totalLotes += ib.lotes_por_mes ?? 0;
      g.totalDepositos += ib.depositos_por_mes ?? 0;
      const ibSubs = subIbs
        .filter((s) => s.ib_id === ib.id)
        .map((s) => ({ ...s, ibName: ib.nombre_ib }));
      g.subIbs.push(...ibSubs);
    });
    return Array.from(map.values()).sort((a, b) => a.bd.localeCompare(b.bd));
  }, [filteredIbs, subIbs]);

  const chartData = useMemo(
    () =>
      groups.map((g) => ({
        bd: g.bd,
        IBs: g.ibs.length,
        "Sub IBs": g.subIbs.length,
      })),
    [groups]
  );

  const totals = useMemo(
    () => ({
      bds: groups.length,
      ibs: groups.reduce((acc, g) => acc + g.ibs.length, 0),
      subIbs: groups.reduce((acc, g) => acc + g.subIbs.length, 0),
      lotes: groups.reduce((acc, g) => acc + g.totalLotes, 0),
    }),
    [groups]
  );

  const exportCSV = () => {
    const rows: string[] = [
      ["BD", "Tipo", "Nombre", "Correo", "IB Principal", "Modelo", "Estado", "Lotes/Mes", "Depósitos/Mes", "Fecha"].join(","),
    ];
    groups.forEach((g) => {
      g.ibs.forEach((ib) => {
        rows.push(
          [
            g.bd,
            "IB",
            ib.nombre_ib,
            ib.correo_ib,
            "-",
            ib.modelo_negocio,
            ib.status,
            ib.lotes_por_mes ?? 0,
            ib.depositos_por_mes ?? 0,
            new Date(ib.created_at).toLocaleDateString(),
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        );
      });
      g.subIbs.forEach((s) => {
        rows.push(
          [
            g.bd,
            s.es_master_ib ? "Master IB" : "Sub IB",
            s.nombre,
            s.correo,
            s.ibName,
            "-",
            "-",
            "-",
            "-",
            new Date(s.created_at).toLocaleDateString(),
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        );
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-por-bd-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Business Developers</p>
                <p className="text-2xl font-bold">{totals.bds}</p>
              </div>
              <Users className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total IBs</p>
                <p className="text-2xl font-bold">{totals.ibs}</p>
              </div>
              <Building2 className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Sub IBs</p>
                <p className="text-2xl font-bold">{totals.subIbs}</p>
              </div>
              <GitBranch className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-muted-foreground">Lotes/Mes (estimado)</p>
              <p className="text-2xl font-bold">{totals.lotes.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar IB, correo o BD..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterBD} onValueChange={setFilterBD}>
              <SelectTrigger><SelectValue placeholder="BD" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los BD</SelectItem>
                {bdOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterModelo} onValueChange={setFilterModelo}>
              <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los modelos</SelectItem>
                {modeloOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vistas */}
      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards" className="gap-1.5"><LayoutGrid className="w-4 h-4" /> Tarjetas</TabsTrigger>
          <TabsTrigger value="table" className="gap-1.5"><TableIcon className="w-4 h-4" /> Tabla</TabsTrigger>
          <TabsTrigger value="chart" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Gráfico</TabsTrigger>
        </TabsList>

        {/* Tarjetas agrupadas */}
        <TabsContent value="cards" className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay datos con los filtros seleccionados.</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <Card key={g.bd}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        {g.bd}
                      </CardTitle>
                      <div className="flex gap-2 text-xs">
                        <Badge variant="outline">{g.ibs.length} IBs</Badge>
                        <Badge variant="outline">{g.subIbs.length} Sub IBs</Badge>
                        <Badge variant="outline">{g.totalLotes.toLocaleString()} lotes/mes</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {g.ibs.map((ib) => {
                      const ibSubs = g.subIbs.filter((s) => s.ibName === ib.nombre_ib);
                      return (
                        <div key={ib.id} className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{ib.nombre_ib}</p>
                              <p className="text-xs text-muted-foreground truncate">{ib.correo_ib}</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge className={STATUS_COLORS[ib.status] ?? ""}>{ib.status}</Badge>
                              <Badge variant="secondary">{ib.modelo_negocio}</Badge>
                              <Badge variant="outline">{ib.tipo_persona}</Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                            <div><span className="text-muted-foreground">Lotes/mes:</span> <strong>{ib.lotes_por_mes ?? 0}</strong></div>
                            <div><span className="text-muted-foreground">Depósitos/mes:</span> <strong>${(ib.depositos_por_mes ?? 0).toLocaleString()}</strong></div>
                            <div><span className="text-muted-foreground">Clientes/mes:</span> <strong>{ib.clientes_por_mes ?? 0}</strong></div>
                            <div><span className="text-muted-foreground">Alta:</span> <strong>{new Date(ib.created_at).toLocaleDateString()}</strong></div>
                          </div>
                          {ibSubs.length > 0 && (
                            <div className="mt-3 pl-3 border-l-2 border-primary/30 space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Sub IBs ({ibSubs.length}):</p>
                              {ibSubs.map((s) => (
                                <div key={s.id} className="flex items-center justify-between text-xs">
                                  <span>
                                    <GitBranch className="w-3 h-3 inline mr-1" />
                                    {s.nombre} <span className="text-muted-foreground">({s.correo})</span>
                                  </span>
                                  {s.es_master_ib && <Badge variant="outline" className="text-[10px]">Master</Badge>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tabla plana */}
        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BD</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>IB Principal</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Lotes/Mes</TableHead>
                    <TableHead className="text-right">Depósitos/Mes</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.flatMap((g) => [
                    ...g.ibs.map((ib) => (
                      <TableRow key={`ib-${ib.id}`}>
                        <TableCell className="font-medium">{g.bd}</TableCell>
                        <TableCell><Badge>IB</Badge></TableCell>
                        <TableCell>{ib.nombre_ib}</TableCell>
                        <TableCell className="text-xs">{ib.correo_ib}</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell><Badge variant="secondary">{ib.modelo_negocio}</Badge></TableCell>
                        <TableCell><Badge className={STATUS_COLORS[ib.status] ?? ""}>{ib.status}</Badge></TableCell>
                        <TableCell className="text-right">{ib.lotes_por_mes ?? 0}</TableCell>
                        <TableCell className="text-right">${(ib.depositos_por_mes ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{new Date(ib.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    )),
                    ...g.subIbs.map((s) => (
                      <TableRow key={`sub-${s.id}`} className="bg-muted/30">
                        <TableCell className="font-medium">{g.bd}</TableCell>
                        <TableCell><Badge variant="outline">{s.es_master_ib ? "Master IB" : "Sub IB"}</Badge></TableCell>
                        <TableCell>{s.nombre}</TableCell>
                        <TableCell className="text-xs">{s.correo}</TableCell>
                        <TableCell>{s.ibName}</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell className="text-right text-muted-foreground">—</TableCell>
                        <TableCell className="text-right text-muted-foreground">—</TableCell>
                        <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    )),
                  ])}
                  {groups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No hay datos con los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gráfico */}
        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución de IBs y Sub IBs por BD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="bd" angle={-30} textAnchor="end" height={80} className="text-xs" />
                    <YAxis className="text-xs" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="IBs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Sub IBs" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportePorBD;
