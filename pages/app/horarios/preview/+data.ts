import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { FichajeSchedule, Member } from "../../../../api/types";
import { todayISO } from "./utils";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Horarios Preview" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let members: Member[] = [];
  let schedules: FichajeSchedule[] = [];

  try {
    const [membersRes, schedulesRes] = await Promise.all([api.members.list(), api.horarios.list(date)]);
    if (membersRes.success) members = membersRes.members;
    else error = membersRes.message || "Error cargando miembros";

    if (schedulesRes.success) schedules = schedulesRes.schedules;
    else if (!error) error = schedulesRes.message || "Error cargando horarios";
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando preview de horarios";
  }

  return { date, members, schedules, error };
}
