import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Play, Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AnomaliasPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("accounting_anomalies").select("*")
      .order("detected_at", { ascending: false }).limit(200);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const run = async () => {
    setBusy(true);
    const { data } = await supabase.functions.invoke("accounting-anomaly-detector");
    setBusy(false);
    toast({ title: data?.ok ? `Detectadas: ${data.detected}` : "Error", variant: data?.ok ? "default" : "destructive" });
    load();
  };

  const resolve = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("accounting_anomalies").update({
      resolved_at: new Date().toISOString(), resolved_by: user?.id, resolution_note: "Revisado",
    }).eq("id", id);
    load();
  };

  const sev = (s: string) =>
    s === "critical" ? "destructive" : s === "warning" ? "default" : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6" />Anomalías</h1>
        <Button onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" />Detectar ahora</>}
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Detecciones recientes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Severidad</TableHead>
              <TableHead>Título</TableHead><TableHead>Descripción</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} className={r.resolved_at ? "opacity-50" : ""}>
                  <TableCell>{new Date(r.detected_at).toLocaleString()}</TableCell>
                  <TableCell>{r.anomaly_type}</TableCell>
                  <TableCell><Badge variant={sev(r.severity) as any}>{r.severity}</Badge></TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.description}</TableCell>
                  <TableCell>{r.resolved_at ? <Badge variant="outline">Resuelta</Badge> : <Badge>Abierta</Badge>}</TableCell>
                  <TableCell>{!r.resolved_at && <Button size="sm" variant="outline" onClick={() => resolve(r.id)}><Check className="h-3 w-3 mr-1" />Resolver</Button>}</TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin anomalías detectadas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
