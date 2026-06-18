import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Video, BarChart3, Scissors, Crown } from "lucide-react";

interface UsageData {
  tier: string;
  enabled: boolean;
  monthly_clip_limit: number;
  monthly_analysis_limit: number;
  can_publish_social: boolean;
  can_auto_clip: boolean;
  can_remove_branding: boolean;
  clips_used: number;
  analyses_used: number;
}

const VideoStudioUsageBanner = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchUsage();
  }, [user]);

  const fetchUsage = async () => {
    if (!user) return;

    const [accessRes, usageRes] = await Promise.all([
      supabase
        .from("video_studio_access")
        .select("tier, enabled, monthly_clip_limit, monthly_analysis_limit, can_publish_social, can_auto_clip, can_remove_branding")
        .eq("user_id", user.id)
        .maybeSingle(),
      (() => {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        return supabase
          .from("video_studio_usage_log")
          .select("action")
          .eq("user_id", user.id)
          .gte("created_at", startOfMonth.toISOString());
      })(),
    ]);

    if (!accessRes.data) {
      setLoading(false);
      return;
    }

    const a = accessRes.data;
    const logs = usageRes.data || [];
    setUsage({
      tier: a.tier,
      enabled: a.enabled,
      monthly_clip_limit: a.monthly_clip_limit,
      monthly_analysis_limit: a.monthly_analysis_limit,
      can_publish_social: a.can_publish_social,
      can_auto_clip: a.can_auto_clip,
      can_remove_branding: a.can_remove_branding,
      clips_used: logs.filter((l: any) => l.action === "clip").length,
      analyses_used: logs.filter((l: any) => l.action === "analysis").length,
    });
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!usage) return null;

  const tierLabel = usage.tier.charAt(0).toUpperCase() + usage.tier.slice(1);
  const tierColors: Record<string, string> = { free: "outline", pro: "secondary", enterprise: "default" };
  const clipPercent = usage.monthly_clip_limit > 0 ? Math.min((usage.clips_used / usage.monthly_clip_limit) * 100, 100) : 0;
  const analysisPercent = usage.monthly_analysis_limit > 0 ? Math.min((usage.analyses_used / usage.monthly_analysis_limit) * 100, 100) : 0;

  return (
    <Card className="bg-muted/30 border-dashed">
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            <Badge variant={tierColors[usage.tier] as any}>{tierLabel}</Badge>
          </div>

          <div className="flex-1 min-w-[200px] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><Scissors className="w-3 h-3" /> Clips</span>
              <span className="font-mono">{usage.clips_used} / {usage.monthly_clip_limit >= 9999 ? "∞" : usage.monthly_clip_limit}</span>
            </div>
            <Progress value={clipPercent} className="h-1.5" />
          </div>

          <div className="flex-1 min-w-[200px] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Análisis</span>
              <span className="font-mono">{usage.analyses_used} / {usage.monthly_analysis_limit >= 9999 ? "∞" : usage.monthly_analysis_limit}</span>
            </div>
            <Progress value={analysisPercent} className="h-1.5" />
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground">
            {usage.can_publish_social && <Badge variant="outline" className="text-[10px]">Social ✅</Badge>}
            {usage.can_auto_clip && <Badge variant="outline" className="text-[10px]">Auto-Clip ✅</Badge>}
            {usage.can_remove_branding && <Badge variant="outline" className="text-[10px]">Sin Marca ✅</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoStudioUsageBanner;
