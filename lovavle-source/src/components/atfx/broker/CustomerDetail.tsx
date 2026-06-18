import { useATFX } from "@/hooks/useATFX";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtUSD } from "../utils";

interface Props { id: string; onBack: () => void; }

export default function CustomerDetail({ id, onBack }: Props) {
  const detail = useATFX("customer_detail", { id });
  const accounts = useATFX("customer_accounts", { id });
  const txs = useATFX("customer_transactions", { id, limit: 500 });

  const c = (detail.data?.data as any) ?? {};

  const accCols: ColumnDef<any>[] = [
    { key: "login", label: "Login" },
    { key: "platform", label: "Plataforma" },
    { key: "currency", label: "Moneda" },
    { key: "balance", label: "Balance", render: (r) => fmtUSD(r.balance) },
    { key: "equity", label: "Equity", render: (r) => fmtUSD(r.equity) },
    { key: "leverage", label: "Apalanc." },
  ];
  const txCols: ColumnDef<any>[] = [
    { key: "created_at", label: "Fecha" },
    { key: "type", label: "Tipo" },
    { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
    { key: "currency", label: "Moneda" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Volver</Button>
      <Card>
        <CardHeader><CardTitle>{c.first_name} {c.last_name} <span className="text-muted-foreground text-sm">— {c.email}</span></CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-muted-foreground text-xs">ID</p><p>{c.id}</p></div>
          <div><p className="text-muted-foreground text-xs">País</p><p>{c.country || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Entorno</p><p>{c.env_mode || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Registrado</p><p>{c.created_at || "—"}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Cuentas ({extractRows(accounts.data).length})</CardTitle></CardHeader>
        <CardContent>
          <DataTableATFX data={extractRows(accounts.data)} columns={accCols} loading={accounts.isLoading} filename={`atfx-cust-${id}-accounts`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Transacciones ({extractRows(txs.data).length})</CardTitle></CardHeader>
        <CardContent>
          <DataTableATFX data={extractRows(txs.data)} columns={txCols} loading={txs.isLoading} filename={`atfx-cust-${id}-tx`} />
        </CardContent>
      </Card>
    </div>
  );
}
