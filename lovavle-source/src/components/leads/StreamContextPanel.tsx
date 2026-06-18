import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageSquare, ShieldAlert, Package, Loader2 } from "lucide-react";

interface Props {
  roomIds: string[];
}

const StreamContextPanel = ({ roomIds }: Props) => {
  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["stream-analyses", roomIds],
    queryFn: async () => {
      if (!roomIds.length) return [];
      const { data, error } = await supabase
        .from("live_stream_analysis")
        .select("*")
        .in("room_id", roomIds)
        .eq("processing_status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: roomIds.length > 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Cargando contexto...
      </div>
    );
  }

  if (!analyses.length) return null;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" /> Contexto de Streams (IA)
      </h4>
      {analyses.map((a: any) => (
        <div key={a.id} className="bg-primary/5 rounded-lg p-3 space-y-2">
          {a.summary && (
            <p className="text-xs text-foreground/80">{a.summary}</p>
          )}
          
          {a.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-muted-foreground font-medium">Temas:</span>
              {a.topics.map((t: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {a.faqs?.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> FAQs:
              </span>
              {a.faqs.map((f: string, i: number) => (
                <p key={i} className="text-[10px] text-foreground/70 pl-4">• {f}</p>
              ))}
            </div>
          )}

          {a.objections?.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Objeciones:
              </span>
              {a.objections.map((o: string, i: number) => (
                <p key={i} className="text-[10px] text-foreground/70 pl-4">• {o}</p>
              ))}
            </div>
          )}

          {a.products_mentioned?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Package className="w-3 h-3" /> Productos:
              </span>
              {a.products_mentioned.map((p: string, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default StreamContextPanel;
