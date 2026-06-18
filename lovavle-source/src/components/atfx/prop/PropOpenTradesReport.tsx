import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtUSD, fmtNum } from "../utils";

const cols: ColumnDef<any>[] = [
  { key: "ticket", label: "Ticket" },
  { key: "participant_email", label: "Participante" },
  { key: "challenge_name", label: "Challenge" },
  { key: "symbol", label: "Símbolo" },
  { key: "type", label: "Tipo" },
  { key: "volume", label: "Lots", render: (r) => fmtNum(r.volume) },
  { key: "floating_pnl", label: "P&L flot.", render: (r) => fmtUSD(r.floating_pnl) },
  { key: "current_drawdown", label: "DD actual", render: (r) => fmtUSD(r.current_drawdown) },
  { key: "drawdown_limit", label: "Límite DD", render: (r) => fmtUSD(r.drawdown_limit) },
  {
    key: "alert", label: "⚠️", render: (r) => {
      const dd = parseFloat(r.current_drawdown);
      const lim = parseFloat(r.drawdown_limit);
      if (!Number.isFinite(dd) || !Number.isFinite(lim) || lim === 0) return "—";
      const ratio = Math.abs(dd) / Math.abs(lim);
      if (ratio >= 0.9) return <span className="text-destructive font-bold">CRÍTICO</span>;
      if (ratio >= 0.7) return <span className="text-yellow-500 font-semibold">Alto</span>;
      return <span className="text-muted-foreground">OK</span>;
    }
  },
];

export default function PropOpenTradesReport() {
  const q = useATFX("prop_open_trades", { limit: 1000 }, { refetchInterval: 30_000 });
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Auto-refresh cada 30s · Alertas de proximidad a breach del drawdown</p>
      <DataTableATFX data={extractRows(q.data)} columns={cols} loading={q.isLoading} onRefresh={() => q.refetch()} filename="atfx-prop-open-trades" searchKeys={["ticket", "participant_email", "challenge_name", "symbol"]} />
    </div>
  );
}
