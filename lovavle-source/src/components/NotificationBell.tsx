import { useEffect, useState, useRef } from "react";
import { Bell, Check, CheckCheck, Users, ArrowRightLeft, FileText, RefreshCw, Play, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  reference_id: string | null;
  reference_type: string | null;
  read: boolean;
  created_at: string;
}

const typeIcon: Record<string, typeof Users> = {
  new_ib: Users,
  status_change: RefreshCw,
  conditions_update: FileText,
  bd_reassign: ArrowRightLeft,
  ops_new_deal: Play,
  ops_deal_assigned: Users,
  ops_deal_taken: Play,
  ops_deal_completed: CheckCircle2,
  ops_status_change: RefreshCw,
  ops_notes_update: FileText,
};

const typeColor: Record<string, string> = {
  new_ib: "text-primary",
  status_change: "text-amber-400",
  conditions_update: "text-emerald-400",
  bd_reassign: "text-sky-400",
  ops_new_deal: "text-primary",
  ops_deal_assigned: "text-sky-400",
  ops_deal_taken: "text-amber-400",
  ops_deal_completed: "text-emerald-400",
  ops_status_change: "text-amber-400",
  ops_notes_update: "text-sky-400",
};

interface NotificationBellProps {
  size?: "default" | "large";
  showLabel?: boolean;
}

const NotificationBell = ({ size = "default", showLabel = false }: NotificationBellProps) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setNotifications(data as unknown as Notification[]);
  };

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    let removed = false;
    const channelName = `notifications-bell-${user.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
      (payload) => {
        if (!removed) {
          setNotifications((prev) => [payload.new as unknown as Notification, ...prev].slice(0, 30));
        }
      }
    );

    // Subscribe in next microtask to avoid race with strict-mode double-mount
    const timer = setTimeout(() => {
      if (!removed) channel.subscribe();
    }, 0);

    return () => {
      removed = true;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true } as any).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true } as any).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Ahora";
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  };

  const isLarge = size === "large";

  return (
    <div className="relative flex items-center gap-3" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors",
          isLarge ? "p-2.5" : "p-2"
        )}
      >
        <Bell className={isLarge ? "w-7 h-7" : "w-5 h-5"} />
        {unreadCount > 0 && (
          <span className={cn(
            "absolute flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground",
            isLarge
              ? "-top-1 -right-1 h-5 min-w-5 px-1.5 text-[11px]"
              : "-top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px]"
          )}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {showLabel && unreadCount > 0 && (
        <span className="text-xs font-medium text-primary animate-pulse">
          Tienes mensajes sin leer
        </span>
      )}

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-muted-foreground" onClick={markAllRead}>
                <CheckCheck className="w-3 h-3" /> Marcar todas
              </Button>
            )}
          </div>

          {/* List */}
          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground/60">
                Sin notificaciones
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {notifications.map((n) => {
                  const Icon = typeIcon[n.type] || Bell;
                  const color = typeColor[n.type] || "text-muted-foreground";
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-secondary/50",
                        !n.read && "bg-primary/5"
                      )}
                      onClick={() => !n.read && markAsRead(n.id)}
                    >
                      <div className={cn("mt-0.5 shrink-0", color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-xs font-medium truncate", n.read ? "text-muted-foreground" : "text-foreground")}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">{formatTime(n.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mt-0.5">{n.message}</p>
                      </div>
                      {!n.read && <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
