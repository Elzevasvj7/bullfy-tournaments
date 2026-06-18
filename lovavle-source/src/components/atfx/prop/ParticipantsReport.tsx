import { useState } from "react";
import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { Button } from "@/components/ui/button";
import { extractRows } from "../utils";
import { toISO, type DateRangeValue } from "../DateRangePicker";
import ParticipantDetail from "./ParticipantDetail";

interface Props { range: DateRangeValue }

export default function ParticipantsReport({ range }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const q = useATFX("list_participants", {
    date_from: toISO(range.from),
    date_to: toISO(range.to),
    limit: 1000,
  });

  const rows = extractRows(q.data);
  const stats = rows.reduce((acc: any, r: any) => {
    const s = r.status || "unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const cols: ColumnDef<any>[] = [
    { key: "id", label: "ID" },
    { key: "customer_email", label: "Cliente" },
    { key: "challenge_name", label: "Challenge" },
    { key: "current_step", label: "Step" },
    { key: "status", label: "Status" },
    { key: "started_at", label: "Iniciado" },
    { key: "actions", label: "", render: (r) => <Button size="sm" variant="outline" onClick={() => setSelected(r.id)}>Detalle</Button> },
  ];

  if (selected) return <ParticipantDetail id={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Object.entries(stats).map(([s, n]: any) => (
          <div key={s} className="px-3 py-2 rounded-md border border-border bg-card text-sm">
            <span className="text-muted-foreground capitalize">{s}: </span>
            <span className="font-semibold">{n as number}</span>
          </div>
        ))}
      </div>
      <DataTableATFX data={rows} columns={cols} loading={q.isLoading} onRefresh={() => q.refetch()} filename="atfx-prop-participants" searchKeys={["id", "customer_email", "challenge_name", "status"]} />
    </div>
  );
}
