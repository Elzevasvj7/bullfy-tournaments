import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Radio, User } from "lucide-react";
import { format } from "date-fns";

/** Global keyword alerts section for the Smart Call Dashboard */
const SmartCallKeywordAlerts = () => {
  const { data: alerts = [] } = useQuery({
    queryKey: ["smart-call-keyword-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_keyword_alerts")
        .select("*, live_rooms:room_id(title, host_id)")
        .order("detected_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Get host names
  const hostIds = [...new Set(alerts.map((a: any) => a.host_id).filter(Boolean))];
  const { data: hostProfiles = {} } = useQuery({
    queryKey: ["keyword-alert-hosts", hostIds],
    queryFn: async () => {
      if (!hostIds.length) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, nombre")
        .in("id", hostIds);
      const map: Record<string, string> = {};
      data?.forEach((p: any) => { map[p.id] = p.nombre; });
      return map;
    },
    enabled: hostIds.length > 0,
  });

  if (!alerts.length) return null;

  // Group by keyword
  const groupedByKeyword: Record<string, any[]> = {};
  alerts.forEach((a: any) => {
    const key = a.keyword_text;
    if (!groupedByKeyword[key]) groupedByKeyword[key] = [];
    groupedByKeyword[key].push(a);
  });

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4" /> Alertas por Palabras Clave en Streams
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(groupedByKeyword).map(([keyword, items]) => (
          <div key={keyword} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">{keyword}</Badge>
              <span className="text-[10px] text-muted-foreground">{items.length} detecciones</span>
            </div>
            <div className="space-y-1 pl-2 border-l-2 border-destructive/20">
              {items.slice(0, 5).map((a: any) => (
                <div key={a.id} className="text-[10px] flex items-center gap-2 text-foreground/80">
                  <Radio className="w-2.5 h-2.5 text-primary shrink-0" />
                  <span className="font-medium">{(a.live_rooms as any)?.title || "Stream"}</span>
                  <span className="text-muted-foreground">•</span>
                  <User className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                  <span>{(hostProfiles as any)[a.host_id] || "IB"}</span>
                  <span className="text-muted-foreground ml-auto">{format(new Date(a.detected_at), "dd/MM HH:mm")}</span>
                </div>
              ))}
              {items.length > 5 && (
                <p className="text-[10px] text-muted-foreground pl-4">+{items.length - 5} más</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SmartCallKeywordAlerts;
