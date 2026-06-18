import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Film, Share2, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

interface Highlight {
  id: string;
  kind: "general" | "winner";
  status: "queued" | "rendering" | "completed" | "failed";
  video_url: string | null;
  scenes_data: any;
  user_id: string | null;
}

export function TournamentHighlights({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const [items, setItems] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("tournament_highlights")
        .select("id, kind, status, video_url, scenes_data, user_id")
        .eq("tournament_id", tournamentId)
        .order("kind", { ascending: true });
      if (mounted) {
        setItems((data as Highlight[]) || []);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`tournament-highlights-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_highlights", filter: `tournament_id=eq.${tournamentId}` }, () => load())
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [tournamentId]);

  const share = async (h: Highlight) => {
    const url = h.video_url!;
    const title = h.kind === "winner" ? `🏆 Top ${h.scenes_data?.rank} en ${tournamentName} — Bullfy Tournament` : `🎬 Resumen ${tournamentName} — Bullfy Tournament`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  if (loading) return null;
  if (items.length === 0) return null;

  const general = items.find((i) => i.kind === "general");
  const winners = items.filter((i) => i.kind === "winner");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Film className="h-5 w-5 text-primary" /> Highlights del torneo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {general && <HighlightItem h={general} label="Resumen oficial" onShare={share} />}
        {winners.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {winners
              .sort((a, b) => (a.scenes_data?.rank || 99) - (b.scenes_data?.rank || 99))
              .map((w) => (
                <HighlightItem key={w.id} h={w} label={`Puesto ${w.scenes_data?.rank} · @${w.scenes_data?.username || "—"}`} onShare={share} compact />
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HighlightItem({ h, label, onShare, compact }: { h: Highlight; label: string; onShare: (h: Highlight) => void; compact?: boolean }) {
  const isReady = h.status === "completed" && h.video_url;
  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className={`relative bg-black ${compact ? "aspect-[9/16]" : "aspect-video"} flex items-center justify-center`}>
        {isReady ? (
          <video src={h.video_url!} controls playsInline className="w-full h-full object-contain" preload="metadata" />
        ) : h.status === "failed" ? (
          <div className="text-xs text-red-400">Generación falló</div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Generando video...</span>
          </div>
        )}
      </div>
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="text-sm font-medium truncate">{label}</div>
        {isReady && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onShare(h)}><Share2 className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" asChild><a href={h.video_url!} download target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a></Button>
          </div>
        )}
        {!isReady && <Badge variant="outline" className="text-xs">{h.status}</Badge>}
      </div>
    </div>
  );
}
