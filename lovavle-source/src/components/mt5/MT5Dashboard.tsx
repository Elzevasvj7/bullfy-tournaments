import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMT5Connection } from "@/hooks/useMT5Connection";
import { mt5GetStats, type MT5Stats } from "@/services/mt5Api";
import { useQuery } from "@tanstack/react-query";
import { Users, DollarSign, TrendingUp, BarChart3, Activity, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MT5Dashboard = () => {
  const { connected } = useMT5Connection();

  const { data: stats, isLoading, error } = useQuery<MT5Stats>({
    queryKey: ["mt5-stats"],
    queryFn: mt5GetStats,
    enabled: connected,
    refetchInterval: 30000,
  });

  if (!connected) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Conéctate a la API de MT5 desde la pestaña <strong>Configuración</strong> para ver el dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-destructive text-sm">{(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { label: "Total Cuentas", value: stats?.total_accounts, icon: Users, fmt: (v: number) => String(v) },
    { label: "Balance Total", value: stats?.total_balance, icon: DollarSign, fmt: (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Equity Total", value: stats?.total_equity, icon: TrendingUp, fmt: (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Profit Total", value: stats?.total_profit, icon: BarChart3, fmt: (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Total Trades", value: stats?.total_trades, icon: Layers, fmt: (v: number) => String(v) },
    { label: "Trades Activos", value: stats?.active_trades, icon: Activity, fmt: (v: number) => String(v) },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map(({ label, value, icon: Icon, fmt }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{value !== undefined ? fmt(value) : "—"}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MT5Dashboard;
