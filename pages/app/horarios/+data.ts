import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { CalendarDay, FichajeSchedule, HorarioMonthPoint, Member } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYearMonth(dateISO: string): { year: number; month: number } {
  const [y, m] = dateISO.split("-").map((v) => Number(v));
  const now = new Date();
  return {
    year: Number.isFinite(y) ? y : now.getFullYear(),
    month: Number.isFinite(m) ? m : now.getMonth() + 1,
  };
}

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Horarios" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const { year, month } = parseYearMonth(date);
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let members: Member[] = [];
  let schedules: FichajeSchedule[] = [];
  let monthDays: HorarioMonthPoint[] = [];
  let bookingMonthDays: CalendarDay[] = [];

  try {
    const [membersRes, schedulesRes, monthRes, bookingMonthRes] = await Promise.all([
      api.members.list(),
      api.horarios.list(date),
      api.horarios.month({ year, month }),
      api.calendar.getMonth({ year, month }),
    ]);

    if (membersRes.success) members = membersRes.members;
    else error = membersRes.message || "Error cargando miembros";

    if (schedulesRes.success) schedules = schedulesRes.schedules;
    else if (!error) error = schedulesRes.message || "Error cargando horarios";

    if (monthRes.success) monthDays = monthRes.days;
    else if (!error) error = monthRes.message || "Error cargando calendario de horarios";

    if (bookingMonthRes.success) bookingMonthDays = bookingMonthRes.data;
    else if (!error) error = bookingMonthRes.message || "Error cargando calendario de reservas";
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando horarios";
  }

  return { date, year, month, members, schedules, monthDays, bookingMonthDays, error };
}
