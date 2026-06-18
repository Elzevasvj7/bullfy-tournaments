import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtNum, fmtUSD } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";

interface Props { range: DateRangeValue }

const cols: ColumnDef<any>[] = [
  { key: "agent_id", label: "ID Agente" },
  { key: "agent_email", label: "Email" },
  { key: "referred_clients", label: "Clientes ref.", render: (r) => fmtNum(r.referred_clients) },
  { key: "active_clients", label: "Activos", render: (r) => fmtNum(r.active_clients) },
  { key: "volume", label: "Volumen (lots)", render: (r) => fmtNum(r.volume) },
  { key: "commission", label: "Comisión", render: (r) => fmtUSD(r.commission) },
];

export default function AgentsReport({ range }: Props) {
  const q = useATFX("report_agents", { date_from: toISO(range.from), date_to: toISO(range.to) });
  return <DataTableATFX data={extractRows(q.data)} columns={cols} loading={q.isLoading} onRefresh={() => q.refetch()} filename="atfx-agents" searchKeys={["agent_id", "agent_email"]} />;
}
