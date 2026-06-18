import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Phone,
  Globe,
  TrendingUp,
  Image as ImageIcon,
  Mic,
  Mail,
  Film,
  Radio,
} from "lucide-react";

type ProviderResult = {
  ok: boolean;
  name: string;
  category: string;
  balance?: number | null;
  currency?: string;
  unit?: string;
  error?: string;
  dashboardUrl?: string;
  meta?: Record<string, any>;
};

type Thresholds = { critical: number; low: number };

// Umbrales por tipo de saldo
const THRESHOLDS: Record<string, Thresholds> = {
  twilio: { critical: 5, low: 20 },
  firecrawl: { critical: 1000, low: 10000 },
  twelvedata: { critical: 50, low: 200 },
  bannerbear: { critical: 50, low: 200 },
  elevenlabs: { critical: 1000, low: 10000 },
  resend: { critical: 0, low: 0 },
  shotstack: { critical: 0, low: 0 },
  livekit: { critical: 0, low: 0 },
};

const ICONS: Record<string, any> = {
  twilio: Phone,
  firecrawl: Globe,
  twelvedata: TrendingUp,
  bannerbear: ImageIcon,
  elevenlabs: Mic,
  resend: Mail,
  shotstack: Film,
  livekit: Radio,
};

function formatBalance(p: ProviderResult): string {
  if (p.balance === null || p.balance === undefined) return "—";
  if (p.unit === "USD") return `$${p.balance.toFixed(2)}`;
  if (p.balance >= 1_000_000) return `${(p.balance / 1_000_000).toFixed(2)}M`;
  if (p.balance >= 1_000) return `${(p.balance / 1_000).toFixed(1)}K`;
  return p.balance.toLocaleString();
}

function getStatus(key: string, p: ProviderResult): "ok" | "low" | "critical" | "info" {
  if (!p.ok) return "critical";
  if (p.balance === null || p.balance === undefined) return "info";
  const t = THRESHOLDS[key];
  if (!t) return "ok";
  if (p.balance <= t.critical && t.critical > 0) return "critical";
  if (p.balance <= t.low && t.low > 0) return "low";
  return "ok";
}

const STATUS_STYLES: Record<string, string> = {
  ok: "border-border",
  low: "border-yellow-500/50 bg-yellow-500/5",
  critical: "border-destructive bg-destructive/5",
  info: "border-border bg-muted/20",
};

export default function ApiBalancesPanel() {
  const [data, setData] = useState<Record<string, ProviderResult> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const fetchBalances = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: invokeError } = await supabase.functions.invoke("api-balances");
      if (invokeError) throw invokeError;
      if (!res?.ok) {
        setError(res?.error ?? "Error desconocido");
      } else {
        setData(res.providers);
        setCheckedAt(res.checked_at);
      }
    } catch (e: any) {
      setError(e.message ?? "Error consultando saldos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const providers = data ? Object.entries(data) : [];
  const criticalCount = providers.filter(([k, p]) => getStatus(k, p) === "critical").length;
  const lowCount = providers.filter(([k, p]) => getStatus(k, p) === "low").length;

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-display font-bold text-foreground">
            Saldos & Cuotas de APIs
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoreo en tiempo real de los servicios externos conectados.
            {checkedAt && (
              <span className="ml-2">
                Última actualización: {new Date(checkedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> {criticalCount} crítico{criticalCount > 1 && "s"}
            </Badge>
          )}
          {lowCount > 0 && (
            <Badge className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
              <AlertTriangle className="w-3 h-3" /> {lowCount} bajo{lowCount > 1 && "s"}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBalances}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando saldos...
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map(([key, p]) => {
          const status = getStatus(key, p);
          const Icon = ICONS[key] ?? Globe;
          return (
            <Card key={key} className={STATUS_STYLES[status]}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span>{p.name}</span>
                  </div>
                  {status === "ok" && (
                    <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                      <CheckCircle2 className="w-3 h-3" /> OK
                    </Badge>
                  )}
                  {status === "low" && (
                    <Badge className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-[10px]">
                      <AlertTriangle className="w-3 h-3" /> Bajo
                    </Badge>
                  )}
                  {status === "critical" && (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <AlertTriangle className="w-3 h-3" /> {p.ok ? "Crítico" : "Error"}
                    </Badge>
                  )}
                  {status === "info" && (
                    <Badge variant="outline" className="text-[10px]">Info</Badge>
                  )}
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">{p.category}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.ok ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-foreground">
                        {formatBalance(p)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {p.currency}
                      </span>
                    </div>
                    {p.meta?.used !== undefined && p.meta?.limit !== undefined && (
                      <div className="space-y-1">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              status === "critical"
                                ? "bg-destructive"
                                : status === "low"
                                ? "bg-yellow-500"
                                : "bg-primary"
                            }`}
                            style={{
                              width: `${Math.min(100, (p.meta.used / p.meta.limit) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {p.meta.used.toLocaleString()} / {p.meta.limit.toLocaleString()} usados
                        </p>
                      </div>
                    )}
                    {p.meta?.note && (
                      <p className="text-[10px] text-muted-foreground italic border-t border-border pt-2">
                        {p.meta.note}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-destructive">{p.error}</p>
                )}
                {p.dashboardUrl && (
                  <a
                    href={p.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline pt-1"
                  >
                    Ir al dashboard <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
