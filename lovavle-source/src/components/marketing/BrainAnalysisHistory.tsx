import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, Eye, Trash2, Loader2, Calendar, User, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";

interface AnalysisRecord {
  id: string;
  campaign_name: string;
  copy_text: string | null;
  image_url: string | null;
  asset_type: string;
  analysis_data: any;
  consensus_score: number | null;
  viral_potential: string | null;
  agent_count: number | null;
  created_by: string | null;
  created_at: string;
}

const BrainAnalysisHistory = () => {
  const { isGlobalAdmin, isAdmin } = useAuth();
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("brain_analysis_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) setRecords(data as unknown as AnalysisRecord[]);
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("brain_analysis_history").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar: " + error.message);
    } else {
      setRecords(prev => prev.filter(r => r.id !== id));
      toast.success("Registro eliminado");
    }
  };

  const viralColor = (v: string | null) => {
    if (!v) return "bg-muted text-muted-foreground";
    const lower = v.toLowerCase();
    if (lower.includes("viral") || lower.includes("alto")) return "bg-green-500/10 text-green-600 border-green-500/20";
    if (lower.includes("medio")) return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    return "bg-red-500/10 text-red-600 border-red-500/20";
  };

  const scoreColor = (s: number | null) => {
    if (!s) return "text-muted-foreground";
    if (s >= 75) return "text-green-500";
    if (s >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Historial de Análisis — Bullfy Brain
          </CardTitle>
          <CardDescription>
            Registro automático de todos los análisis multi-agente realizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay análisis registrados aún</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Campaña</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Agentes</TableHead>
                    <TableHead className="text-center">Consenso</TableHead>
                    <TableHead>Potencial</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(r.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                        <span className="text-[10px]">{new Date(r.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{r.campaign_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {r.asset_type === "image" ? "📷 Imagen" : "📝 Texto"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{r.agent_count ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold ${scoreColor(r.consensus_score)}`}>
                          {r.consensus_score ?? "—"}/100
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={viralColor(r.viral_potential)}>
                          {r.viral_potential ?? "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedRecord(r)} title="Ver detalle">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {(isGlobalAdmin || isAdmin) && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(r.id)} title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              {selectedRecord?.campaign_name}
            </DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Consenso</p>
                  <p className={`text-2xl font-bold ${scoreColor(selectedRecord.consensus_score)}`}>
                    {selectedRecord.consensus_score ?? "—"}/100
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Potencial Viral</p>
                  <p className="text-lg font-semibold">{selectedRecord.viral_potential ?? "N/A"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Agentes</p>
                  <p className="text-2xl font-bold">{selectedRecord.agent_count ?? "—"}</p>
                </div>
              </div>

              {selectedRecord.copy_text && (
                <div>
                  <p className="text-sm font-medium mb-1">Copy analizado:</p>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg whitespace-pre-wrap">
                    {selectedRecord.copy_text}
                  </p>
                </div>
              )}

              {selectedRecord.image_url && (
                <div>
                  <p className="text-sm font-medium mb-1">Imagen:</p>
                  <img src={selectedRecord.image_url} alt="asset" className="max-h-40 rounded-lg border" />
                </div>
              )}

              {/* Moderator summary */}
              {selectedRecord.analysis_data?.moderator?.summary && (
                <div>
                  <p className="text-sm font-medium mb-1">Resumen del Moderador:</p>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    {selectedRecord.analysis_data.moderator.summary}
                  </p>
                </div>
              )}

              {/* Agent verdicts */}
              {selectedRecord.analysis_data?.agents && (
                <div>
                  <p className="text-sm font-medium mb-2">Veredictos de Agentes:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.values(selectedRecord.analysis_data.agents as Record<string, any>).map((agent: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg border bg-card text-xs">
                        <div className="flex items-center gap-1 mb-1">
                          <span>{agent.emoji}</span>
                          <span className="font-medium">{agent.name}</span>
                          <Badge variant="outline" className="text-[9px] ml-auto">
                            {agent.result?.score ?? "?"}/100
                          </Badge>
                        </div>
                        {agent.result?.verdict && (
                          <Badge variant="secondary" className="text-[9px]">{agent.result.verdict}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {selectedRecord.analysis_data?.moderator?.final_recommendations?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Recomendaciones:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {selectedRecord.analysis_data.moderator.final_recommendations.map((r: any, i: number) => (
                      <li key={i} className="flex gap-2">
                        <Badge variant="outline" className="text-[9px] shrink-0">{r.priority}</Badge>
                        <span>{r.recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrainAnalysisHistory;
