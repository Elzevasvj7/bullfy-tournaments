import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, RefreshCw, UserCheck, Clock, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type Row = {
  id: string;
  lead_id: string;
  agent_id: string;
  assignment_type: string;
  status: string;
  accepted_at: string | null;
  completed_at: string | null;
  expired_at: string | null;
  created_at: string;
  agent_name?: string;
  lead_name?: string;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  accepted: "bg-blue-500/15 text-blue-500",
  completed: "bg-emerald-500/15 text-emerald-500",
  expired: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

export default function AssignmentsPanel() {
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lead_assignments")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (data ?? []) as Row[];
    const agentIds = [...new Set(list.map((r) => r.agent_id))];
    const leadIds = [...new Set(list.map((r) => r.lead_id))];
    const [{ data: profs }, { data: leads }] = await Promise.all([
      supabase.from("profiles").select("id,nombre").in("id", agentIds),
      supabase.from("stream_leads").select("id,name").in("id", leadIds),
    ]);
    const pMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.nombre]));
    const lMap = Object.fromEntries((leads ?? []).map((l: any) => [l.id, l.name]));
    setRows(list.map((r) => ({ ...r, agent_name: pMap[r.agent_id], lead_name: lMap[r.lead_id] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><UserCheck className="w-4 h-4 text-primary" /> Cola de asignación</CardTitle>
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending"><Clock className="w-3 h-3 mr-1" />Pendientes</TabsTrigger>
            <TabsTrigger value="accepted">Aceptadas</TabsTrigger>
            <TabsTrigger value="completed"><CheckCircle2 className="w-3 h-3 mr-1" />Completadas</TabsTrigger>
            <TabsTrigger value="expired"><XCircle className="w-3 h-3 mr-1" />Expiradas</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sin asignaciones {tab}.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{r.lead_name ?? r.lead_id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">
                        → {r.agent_name ?? "—"} · {r.assignment_type} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
                      </div>
                    </div>
                    <Badge className={STATUS_COLOR[r.status] ?? ""}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
