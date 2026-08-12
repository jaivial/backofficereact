import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";

export type Data = Awaited<ReturnType<typeof data>>;

type ScheduleEntry = {
  member_name: string;
  role: string;
  entry_time: string | null;
  exit_time: string | null;
};

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Mobile horarios shows who is working on a given day.
// The consumer (+Page.tsx) expects entries shaped as:
//   { member_name, role, entry_time, exit_time }
// The only role source (BOSession.user.role) is per-user, not per-member, and the
// `Member` type exposes no role/position field, so `role` is left empty here.
// Returning names + times (vs the previous always-empty list) is a strict first-
// paint improvement; the page already renders an empty role string gracefully.
export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Horarios" });

  const date =
    typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let entries: ScheduleEntry[] = [];

  try {
    const res = await api.horarios.list(date);
    if (res.success && Array.isArray(res.schedules)) {
      entries = res.schedules.map((s) => ({
        member_name: s.memberName,
        role: "",
        entry_time: s.startTime,
        exit_time: s.endTime,
      }));
    }
  } catch {
    // Swallow: render empty list so the page shows the empty state.
    entries = [];
  }

  return { entries, date };
}
