import { useState, useEffect, useCallback } from "react";
import { isMT5Connected, clearMT5Token } from "@/services/mt5Api";

export function useMT5Connection() {
  const [connected, setConnected] = useState(isMT5Connected);

  const refresh = useCallback(() => {
    setConnected(isMT5Connected());
  }, []);

  const disconnect = useCallback(() => {
    clearMT5Token();
    setConnected(false);
  }, []);

  useEffect(() => {
    // listen for storage changes from other tabs
    const handler = () => refresh();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refresh]);

  return { connected, refresh, disconnect };
}
