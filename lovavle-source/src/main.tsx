import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./index.css";

// Force SW update check on every page load/focus
if ("serviceWorker" in navigator) {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com");

  if (isPreviewHost || isInIframe) {
    // Unregister SW in preview/iframe to avoid stale caches during development
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => r.unregister())
    );
  } else {
    // In production: trigger one immediate update check on load.
    // The full update lifecycle (polling, prompts, reload) is handled by
    // <UpdatePrompt /> so it can react to route + user activity.
    navigator.serviceWorker.ready.then((registration) => {
      registration.update().catch(() => {});
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
