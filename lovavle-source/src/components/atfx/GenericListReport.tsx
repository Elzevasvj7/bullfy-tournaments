import { useATFX, ATFXAction } from "@/hooks/useATFX";
import DataTableATFX, { ColumnDef } from "./DataTableATFX";
import ErrorPanel from "./ErrorPanel";
import { extractRows } from "./utils";

interface Props<T> {
  action: ATFXAction;
  payload?: any;
  columns: ColumnDef<T>[];
  searchKeys?: (keyof T | string)[];
  filename?: string;
  refetchInterval?: number;
  enabled?: boolean;
}

export default function GenericListReport<T extends Record<string, any>>({
  action, payload, columns, searchKeys, filename, refetchInterval, enabled,
}: Props<T>) {
  const q = useATFX(action, payload, { refetchInterval, enabled });

  if (!q.isLoading && q.data && !q.data.ok) {
    return <ErrorPanel message={q.data.error ?? "Error en la API"} raw={q.data.raw} onRetry={() => q.refetch()} />;
  }

  return (
    <DataTableATFX
      data={extractRows(q.data) as T[]}
      columns={columns}
      loading={q.isLoading}
      onRefresh={() => q.refetch()}
      filename={filename ?? action}
      searchKeys={searchKeys as any}
    />
  );
}
