import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";

export type Data = Awaited<ReturnType<typeof data>>;

type FichajeEntry = {
  id: number;
  date: string;
  entry_time: string | null;
  exit_time: string | null;
  total_hours: number | null;
};

function todayEntryFromActive(active: {
  id: number;
  workDate: string;
  startTime: string;
} | null): FichajeEntry | null {
  if (!active) return null;
  return {
    id: active.id,
    date: active.workDate,
    entry_time: active.startTime,
    exit_time: null,
    total_hours: null,
  };
}

// Mobile fichaje is a personal clock-in/out screen. On first load it needs the
// current clock-in state so the page renders the correct button (Entrar/Salir)
// and today's entry time immediately. `api.fichaje.getState()` returns the
// active entry for the logged-in user; we map it to the consumer's shape.
// `entries` (history) and `today_summary.total_hours` have no SSR source from
// the typed client and are left empty/null; the page hides those sections when
// null/empty, so first paint is correct.
export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Fichaje" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let today_entry: FichajeEntry | null = null;

  try {
    const res = await api.fichaje.getState();
    if (res.success && res.state?.activeEntry) {
      today_entry = todayEntryFromActive({
        id: res.state.activeEntry.id,
        workDate: res.state.activeEntry.workDate,
        startTime: res.state.activeEntry.startTime,
      });
    }
  } catch {
    // Swallow: render as not clocked in.
    today_entry = null;
  }

  return { entries: [] as FichajeEntry[], today_entry, today_summary: null };
}
