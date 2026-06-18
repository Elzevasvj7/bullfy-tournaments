import { useEffect, useRef, useState } from "react";

/**
 * Tracks user activity (mouse, keyboard, touch, scroll).
 * Returns true while the user has interacted in the last `idleMs` ms.
 */
export function useUserActivity(idleMs: number = 30_000) {
  const [isActive, setIsActive] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const reset = () => {
      setIsActive(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setIsActive(false), idleMs);
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
    ];

    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, reset));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [idleMs]);

  return isActive;
}
