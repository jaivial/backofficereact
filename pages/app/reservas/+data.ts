import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { CalendarDay, ConfigDailyLimit, DashboardMetrics } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Reservas" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  const [bookingsRes, calRes, limitRes, metricsRes] = await Promise.all([
    api.reservas.list({ date, page: 1, count: 15, sort: "reservation_time", dir: "asc" }),
    (() => {
      const [y, m] = date.split("-").map((x) => Number(x));
      const year = Number.isFinite(y) ? y : new Date().getFullYear();
      const month = Number.isFinite(m) ? m : new Date().getMonth() + 1;
      return api.calendar.getMonth({ year, month });
    })(),
    api.config.getDailyLimit(date),
    api.dashboard.getMetrics(date),
  ]);

  let error: string | null = null;
  const bookings = bookingsRes.success ? bookingsRes.bookings : [];
  const total_count = bookingsRes.success ? bookingsRes.total_count : 0;
  const page = bookingsRes.success ? bookingsRes.page : 1;
  const count = bookingsRes.success ? bookingsRes.count : 15;
  if (!bookingsRes.success) error = bookingsRes.message || "Error cargando reservas";

  const calendarDays: CalendarDay[] = calRes.success ? (calRes as any).data : [];
  const dailyLimit: ConfigDailyLimit | null = limitRes.success ? (limitRes as any) : null;
  const metrics: DashboardMetrics | null = metricsRes.success ? (metricsRes as any).metrics : null;

  return {
    date,
    bookings,
    total_count,
    page,
    count,
    calendarDays,
    dailyLimit,
    metrics,
    error,
  };
}
