import { useState } from "react";
import { useATFX } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows } from "../utils";
import { Button } from "@/components/ui/button";
import { toISO, type DateRangeValue } from "../DateRangePicker";
import CustomerDetail from "./CustomerDetail";

interface Props { range: DateRangeValue }

export default function CustomersReport({ range }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const q = useATFX("list_customers", {
    date_from: toISO(range.from),
    date_to: toISO(range.to),
    limit: 1000,
  });

  const cols: ColumnDef<any>[] = [
    { key: "id", label: "ID" },
    { key: "email", label: "Email" },
    { key: "first_name", label: "Nombre" },
    { key: "country", label: "País" },
    { key: "env_mode", label: "Entorno" },
    { key: "referrer_id", label: "Referido por" },
    { key: "created_at", label: "Registrado" },
    { key: "actions", label: "", render: (r) => <Button size="sm" variant="outline" onClick={() => setSelected(r.id)}>Detalle</Button> },
  ];

  if (selected) return <CustomerDetail id={selected} onBack={() => setSelected(null)} />;

  return (
    <DataTableATFX
      data={extractRows(q.data)}
      columns={cols}
      loading={q.isLoading}
      onRefresh={() => q.refetch()}
      searchKeys={["id", "email", "country", "first_name", "referrer_id"]}
      filename="atfx-customers"
    />
  );
}
