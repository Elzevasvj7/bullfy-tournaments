import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Search, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface ColumnDef<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  data: T[] | undefined;
  columns: ColumnDef<T>[];
  loading?: boolean;
  pageSize?: number;
  searchKeys?: (keyof T | string)[];
  onRefresh?: () => void;
  emptyText?: string;
  filename?: string;
}

function getValue(row: any, key: string) {
  return key.split(".").reduce((acc, k) => acc?.[k], row);
}

export default function DataTableATFX<T extends Record<string, any>>({
  data,
  columns,
  loading,
  pageSize = 25,
  searchKeys,
  onRefresh,
  emptyText = "Sin resultados",
  filename = "atfx-export",
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const s = search.toLowerCase();
    const keys = searchKeys ?? columns.map(c => c.key);
    return data.filter(row =>
      keys.some(k => String(getValue(row, String(k)) ?? "").toLowerCase().includes(s))
    );
  }, [data, search, searchKeys, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const exportCSV = () => {
    if (!filtered.length) return;
    const header = columns.map(c => c.label).join(",");
    const rows = filtered.map(r => columns.map(c => {
      const v = getValue(r, String(c.key));
      const s = v === null || v === undefined ? "" : String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar..." className="pl-8 h-9" />
        </div>
        <div className="flex-1" />
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="w-3.5 h-3.5 mr-1" />Refrescar</Button>
        )}
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(c => <TableHead key={String(c.key)} className={c.className}>{c.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map(c => <TableCell key={String(c.key)}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            )}
            {!loading && paged.length === 0 && (
              <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">{emptyText}</TableCell></TableRow>
            )}
            {!loading && paged.map((row, i) => (
              <TableRow key={i}>
                {columns.map(c => (
                  <TableCell key={String(c.key)} className={c.className}>
                    {c.render ? c.render(row) : String(getValue(row, String(c.key)) ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} resultados</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span>{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}
