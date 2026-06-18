import { useEffect, useState } from "react";
import type { Room } from "livekit-client";

/**
 * Returns true only when the LiveKit Room object is connected and safe to attach listeners to.
 * Prevents "null is an object (evaluating 'X.room')" crashes from registering events
 * on a Room context that exists but has no internal engine yet.
 */
export function useLiveKitReady(room: Room | null | undefined): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!room) {
      setReady(false);
      return;
    }

    let cancelled = false;

    const check = () => {
      if (cancelled) return;
      // ConnectionState values: "disconnected" | "connecting" | "connected" | "reconnecting"
      // IMPORTANT: do not call room.on()/off() here.
      // The public guest flow can mount before LiveKit finishes creating its internal
      // engine, and registering listeners at that moment is exactly what triggers
      // the recurring crash: "Cannot read properties of null (reading 'room')".
      const state = (room as any)?.state;
      setReady(state === "connected");
    };

    check();
    const interval = window.setInterval(check, 120);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [room]);

  return ready;
}
