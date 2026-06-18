import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Target, TrendingUp, Loader2 } from "lucide-react";

interface SessionSummary {
  bd_id: string;
  bd_name: string;
  total_calls: number;
  total_score: number;
  avg_probability: number;
  closed: number;
  total_real: number;
}

const MEDALS = [
  { id: "closer_pro", label: "Closer Pro", emoji: "🏆", condition: (s: SessionSummary) => s.closed >= 5 },
  { id: "objecion_killer", label: "Objeción Killer", emoji: "🛡️", condition: (s: SessionSummary) => s.total_score >= 200 },
  { id: "ib_hunter", label: "IB Hunter", emoji: "🎯", condition: (s: SessionSummary) => s.total_real >= 10 },
];

const GamificationPanel = () => {
  const { user, isAdmin, isAdminBD } = useAuth();
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Get all sessions (admins see all, BDs see own)
      let query = supabase.from("bce_call_sessions").select("*").eq("is_training", false);
      if (!isAdmin && !isAdminBD) {
        query = query.eq("bd_id", user?.id);
      }
      const { data: sessions } = await query;

      // Get profiles for names
      const bdIds = [...new Set((sessions ?? []).map(s => s.bd_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, nombre").in("id", bdIds);
      const nameMap = new Map((profiles ?? []).map(p => [p.id, p.nombre]));

      // Aggregate per BD
      const map = new Map<string, SessionSummary>();
      for (const s of sessions ?? []) {
        const existing = map.get(s.bd_id) || {
          bd_id: s.bd_id,
          bd_name: nameMap.get(s.bd_id) || "Sin nombre",
          total_calls: 0, total_score: 0, avg_probability: 0, closed: 0, total_real: 0,
        };
        existing.total_calls++;
        existing.total_score += s.score || 0;
        existing.avg_probability += s.probabilidad_cierre || 0;
        if (s.resultado === "cerrado") existing.closed++;
        existing.total_real++;
        map.set(s.bd_id, existing);
      }

      const result = [...map.values()].map(s => ({
        ...s,
        avg_probability: s.total_calls > 0 ? Math.round(s.avg_probability / s.total_calls) : 0,
      })).sort((a, b) => b.total_score - a.total_score);

      setSummaries(result);
      setLoading(false);
    };
    load();
  }, [user, isAdmin, isAdminBD]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <Trophy className="w-12 h-12 mx-auto text-muted-foreground/30" />
        <p className="text-muted-foreground">Aún no hay sesiones registradas</p>
        <p className="text-xs text-muted-foreground">Inicia una llamada desde "Call Mode" para comenzar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-semibold text-foreground flex items-center justify-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" /> Ranking de BDs
        </h3>
        <p className="text-sm text-muted-foreground">Rendimiento basado en sesiones del Closing Engine</p>
      </div>

      <div className="space-y-3">
        {summaries.map((s, i) => {
          const earnedMedals = MEDALS.filter(m => m.condition(s));
          return (
            <Card key={s.bd_id} className={i === 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="text-2xl font-bold text-muted-foreground w-8 text-center">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{s.bd_name}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{s.total_calls} llamadas</span>
                    <span>{s.closed} cerradas</span>
                    <span>{s.total_calls > 0 ? Math.round(s.closed / s.total_calls * 100) : 0}% cierre</span>
                  </div>
                  {earnedMedals.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {earnedMedals.map(m => (
                        <Badge key={m.id} variant="secondary" className="text-[10px] gap-0.5">
                          {m.emoji} {m.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{s.total_score}</p>
                  <p className="text-[10px] text-muted-foreground">puntos</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default GamificationPanel;
