import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Download, RefreshCw, Search, Database } from "lucide-react";

interface BrokerSymbol {
  id: string;
  symbol: string;
  description: string | null;
  category: string | null;
  digits: number | null;
  contract_size: number | null;
  min_volume: number | null;
  enabled: boolean;
  last_synced_at: string;
}

interface SyncLog {
  id: string;
  status: string;
  symbols_count: number;
  inserted_count: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

const MetaAPISettings = () => {
  const [loading, setLoading] = useState(false);
  const [symbols, setSymbols] = useState<BrokerSymbol[]>([]);
  const [lastLog, setLastLog] = useState<SyncLog | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const loadSymbols = async () => {
    const { data, error } = await supabase
      .from("broker_symbols")
      .select("id, symbol, description, category, digits, contract_size, min_volume, enabled, last_synced_at")
      .order("symbol", { ascending: true })
      .limit(1000);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setSymbols(data || []);
  };

  const loadLastLog = async () => {
    const { data } = await supabase
      .from("broker_symbols_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastLog(data);
  };

  useEffect(() => {
    loadSymbols();
    loadLastLog();
  }, []);

  const handleSync = async () => {
    setLoading(true);
    toast({
      title: "Sincronizando…",
      description: "Activando cuenta MetaAPI y descargando símbolos. Esto puede tardar 1-2 minutos.",
    });
    try {
      const { data, error } = await supabase.functions.invoke("metaapi-sync-symbols", {
        body: {},
      });
      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.error || "Sync falló");
      }
      toast({
        title: "✅ Sincronización completa",
        description: `${data.inserted} símbolos guardados de ${data.total} totales (${Math.round((data.duration_ms || 0) / 1000)}s).`,
      });
      await loadSymbols();
      await loadLastLog();
    } catch (e: any) {
      toast({
        title: "Error en sincronización",
        description: e.message || "Error desconocido",
        variant: "destructive",
      });
      await loadLastLog();
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(symbols.map((s) => s.category).filter(Boolean))) as string[];

  const filtered = symbols.filter((s) => {
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    if (search && !s.symbol.toLowerCase().includes(search.toLowerCase()) && !(s.description || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              MetaAPI — Catálogo de Símbolos del Broker
            </CardTitle>
            <CardDescription>
              Sincroniza los nombres exactos de los símbolos del broker desde MetaAPI y guárdalos en base de datos para reutilizarlos en otros módulos del sistema.
            </CardDescription>
          </div>
          <Button onClick={handleSync} disabled={loading} size="lg">
            {loading ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Sincronizando…</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Obtener Activos</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last sync info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Total símbolos</div>
            <div className="text-2xl font-bold">{symbols.length}</div>
          </div>
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Última sync</div>
            <div className="text-sm font-medium">
              {lastLog ? new Date(lastLog.created_at).toLocaleString() : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Estado</div>
            <Badge variant={lastLog?.status === "success" ? "default" : lastLog?.status === "error" ? "destructive" : "secondary"}>
              {lastLog?.status || "Sin datos"}
            </Badge>
          </div>
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Duración</div>
            <div className="text-sm font-medium">
              {lastLog?.duration_ms ? `${Math.round(lastLog.duration_ms / 1000)}s` : "—"}
            </div>
          </div>
        </div>

        {lastLog?.error_message && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <strong>Error última sync:</strong> {lastLog.error_message}
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          ⚡ <strong>Modo bajo consumo:</strong> La cuenta MetaAPI se activa solo durante la descarga y se desactiva automáticamente al finalizar para no consumir saldo.
        </div>

        {/* Filters */}
        {symbols.length > 0 && (
          <>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar símbolo o descripción…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="rounded-md border border-border max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Símbolo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Dígitos</TableHead>
                    <TableHead className="text-right">Contract Size</TableHead>
                    <TableHead className="text-right">Min Vol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono font-semibold">{s.symbol}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{s.category || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{s.digits ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">{s.contract_size ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">{s.min_volume ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Mostrando {Math.min(filtered.length, 500)} de {filtered.length} símbolos filtrados.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MetaAPISettings;
