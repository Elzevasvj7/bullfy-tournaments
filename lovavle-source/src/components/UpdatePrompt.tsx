import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useUserActivity } from "@/hooks/useUserActivity";

/**
 * Hybrid auto-update system for the PWA.
 *
 * - Listens for new service worker versions (instant detection via `updatefound`).
 * - Polls registration.update() every 2 minutes as a safety net.
 * - On safe routes OR while the user is idle: auto-reloads silently.
 * - On protected routes (live, zoom, fake-live...) while user is active:
 *   shows a non-intrusive toast with an "Update now" button.
 */

const SAFE_ROUTES = [
  "/login",
  "/registro",
  "/reset-password",
  "/pendiente",
  "/presentacion",
];

const SAFE_ROUTE_PREFIXES = [
  "/newsletter-results/",
  "/p/",
];

const PROTECTED_ROUTES_PREFIXES = [
  "/live",
  "/zoom",
  "/live-egress",
  "/live/guest",
  "/live/fake",
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES_PREFIXES.some((p) => pathname.startsWith(p));
}

function isSafeRoute(pathname: string): boolean {
  if (SAFE_ROUTES.includes(pathname)) return true;
  if (pathname === "/") return true;
  return SAFE_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));
}

export function UpdatePrompt() {
  const location = useLocation();
  const isActive = useUserActivity(30_000);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const reloadTriggered = useRef(false);
  const toastIdRef = useRef<string | number | null>(null);

  // Activate the waiting worker and reload once it takes control.
  const applyUpdate = (worker: ServiceWorker | null) => {
    if (!worker || reloadTriggered.current) return;
    reloadTriggered.current = true;
    try {
      worker.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // ignore
    }
    // Fallback: reload after a short delay if controllerchange doesn't fire
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // Register SW listeners once.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const isPreviewHost =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");
    if (isPreviewHost || isInIframe) return;

    let intervalId: number | null = null;

    navigator.serviceWorker.ready.then((registration) => {
      // If a worker is already waiting on load, surface it.
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
      }

      // Detect new versions as soon as they are found.
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });

      // Poll for updates every 2 minutes.
      intervalId = window.setInterval(() => {
        registration.update().catch(() => {});
      }, 2 * 60 * 1000);

      // Also check when the tab regains focus.
      const onVisibility = () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
    });

    // Reload when the new SW takes control.
    const onControllerChange = () => {
      if (reloadTriggered.current) return;
      reloadTriggered.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // Decide what to do when there is a waiting worker.
  useEffect(() => {
    if (!waitingWorker) return;

    const pathname = location.pathname;
    const protectedRoute = isProtectedRoute(pathname);
    const safeRoute = isSafeRoute(pathname);

    // 1) Safe routes → reload silently right away.
    if (safeRoute && !protectedRoute) {
      applyUpdate(waitingWorker);
      return;
    }

    // 2) Protected routes (live/zoom) → ALWAYS show toast, never auto-reload.
    if (protectedRoute) {
      if (toastIdRef.current !== null) return;
      toastIdRef.current = toast("🚀 Nueva versión disponible", {
        description: "Actualiza cuando termines tu transmisión para ver los últimos cambios.",
        duration: Infinity,
        action: {
          label: "Actualizar",
          onClick: () => applyUpdate(waitingWorker),
        },
        icon: <RefreshCw className="h-4 w-4" />,
      });
      return;
    }

    // 3) Regular routes → show toast; if user goes idle, auto-reload.
    if (toastIdRef.current === null) {
      toastIdRef.current = toast("🚀 Nueva versión disponible", {
        description: "Pulsa actualizar o se aplicará automáticamente cuando estés inactivo.",
        duration: Infinity,
        action: {
          label: "Actualizar ahora",
          onClick: () => applyUpdate(waitingWorker),
        },
        icon: <RefreshCw className="h-4 w-4" />,
      });
    }

    if (!isActive) {
      // Small grace period so a brief idle blip doesn't yank the page.
      const t = window.setTimeout(() => applyUpdate(waitingWorker), 2000);
      return () => window.clearTimeout(t);
    }
  }, [waitingWorker, location.pathname, isActive]);

  return null;
}

export default UpdatePrompt;
