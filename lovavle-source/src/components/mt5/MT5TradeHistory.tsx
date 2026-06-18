import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMT5Connection } from "@/hooks/useMT5Connection";
import { mt5GetDeals } from "@/services/mt5Api";
import { useQuery } from "@tanstack/react-query";
import { History, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface MT5Deal {
  ticket: number;
  login: number;
  symbol: string;
  action: string;
  entry: string;
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  group: string;
  time: string;
}

interface DealsResponse {
  items: MT5Deal[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MT5TradeHistory = () => {
  const { connected } = useMT5Connection();
  const [symbolFilter, setSymbolFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading, error, refetch } = useQuery<DealsResponse>({
    queryKey: ["mt5-deals", symbolFilter, page],
    queryFn: async () => {
      const token = localStorage.getItem("bullfy_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (symbolFilter) params.set("symbol", symbolFilter);

      const res = await fetch(`https://api.bullfytech.online/api/mt5/deals?${params}`, { headers });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Error en la API");
      return json.data as DealsResponse;
    },
    enabled: connected,
  });

  const deals = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  if (!connected) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Conéctate a la API para ver el historial de operaciones.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-lg">Historial de Deals</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filtrar por símbolo..."
            value={symbolFilter}
            onChange={(e) => { setSymbolFilter(e.target.value); setPage(1); }}
            className="w-40 h-9"
          />
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-destructive text-sm mb-4">{(error as Error).message}</p>}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !deals.length ? (
          <p className="text-muted-foreground text-sm text-center py-8">No se encontraron deals.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Símbolo</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead className="text-right">Volumen</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                    <TableHead className="text-right">Swap</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((d) => (
                    <TableRow key={d.ticket}>
                      <TableCell className="font-mono text-sm">{d.ticket}</TableCell>
                      <TableCell>{d.login}</TableCell>
                      <TableCell className="font-medium">{d.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={d.action?.toLowerCase().includes("buy") ? "default" : "secondary"}>
                          {d.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{d.entry}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{d.volume}</TableCell>
                      <TableCell className="text-right">{d.price}</TableCell>
                      <TableCell className={`text-right font-medium ${(d.profit ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        ${(d.profit ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${(d.commission ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${(d.swap ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {d.time ? new Date(d.time).toLocaleString("es-ES") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                Página {data?.page ?? page} de {totalPages} — {totalCount} deals en total
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MT5TradeHistory;
