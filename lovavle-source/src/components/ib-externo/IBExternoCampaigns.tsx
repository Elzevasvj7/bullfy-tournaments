import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/toastUtils";
import { Loader2, Calendar, Download, ExternalLink, CheckCircle2, Circle } from "lucide-react";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  promo_code: string | null;
  benefits: string | null;
  status: string;
  stop_reason: string | null;
}

interface Task {
  id: string;
  campaign_id: string;
  day_number: number;
  title: string;
  instruction: string;
  content_type: string;
  file_urls: string[];
  display_order: number;
}

interface Assignment {
  id: string;
  campaign_id: string;
  ib_id: string;
  assigned_at: string;
}

interface Completion {
  id: string;
  task_id: string;
  assignment_id: string;
}

const IBExternoCampaigns = () => {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  const ibId = profile?.ib_id;

  const fetchCampaigns = async () => {
    if (!ibId) { setLoading(false); return; }
    // Get assignments for this IB
    const { data: assignData } = await supabase
      .from("campaign_ib_assignments")
      .select("id, campaign_id, ib_id, assigned_at")
      .eq("ib_id", ibId);

    if (!assignData || assignData.length === 0) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    const campaignIds = assignData.map((a) => a.campaign_id);
    const { data: campData } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .in("id", campaignIds)
      .in("status", ["active", "completed", "stopped"])
      .order("start_date", { ascending: false });

    setCampaigns((campData as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, [ibId]);

  const expandCampaign = async (campaignId: string) => {
    if (expanded === campaignId) { setExpanded(null); return; }
    setExpanded(campaignId);

    const [tasksRes, assignRes] = await Promise.all([
      supabase.from("campaign_tasks").select("*").eq("campaign_id", campaignId).order("display_order"),
      supabase.from("campaign_ib_assignments").select("*").eq("campaign_id", campaignId).eq("ib_id", ibId!),
    ]);

    setTasks((tasksRes.data as any[]) ?? []);
    const assign = (assignRes.data as any[])?.[0] || null;
    setAssignment(assign);

    if (assign) {
      const { data: compData } = await supabase
        .from("campaign_task_completions")
        .select("id, task_id, assignment_id")
        .eq("assignment_id", assign.id);
      setCompletions((compData as any[]) ?? []);
    }
  };

  const isCompleted = (taskId: string) => completions.some((c) => c.task_id === taskId);

  const toggleTask = async (taskId: string, campaignId: string) => {
    if (!assignment || toggling) return;
    setToggling(taskId);

    const existing = completions.find((c) => c.task_id === taskId);
    try {
      if (existing) {
        await supabase.from("campaign_task_completions").delete().eq("id", existing.id);
        setCompletions(completions.filter((c) => c.id !== existing.id));
        toast.success("Tarea desmarcada");
      } else {
        const { data, error } = await supabase.from("campaign_task_completions").insert({
          task_id: taskId,
          assignment_id: assignment.id,
        }).select("id, task_id, assignment_id").single();
        if (error) throw error;
        setCompletions([...completions, data as any]);
        toast.success("¡Tarea completada! 🎉");

        // Notify campaign creator and optional ventas/marketing user
        try {
          const task = tasks.find((t) => t.id === taskId);
          const campaign = campaigns.find((c) => c.id === campaignId);
          const { error: fnError } = await supabase.functions.invoke("send-campaign-notification", {
            body: {
              campaign_id: campaignId,
              type: "task_completed",
              completed_by_ib_id: ibId,
              task_title: task?.title || "",
              campaign_name: campaign?.name || "",
            },
          });
          if (fnError) {
            console.error("Task completion notification error:", fnError);
          }
        } catch (e) {
          console.error("Task completion notification failed:", e);
        }
      }
    } catch (err: any) {
      if (err?.message?.includes("foreign key") || err?.code === "23503") {
        toast.error("Esta tarea fue modificada. Recargando...");
        await expandCampaign(campaignId);
      } else {
        toast.error("Error: " + (err.message || "desconocido"));
      }
    } finally {
      setToggling(null);
    }
  };

  const getTaskDate = (dayNumber: number) => {
    if (!assignment?.assigned_at) return new Date();
    return addDays(new Date(assignment.assigned_at), dayNumber - 1);
  };

  const completedCount = completions.length;
  const totalTasks = tasks.length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mis Campañas</h2>
        <p className="text-sm text-muted-foreground mt-1">Sigue el plan paso a paso y marca cada tarea al completarla</p>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No tienes campañas asignadas por el momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const isExpanded = expanded === campaign.id;
            return (
              <Card key={campaign.id} className="overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 hover:bg-secondary/30 transition-colors"
                  onClick={() => expandCampaign(campaign.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground text-lg">{campaign.name}</h3>
                         <Badge variant={campaign.status === "active" ? "default" : campaign.status === "stopped" ? "destructive" : "secondary"}>
                           {campaign.status === "active" ? "Activa" : campaign.status === "stopped" ? "Detenida" : "Completada"}
                         </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        <Calendar className="w-3.5 h-3.5 inline mr-1" />
                        {format(new Date(campaign.start_date), "dd MMM", { locale: es })} → {format(new Date(campaign.end_date), "dd MMM yyyy", { locale: es })}
                        {campaign.promo_code && <span className="ml-3">Código: <strong className="text-primary">{campaign.promo_code}</strong></span>}
                      </p>
                    </div>
                    <span className="text-muted-foreground text-xl">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                    {/* Description & Benefits */}
                    {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}
                    {campaign.benefits && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <p className="text-sm font-semibold text-primary mb-1">🎁 Tus Beneficios</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.benefits}</p>
                      </div>
                    )}

                    {campaign.stop_reason && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                        <p className="text-sm font-semibold text-destructive mb-1">🛑 Campaña Detenida</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.stop_reason}</p>
                      </div>
                    )}

                    {/* Progress */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-secondary rounded-full h-2.5">
                        <div
                          className="bg-primary h-2.5 rounded-full transition-all"
                          style={{ width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-foreground">{completedCount}/{totalTasks}</span>
                    </div>

                    {/* Tasks Checklist */}
                    <div className="space-y-2">
                      {tasks.map((task) => {
                        const done = isCompleted(task.id);
                        const taskDate = getTaskDate(task.day_number);
                        const today = new Date();
                        const isToday = format(taskDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                        const isFuture = taskDate > today && !isToday;
                        const isPast = taskDate < today && !isToday;

                        return (
                          <div
                            key={task.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                              isFuture
                                ? "opacity-50 border-border bg-muted/30"
                                : done
                                  ? "bg-green-500/5 border-green-500/20"
                                  : isToday
                                    ? "bg-primary/5 border-primary/20"
                                    : "border-border hover:bg-secondary/30"
                            }`}
                          >
                            <button
                              onClick={() => toggleTask(task.id, campaign.id)}
                              disabled={toggling === task.id || isFuture}
                              className="mt-0.5 shrink-0"
                            >
                              {toggling === task.id ? (
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                              ) : done ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-primary transition-colors" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] ${isToday ? "border-primary text-primary" : ""}`}>
                                  Día {task.day_number} · {format(taskDate, "dd MMM", { locale: es })}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px]">{task.content_type}</Badge>
                                {isToday && <Badge className="text-[10px] bg-primary">HOY</Badge>}
                                {isFuture && <Badge variant="outline" className="text-[10px]">🔒 Próximamente</Badge>}
                              </div>
                              <p className={`text-sm font-medium mt-1 ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {task.title}
                              </p>
                              <p className={`text-xs mt-0.5 ${done ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                                {task.instruction}
                              </p>

                              {/* Files */}
                              {(task.file_urls || []).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {task.file_urls.map((url, fi) => {
                                    const fileName = url.split("/").pop() || "Archivo";
                                    const isExternal = url.startsWith("http") && !url.includes("supabase");
                                    return (
                                      <a
                                        key={fi}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs bg-secondary hover:bg-secondary/80 text-primary rounded px-2 py-1 transition-colors"
                                      >
                                        {isExternal ? <ExternalLink className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                                        <span className="truncate max-w-[120px]">{fileName.substring(0, 25)}</span>
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IBExternoCampaigns;
