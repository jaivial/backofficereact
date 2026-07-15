import { useEffect, useRef, useState } from "react";

export function usePreviewView(defaultView: "table" | "member" = "table", storageKey: string) {
  // Initialise to the SSR default so the first client render matches the
  // server-rendered markup. Reading localStorage here would cause a hydration
  // mismatch that breaks portaled popovers (e.g. the date pickers).
  const [view, setView] = useState<"table" | "member">(defaultView);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "table" || stored === "member") setView(stored);
    } catch {
      // ignore
    }
    hydrated.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(storageKey, view);
    } catch {
      // ignore
    }
  }, [view, storageKey]);

  return [view, setView] as const;
}
