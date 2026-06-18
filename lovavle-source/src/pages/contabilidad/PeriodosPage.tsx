import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, Unlock, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Period {
  id: string; name: string; period_start: string; period_end: string;
  status: "open" | "locked" | "closed"; locked_at: string | null; notes: string | null;
}

export default function PeriodosPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("accounting_fiscal_periods")
      .select("*").order("period_start", { ascending: false });
    setRows((data ?? []) as Period[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name || !from || !to) { toast.error("Completa todos los campos"); return; }
    const { error } = await supabase.from("accounting_fiscal_periods")
      .insert({ name, period_start: from, period_end: to, status: "open" });
    if (error) { toast.error(error.message); return; }
    toast.success("Período creado"); setName(""); setFrom(""); setTo(""); load();
  };

  const toggle = async (p: Period) => {
    const newStatus = p.status === "open" ? "locked" : "open";
    const { error } = await supabase.from("accounting_fiscal_periods").update({
      status: newStatus,
      locked_by: newStatus === "locked" ? user?.id : null,
      locked_at: newStatus === "locked" ? new Date().toISOString() : null,
    }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "locked" ? "Período bloqueado" : "Período reabierto");
    load();
  };

  const close = async (p: Period) => {
    if (!confirm(`Cerrar definitivamente ${p.name}? No se podrá reabrir desde la UI.`)) return;
    const { error } = await supabase.from("accounting_fiscal_periods").update({
      status: "closed", locked_by: user?.id, locked_at: new Date().toISOString(),
    }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Período cerrado"); load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Períodos Fiscales</h2>
        <p className="text-muted-foreground text-sm">
          Bloquea un mes para evitar ediciones retroactivas. Las facturas y gastos no pueden modificarse en períodos bloqueados.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Nuevo período</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <div><label className="text-xs text-muted-foreground">Nombre</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="2026-06" className="w-40" /></div>
          <div><label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={create}><Plus className="h-4 w-4 mr-1" /> Crear</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Períodos</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-muted-foreground">Cargando…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr><th className="py-2">Nombre</th><th>Rango</th><th>Estado</th><th>Bloqueado</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map(p => (
                    <tr key={p.id} className="border-b">
                      <td className="py-2 font-medium">{p.name}</td>
                      <td>{p.period_start} → {p.period_end}</td>
                      <td><Badge variant={p.status === "open" ? "default" : p.status === "locked" ? "secondary" : "destructive"}>
                        {p.status}</Badge></td>
                      <td className="text-xs text-muted-foreground">{p.locked_at ? new Date(p.locked_at).toLocaleString() : "—"}</td>
                      <td className="text-right">
                        {p.status !== "closed" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => toggle(p)}>
                              {p.status === "open" ? <><Lock className="h-3 w-3 mr-1" />Bloquear</> : <><Unlock className="h-3 w-3 mr-1" />Reabrir</>}
                            </Button>
                            {p.status === "locked" && (
                              <Button size="sm" variant="destructive" onClick={() => close(p)}>Cerrar</Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sin períodos</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
