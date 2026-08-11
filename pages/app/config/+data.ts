import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

// SSR no longer blocks on backend data for this page. The shell renders
// immediately and config.tsx fetches defaults/floors/restaurant-info
// client-side on mount (and via the Recargar button).
export async function data(_pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Configuracion" });

  return { defaults: null, floors: [], restaurantInfo: null, error: null };
}
