import { Dispatch, SetStateAction, useEffect, useState } from "react";

export function useSessionStorageState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const stored = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(key, JSON.stringify(state));
      window.sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore storage write errors
    }
  }, [key, state]);

  return [state, setState];
}