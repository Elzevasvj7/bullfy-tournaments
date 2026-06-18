import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Heart, MessageCircle, Share2, RefreshCw, ExternalLink, Loader2, CalendarClock, Trash2 } from "lucide-react";
import { toast } from "@/lib/toastUtils";

interface Pub {
  id: string;
  platform: string;
  status: string;
  caption: string | null;
  post_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  metrics: any;
  clip_id: string | null;
}

export default function SocialPublicationsPanel() {
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("social_publications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setPubs((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const refreshAnalytics = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-social-analytics", { body: {} });
      if (error) throw error;
      toast.success(`Métricas actualizadas: ${data.updated || 0}`);
      await load();
    } catch (e: any) {
      toast.error("Error: " + (e.message || ""));
    } finally {
      setRefreshing(false);
    }
  };

  const cancelScheduled = async (id: string) => {
    await supabase.from("social_publications").delete().eq("id", id);
    toast.success("Programación cancelada");
    load();
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-display font-bold">Publicaciones Sociales</h3>
          <p className="text-sm text-muted-foreground">Historial y métricas de tus clips publicados</p>
        </div>
        <Button onClick={refreshAnalytics} disabled={refreshing} variant="outline" size="sm" className="gap-1.5">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refrescar Métricas
        </Button>
      </div>

      {pubs.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aún no has publicado clips.</CardContent></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {pubs.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 capitalize">
                  {p.platform}
                  <Badge variant={
                    p.status === "published" ? "default" :
                    p.status === "scheduled" ? "secondary" :
                    p.status === "failed" ? "destructive" : "outline"
                  } className="text-xs">{p.status}</Badge>
                </span>
                {p.post_url && (
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                    <a href={p.post_url} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {p.caption && <p className="line-clamp-2 text-muted-foreground italic">"{p.caption}"</p>}
              {p.scheduled_at && p.status === "scheduled" && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarClock className="w-3.5 h-3.5" /> {new Date(p.scheduled_at).toLocaleString()}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => cancelScheduled(p.id)} className="h-6 px-2 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
              {p.metrics && (
                <div className="flex flex-wrap gap-3 text-muted-foreground pt-1 border-t border-border/50">
                  {typeof p.metrics.views === "number" && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {p.metrics.views.toLocaleString()}</span>}
                  {typeof p.metrics.likes === "number" && <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {p.metrics.likes.toLocaleString()}</span>}
                  {typeof p.metrics.comments === "number" && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {p.metrics.comments.toLocaleString()}</span>}
                  {typeof p.metrics.shares === "number" && <span className="flex items-center gap-1"><Share2 className="w-3 h-3" /> {p.metrics.shares.toLocaleString()}</span>}
                </div>
              )}
              {p.published_at && <p className="text-muted-foreground">{new Date(p.published_at).toLocaleString()}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
