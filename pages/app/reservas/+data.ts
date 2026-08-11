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
export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Reservas" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();

  return {
    date,
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
