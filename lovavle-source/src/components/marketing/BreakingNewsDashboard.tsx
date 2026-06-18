import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Check, X, ExternalLink, RefreshCw } from "lucide-react";

const BreakingNewsDashboard = () => {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetchNews();

    // Realtime subscription
    const channel = supabase
      .channel("breaking-news-changes")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "breaking_news" },
        () => fetchNews()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchNews = async () => {
    const { data } = await (supabase.from as any)("breaking_news")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setNews(data || []);
    setLoading(false);
  };

  const handleAction = async (id: string, action: "approved" | "discarded") => {
    const { data: { user } } = await supabase.auth.getUser();
    const updates: any = { status: action };
    if (action === "approved") {
      updates.approved_by = user?.id;
      updates.approved_at = new Date().toISOString();
    }
    await (supabase.from as any)("breaking_news").update(updates).eq("id", id);
    toast({
      title: action === "approved" ? "✅ Noticia aprobada" : "❌ Noticia descartada",
      description: action === "approved" ? "Se preparará para envío." : "Eliminada de la cola.",
    });
    fetchNews();
  };

  const handleManualScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("newsletter-breaking-scan");
      if (error) throw error;
      toast({
        title: "🔍 Escaneo completado",
        description: `${data?.total_scanned || 0} noticias evaluadas, ${data?.breaking || 0} breaking news encontradas.`,
      });
      fetchNews();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const pending = news.filter(n => n.status === "pending");
  const processed = news.filter(n => n.status !== "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <div>
            <h3 className="text-lg font-bold">🚨 Breaking News</h3>
            <p className="text-xs text-muted-foreground">
              Marcus Chen y Vanessa Drake escanean noticias cada 3 horas
            </p>
          </div>
        </div>
        <Button onClick={handleManualScan} disabled={scanning} variant="outline" className="gap-2">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scanning ? "Escaneando..." : "Escanear ahora"}
        </Button>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Pendientes de aprobación ({pending.length})
          </h4>
          {pending.map(item => (
            <Card key={item.id} className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="py-4 px-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {item.proposed_by_emoji} {item.proposed_by}
                      </Badge>
                      <Badge
                        className={`text-[10px] ${
                          item.urgency_score >= 9 ? "bg-red-600" : "bg-orange-500"
                        }`}
                      >
                        Urgencia: {item.urgency_score}/10
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {item.category === "gossip" ? "🍷 Gossip" : "📊 Financiero"}
                      </Badge>
                    </div>
                    <h4 className="text-sm font-semibold">{item.headline}</h4>
                    <p className="text-xs text-muted-foreground">{item.summary}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>Fuente: {item.source}</span>
                      <span>• Hace {getTimeAgo(item.created_at)}</span>
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                          Ver fuente <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleAction(item.id, "approved")}
                    >
                      <Check className="w-3 h-3" /> Enviar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-destructive border-destructive/30"
                      onClick={() => handleAction(item.id, "discarded")}
                    >
                      <X className="w-3 h-3" /> Descartar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pending.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No hay noticias pendientes. El próximo escaneo es automático cada 3 horas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Processed history */}
      {processed.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Historial reciente
          </h4>
          {processed.slice(0, 10).map(item => (
            <Card key={item.id} className="opacity-60">
              <CardContent className="py-2 px-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs">{item.proposed_by_emoji}</span>
                    <span className="text-xs font-medium truncate">{item.headline}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] shrink-0 ${
                      item.status === "approved" ? "text-green-500 border-green-500/30" :
                      item.status === "sent" ? "text-blue-500 border-blue-500/30" :
                      "text-red-500 border-red-500/30"
                    }`}
                  >
                    {item.status === "approved" ? "✅ Aprobada" :
                     item.status === "sent" ? "📧 Enviada" : "❌ Descartada"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default BreakingNewsDashboard;
