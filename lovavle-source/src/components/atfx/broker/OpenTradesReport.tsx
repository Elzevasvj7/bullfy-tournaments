import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtUSD, fmtNum } from "../utils";

const cols: ColumnDef<any>[] = [
  { key: "ticket", label: "Ticket" },
  { key: "customer_email", label: "Cliente" },
  { key: "account_login", label: "Cuenta" },
  { key: "symbol", label: "Símbolo" },
  { key: "type", label: "Tipo" },
  { key: "volume", label: "Lots", render: (r) => fmtNum(r.volume) },
  { key: "open_price", label: "Apertura", render: (r) => fmtNum(r.open_price) },
  { key: "current_price", label: "Actual", render: (r) => fmtNum(r.current_price) },
  { key: "floating_pnl", label: "P&L Flotante", render: (r) => fmtUSD(r.floating_pnl) },
  { key: "open_time", label: "Abierta" },
];

export default function OpenTradesReport() {
  const q = useATFX("list_open_trades", { limit: 1000 }, { refetchInterval: 30_000 });
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Auto-refresh cada 30s</p>
      <DataTableATFX data={extractRows(q.data)} columns={cols} loading={q.isLoading} onRefresh={() => q.refetch()} filename="atfx-open-trades" searchKeys={["ticket", "customer_email", "symbol", "account_login"]} />
    </div>
  );
}
