import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// SSR no longer blocks on backend data for this page. The shell renders
// immediately and reservas.tsx fetches bookings/calendar/metrics client-side
// on mount (and on date change). This cuts first-load TTFB and, because the
// shared app shell survives, makes tab SPA navigation feel instant.
//
// The one value served here is the persisted display-mode preference
// (tabla vs grid): it rides the existing /api/admin/me session handshake (see
// pageContext.bo.session.preferences) so the correct tab is selected on first
// paint with no extra round-trip.
export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Reservas" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const rawDisplayMode = pageContext.bo?.session?.preferences?.reservasDisplayMode;
  const displayMode: "tabla" | "grid" = rawDisplayMode === "grid" ? "grid" : "tabla";

  return {
    date,
    displayMode,
    bookings: [],
    floors: [],
    total_count: 0,
    page: 1,
    count: 15,
    calendarDays: [],
    dailyLimit: null,
    metrics: null,
    day: null,
    error: null,
  };
}
