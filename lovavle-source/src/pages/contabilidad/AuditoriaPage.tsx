import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Row {
  id: string; actor_user_id: string | null; entity: string; entity_id: string | null;
  action: string; created_at: string; before_data: any; after_data: any;
  actor_name?: string;
}

const ENTITIES = ["", "accounting_expenses", "accounting_invoices", "accounting_revenues",
  "accounting_treasury_transfers", "accounting_budgets", "accounting_fiscal_periods"];

export default function AuditoriaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [entity, setEntity] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("accounting_audit_log")
        .select("*").order("created_at", { ascending: false }).limit(200);
      if (entity) q = q.eq("entity", entity);
      const { data } = await q;
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.actor_user_id).filter(Boolean)));
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id, nombre").in("id", ids);
        names = Object.fromEntries((p ?? []).map((x: any) => [x.id, x.nombre]));
      }
      setRows((data ?? []).map((r: any) => ({ ...r, actor_name: r.actor_user_id ? names[r.actor_user_id] ?? "—" : "Sistema" })));
      setLoading(false);
    })();
  }, [entity]);

  const filtered = rows.filter(r =>
    !search || r.entity.includes(search) || r.action.includes(search) ||
    (r.entity_id ?? "").includes(search) || (r.actor_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const badge = (a: string) => {
    const c = a === "delete" ? "destructive" : a === "update" ? "secondary" : "default";
    return <Badge variant={c as any}>{a}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Auditoría</h2>
        <p className="text-muted-foreground text-sm">Historial inmutable de cambios contables (últimos 200)</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Select value={entity || "all"} onValueChange={(v) => setEntity(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Entidad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las entidades</SelectItem>
            {ENTITIES.filter(Boolean).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="max-w-sm" placeholder="Buscar usuario / id / acción…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{filtered.length} eventos</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-muted-foreground">Cargando…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr><th className="py-2">Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>ID</th></tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td>{r.actor_name}</td>
                      <td>{badge(r.action)}</td>
                      <td className="font-mono text-xs">{r.entity}</td>
                      <td className="font-mono text-xs text-muted-foreground">{r.entity_id?.slice(0, 8) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
