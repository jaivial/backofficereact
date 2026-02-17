import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { FichajeSchedule, FichajeState, Member } from "../../../api/types";

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
  config({ title: "Fichaje" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const roleImportance = Number((pageContext as any)?.bo?.session?.user?.roleImportance ?? 0);
  const isAdminView = Number.isFinite(roleImportance) && roleImportance >= 90;
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let state: FichajeState | null = null;
  let members: Member[] = [];
  let schedules: FichajeSchedule[] = [];
  let error: string | null = null;

  try {
    if (isAdminView) {
      const [stateRes, membersRes, schedulesRes] = await Promise.all([api.fichaje.getState(), api.members.list(), api.horarios.list(date)]);
      if (stateRes.success) state = stateRes.state;
      else error = stateRes.message || "No se pudo cargar el estado de fichaje";

      if (membersRes.success) members = membersRes.members;
      else if (!error) error = membersRes.message || "No se pudieron cargar miembros";

      if (schedulesRes.success) schedules = schedulesRes.schedules;
      else if (!error) error = schedulesRes.message || "No se pudieron cargar horarios";
    } else {
      const res = await api.fichaje.getState();
      if (res.success) state = res.state;
      else error = res.message || "No se pudo cargar el estado de fichaje";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudo cargar el estado de fichaje";
  }

  return { date, isAdminView, state, members, schedules, error };
}
