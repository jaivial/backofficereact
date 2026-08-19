import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

// SSR no longer blocks on backend data for this page. The shell renders
// immediately and config.tsx fetches defaults/floors/restaurant-info
// client-side on mount (and via the Recargar button).
export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Configuracion" });

  // Accordion state for "Reparto por hora" rides the session preferences so the
  // first paint already matches the stored value (default: expanded).
  const hourSplitDetailsOpen = pageContext.bo?.session?.preferences?.hourSplitDetailsOpenDefault !== "0";

  return { defaults: null, floors: [], restaurantInfo: null, hourSplitDetailsOpen, error: null };
}
