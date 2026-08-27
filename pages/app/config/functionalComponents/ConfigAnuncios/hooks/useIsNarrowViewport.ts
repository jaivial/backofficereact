import { useEffect, useState } from "react";

const QUERY = "(max-width: 640px)";

/**
 * SSR-safe matchMedia flag for the ad preview's natural mobile fold. Starts
 * false so SSR and the first client paint render the desktop DOM (no
 * hydration mismatch), then syncs in an effect — on real phones the preview
 * swaps to the mobile DOM right after hydration.
 */
export function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(QUERY);
    const sync = () => setIsNarrow(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return isNarrow;
}
