import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import NewTransferDialog from "@/components/contabilidad/NewTransferDialog";
import TransferDetailDialog from "@/components/contabilidad/TransferDetailDialog";

const STATUS: Record<string, { label: string; tone: string }> = {
  pending_sender_proof: { label: "Pendiente comprobante envío", tone: "bg-amber-500/20 text-amber-500" },
  pending_recipient_receipt: { label: "Pendiente recibo destinatario", tone: "bg-blue-500/20 text-blue-500" },
  partially_justified: { label: "Parcialmente justificada", tone: "bg-indigo-500/20 text-indigo-500" },
  fully_justified: { label: "Justificada", tone: "bg-emerald-500/20 text-emerald-500" },
  closed: { label: "Cerrada", tone: "bg-muted" },
  disputed: { label: "En disputa", tone: "bg-rose-500/20 text-rose-500" },
  returned: { label: "Devuelta", tone: "bg-muted" },
};

interface Transfer {
  id: string; sender_user_id: string; recipient_user_id: string;
  amount_original: number; currency_original: string; amount_usd: number | null;
  amount_justified_usd: number | null; status: string; transfer_date: string;
  purpose: string | null;
}

export default function TesoreriaPage() {
  const [rows, setRows] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("accounting_treasury_transfers").select("*").order("transfer_date", { ascending: false }).limit(100);
    setRows((data ?? []) as Transfer[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tesorería</h2>
          <p className="text-muted-foreground text-sm">
            Envío de fondos con comprobantes, notas en tiempo real y justificación N:N (varios recibos por transferencia).
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" />Nueva transferencia</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-6 text-muted-foreground">Cargando…</div> :
            rows.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">Sin transferencias aún.</div>
            ) : (
            <div className="divide-y">
              {rows.map((r) => {
                const s = STATUS[r.status] ?? { label: r.status, tone: "" };
                const just = Number(r.amount_justified_usd ?? 0);
                const tot = Number(r.amount_usd ?? 0);
                const pct = tot > 0 ? Math.min(100, Math.round((just / tot) * 100)) : 0;
                return (
                  <button key={r.id} onClick={() => setDetailId(r.id)}
                    className="w-full text-left p-3 hover:bg-muted/40 transition-colors space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary" className={s.tone}>{s.label}</Badge>
                      <span className="text-xs text-muted-foreground">{r.transfer_date}</span>
                      <span className="text-sm flex-1 truncate">{r.purpose ?? "—"}</span>
                      <span className="text-sm">{Number(r.amount_original).toLocaleString()} {r.currency_original}</span>
                      <span className="text-sm font-semibold">{tot > 0 ? `$${tot.toFixed(2)} USD` : "—"}</span>
                    </div>
                    {tot > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 bg-muted rounded-full flex-1 overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}% justificado</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <NewTransferDialog open={openNew} onOpenChange={setOpenNew} onCreated={load} />
      {detailId && (
        <TransferDetailDialog transferId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
      )}
    </div>
  );
}
