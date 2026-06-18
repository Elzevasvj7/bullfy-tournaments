import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Radio } from "lucide-react";
import { format } from "date-fns";

interface Props {
  roomIds: string[];
}

/** Shows keyword alerts detected in specific streams (used in LeadDetailDialog) */
const KeywordAlertsPanel = ({ roomIds }: Props) => {
  const { data: alerts = [] } = useQuery({
    queryKey: ["keyword-alerts-by-rooms", roomIds],
    queryFn: async () => {
      if (!roomIds.length) return [];
      const { data, error } = await supabase
        .from("live_keyword_alerts")
        .select("*, live_rooms:room_id(title)")
        .in("room_id", roomIds)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: roomIds.length > 0,
  });

  if (!alerts.length) return null;

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4" /> Alertas de Palabras Clave
      </h4>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {alerts.map((a: any) => (
          <div key={a.id} className="bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center justify-between">
              <Badge variant="destructive" className="text-[10px]">{a.keyword_text}</Badge>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(a.detected_at), "dd/MM HH:mm")}
              </span>
            </div>
            {a.transcript_excerpt && (
              <p className="text-[10px] text-foreground/70 italic">...{a.transcript_excerpt}...</p>
            )}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Radio className="w-2.5 h-2.5" />
              {(a.live_rooms as any)?.title || "Stream"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeywordAlertsPanel;
