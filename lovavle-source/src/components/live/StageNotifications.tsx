import { useEffect, useRef, useState } from "react";
import { Hand, MessageSquare, UserPlus, X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StageNotification {
  id: string;
  type: "chat" | "hand" | "join" | "poll";
  title: string;
  body?: string;
  createdAt: number;
}

interface StageNotificationsProps {
  notifications: StageNotification[];
  onDismiss: (id: string) => void;
  /** Optional click handler — useful to open the matching tool panel. */
  onActivate?: (n: StageNotification) => void;
  /** Auto-dismiss timeout in ms. Default 5000. */
  autoDismissMs?: number;
}

const ICONS: Record<StageNotification["type"], typeof Hand> = {
  chat: MessageSquare,
  hand: Hand,
  join: UserPlus,
  poll: BarChart3,
};

const COLORS: Record<StageNotification["type"], string> = {
  chat: "from-sky-500/90 to-blue-600/90",
  hand: "from-amber-400/90 to-orange-500/90",
  join: "from-emerald-500/90 to-teal-600/90",
  poll: "from-violet-500/90 to-purple-600/90",
};

/**
 * Floating overlay notifications shown ON TOP of the video stage.
 * Used in every Bullfy Live mode (Stream, Meeting, Bullfy Family, Webinar).
 */
const StageNotifications = ({
  notifications,
  onDismiss,
  onActivate,
  autoDismissMs = 5000,
}: StageNotificationsProps) => {
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    notifications.forEach((n) => {
      if (timers.current.has(n.id)) return;
      const t = window.setTimeout(() => {
        onDismiss(n.id);
        timers.current.delete(n.id);
      }, autoDismissMs);
      timers.current.set(n.id, t);
    });
    // Cleanup timers for notifications that no longer exist
    const ids = new Set(notifications.map((n) => n.id));
    timers.current.forEach((t, id) => {
      if (!ids.has(id)) {
        window.clearTimeout(t);
        timers.current.delete(id);
      }
    });
  }, [notifications, onDismiss, autoDismissMs]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  if (notifications.length === 0) return null;

  // Show only the latest 3 to avoid covering the video.
  const visible = notifications.slice(-3);

  return (
    <div className="pointer-events-none absolute top-3 right-3 z-30 flex flex-col gap-2 items-end max-w-[80%]">
      {visible.map((n) => {
        const Icon = ICONS[n.type];
        return (
          <div
            key={n.id}
            className={`pointer-events-auto group flex items-start gap-2 pl-3 pr-2 py-2 rounded-lg shadow-lg backdrop-blur-md bg-gradient-to-r ${COLORS[n.type]} text-white border border-white/20 animate-in slide-in-from-right-4 fade-in duration-200 max-w-xs`}
            role="status"
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <button
              type="button"
              onClick={() => onActivate?.(n)}
              className="flex-1 text-left min-w-0"
            >
              <p className="text-xs font-bold leading-tight truncate">{n.title}</p>
              {n.body && (
                <p className="text-[11px] opacity-90 leading-tight truncate">{n.body}</p>
              )}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(n.id)}
              className="h-5 w-5 p-0 text-white/80 hover:text-white hover:bg-white/15 shrink-0"
              aria-label="Cerrar notificación"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default StageNotifications;
