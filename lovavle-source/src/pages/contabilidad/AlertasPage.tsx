import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Alert {
  id: string; budget_line_id: string; period_label: string; severity: "info" | "warning" | "critical";
  message: string; planned_usd: number; actual_usd: number; variance_pct: number;
  acknowledged_by: string | null; acknowledged_at: string | null; created_at: string;
}

export default function AlertasPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("accounting_budget_alerts")
      .select("*").order("created_at", { ascending: false }).limit(200);
    setRows((data ?? []) as Alert[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const ack = async (id: string) => {
    const { error } = await supabase.from("accounting_budget_alerts").update({
      acknowledged_by: user?.id, acknowledged_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("budget-variance-analyzer", { body: {} });
      if (error) throw error;
      toast.success(`${data?.alerts_created ?? 0} alertas nuevas`);
      load();
    } catch (e: any) { toast.error(e.message); }
    setRunning(false);
  };

  const sev = (s: string) => <Badge variant={s === "critical" ? "destructive" : s === "warning" ? "secondary" : "default"}>{s}</Badge>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-amber-500" /> Alertas de Presupuesto</h2>
          <p className="text-muted-foreground text-sm">Cron horario detecta líneas sobre/críticas. Marca como reconocidas cuando se aborden.</p>
        </div>
        <Button onClick={runNow} disabled={running}>{running ? "Analizando…" : "Analizar ahora"}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{rows.filter(r => !r.acknowledged_at).length} pendientes · {rows.length} totales</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-muted-foreground">Cargando…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr><th className="py-2">Fecha</th><th>Período</th><th>Sev.</th><th>Mensaje</th><th>Var %</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map(a => (
                    <tr key={a.id} className={`border-b ${a.acknowledged_at ? "opacity-50" : ""}`}>
                      <td className="py-2 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                      <td>{a.period_label}</td>
                      <td>{sev(a.severity)}</td>
                      <td className="max-w-md">{a.message}</td>
                      <td className="text-right font-mono">{Number(a.variance_pct).toFixed(1)}%</td>
                      <td className="text-right">
                        {!a.acknowledged_at && <Button size="sm" variant="outline" onClick={() => ack(a.id)}><Check className="h-3 w-3 mr-1" />OK</Button>}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Sin alertas</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
