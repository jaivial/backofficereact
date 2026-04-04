import { useCallback, useEffect, useState } from "react";

export function usePreviewView(defaultView: "grid" | "table" | "member" = "grid", storageKey: string) {
  const [view, setView] = useState<"grid" | "table" | "member">(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(storageKey);
        if (stored === "table" || stored === "grid" || stored === "member") return stored;
      }
    } catch {
      // ignore
    }
    return defaultView;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, view);
    } catch {
      // ignore
    }
  }, [view, storageKey]);

  return [view, setView] as const;
}
