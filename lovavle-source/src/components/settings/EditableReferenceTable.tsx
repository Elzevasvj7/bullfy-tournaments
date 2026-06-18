import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

export interface ReferenceColumn {
  key: string;
  label: string;
  type: "text" | "number";
}

interface EditableReferenceTableProps {
  tableName: string;
  columns: ReferenceColumn[];
  idField?: string;
}

const EditableReferenceTable = ({ tableName, columns, idField = "id" }: EditableReferenceTableProps) => {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from as any)(tableName).select("*").order("id");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, [tableName]);

  const handleChange = (idx: number, key: string, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const handleAdd = () => {
    const newRow: Record<string, any> = { _isNew: true };
    columns.forEach((c) => {
      newRow[c.key] = c.type === "number" ? 0 : "";
    });
    setRows((prev) => [...prev, newRow]);
  };

  const handleDelete = async (row: Record<string, any>, idx: number) => {
    if (row._isNew) {
      setRows((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    setDeletingId(row[idField]);
    const { error } = await (supabase.from as any)(tableName).delete().eq(idField, row[idField]);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } else {
      setRows((prev) => prev.filter((_, i) => i !== idx));
      toast({ title: "Eliminado" });
    }
    setDeletingId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newRows = rows.filter((r) => r._isNew);
      const existingRows = rows.filter((r) => !r._isNew);

      if (newRows.length > 0) {
        const cleanNew = newRows.map((r) => {
          const clean: Record<string, any> = {};
          columns.forEach((c) => {
            clean[c.key] = c.type === "number" ? Number(r[c.key]) : r[c.key];
          });
          return clean;
        });
        const { error } = await (supabase.from as any)(tableName).insert(cleanNew);
        if (error) throw error;
      }

      for (const row of existingRows) {
        const updates: Record<string, any> = {};
        columns.forEach((c) => {
          updates[c.key] = c.type === "number" ? Number(row[c.key]) : row[c.key];
        });
        const { error } = await (supabase.from as any)(tableName).update(updates).eq(idField, row[idField]);
        if (error) throw error;
      }

      toast({ title: "✅ Guardado correctamente" });
      await fetchRows();
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/30 border-b border-border">
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-foreground">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2.5 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, idx) => (
              <tr key={row[idField] || `new-${idx}`} className="hover:bg-secondary/20 transition-colors">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-1.5">
                    <Input
                      type={c.type === "number" ? "number" : "text"}
                      value={row[c.key] ?? ""}
                      onChange={(e) => handleChange(idx, c.key, e.target.value)}
                      maxLength={c.type === "text" ? 100 : undefined}
                      className="h-8 text-sm"
                    />
                  </td>
                ))}
                <td className="px-3 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(row, idx)}
                    disabled={deletingId === row[idField]}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === row[idField] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleAdd} className="gap-1.5 text-sm">
          <Plus className="w-3.5 h-3.5" /> Agregar fila
        </Button>
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-90 gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
};

export default EditableReferenceTable;