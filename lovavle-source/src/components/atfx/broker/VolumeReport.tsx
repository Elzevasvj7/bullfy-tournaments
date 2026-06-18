import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtNum } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";

interface Props { range: DateRangeValue }

const cols: ColumnDef<any>[] = [
  { key: "date", label: "Fecha" },
  { key: "symbol", label: "Símbolo" },
  { key: "adapter", label: "Adapter" },
  { key: "volume", label: "Volumen (lots)", render: (r) => fmtNum(r.volume) },
  { key: "trades", label: "Trades", render: (r) => fmtNum(r.trades) },
];

export default function VolumeReport({ range }: Props) {
  const q = useATFX("report_volume", {
    date_from: toISO(range.from),
    date_to: toISO(range.to),
    group_by: "day",
  });
  return (
    <DataTableATFX data={extractRows(q.data)} columns={cols} loading={q.isLoading} onRefresh={() => q.refetch()} filename="atfx-volume" searchKeys={["symbol", "adapter"]} />
  );
}
