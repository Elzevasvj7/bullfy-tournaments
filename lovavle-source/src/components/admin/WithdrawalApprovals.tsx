import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Check, X, RefreshCw, Banknote } from "lucide-react";

interface PendingWithdrawal {
  id: string;
  request_number: string | null;
  amount_requested: number;
  fee_amount: number;
  amount_net: number;
  currency: string;
  network: string | null;
  destination_address: string | null;
  payout_method: string | null;
  created_at: string;
  partner_users?: { nombre: string | null; email: string | null } | null;
  partner_portals?: { nombre_portal: string | null } | null;
}

const fmt = (n: number | string) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WithdrawalApprovals = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PendingWithdrawal[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mlm-withdrawal-review", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data && !data.ok) throw new Error(data.error || "Error");
      setRows((data?.withdrawals as PendingWithdrawal[]) ?? []);
    } catch (e: any) {
      toast.error("No se pudieron cargar los retiros: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "approve" | "reject") => {
    if (action === "reject" && !confirm("¿Rechazar este retiro? Se reintegrará el saldo al IB.")) return;
    if (action === "approve" && !confirm("¿Aprobar este retiro? Se creará el payout en NOWPayments (quedará pendiente de aprobación en el dashboard de NOWPayments).")) return;
    setActing(id);
    try {
      const { data, error } = await supabase.functions.invoke("mlm-withdrawal-review", {
        body: { action, withdrawal_id: id },
      });
      if (error) throw error;
      if (data && !data.ok) throw new Error(data.error || "Error");
      toast.success(action === "approve" ? "Retiro aprobado y enviado a NOWPayments" : "Retiro rechazado; saldo reintegrado");
      await load();
    } catch (e: any) {
      toast.error("Error: " + (e.message || e));
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" /> Retiros pendientes
          </h1>
          <p className="text-sm text-muted-foreground">Aprueba o rechaza las solicitudes de retiro cripto de los IBs.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No hay retiros pendientes de aprobación.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((w) => (
            <Card key={w.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="font-mono">{w.request_number || w.id.slice(0, 8)}</span>
                  <Badge variant="secondary" className="text-xs">{w.network || "—"} · {w.payout_method}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">IB:</span> {w.partner_users?.nombre || "—"}<br /><span className="text-xs text-muted-foreground">{w.partner_users?.email || ""}</span></div>
                  <div><span className="text-muted-foreground">Portal:</span> {w.partner_portals?.nombre_portal || "—"}</div>
                  <div><span className="text-muted-foreground">Solicitado:</span> {fmt(w.amount_requested)} {w.currency}</div>
                  <div><span className="text-muted-foreground">Fee:</span> {fmt(w.fee_amount)} · <span className="text-muted-foreground">Neto:</span> <strong>{fmt(w.amount_net)}</strong></div>
                </div>
                <div className="break-all text-xs"><span className="text-muted-foreground">Destino:</span> <span className="font-mono">{w.destination_address || "—"}</span></div>
                <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString("es")}</div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" disabled={acting === w.id} onClick={() => act(w.id, "approve")} className="gap-1.5">
                    {acting === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprobar
                  </Button>
                  <Button size="sm" variant="destructive" disabled={acting === w.id} onClick={() => act(w.id, "reject")} className="gap-1.5">
                    <X className="w-4 h-4" /> Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WithdrawalApprovals;
