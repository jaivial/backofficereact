import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../../api/client";
import type { MemberStats, MemberTimeBalance } from "../../../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseMemberId(pageContext: PageContextServer): number {
  const fromRoute = Number((pageContext as any).routeParams?.memberId);
  if (Number.isFinite(fromRoute) && fromRoute > 0) return fromRoute;

  const m = String(pageContext.urlPathname ?? "").match(/\/app\/miembros\/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export async function data(pageContext: PageContextServer) {
  const memberId = parseMemberId(pageContext);
  const config = useConfig();
  config({ title: memberId > 0 ? `Miembro #${memberId} · Estadisticas` : "Estadisticas" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();

  if (!memberId) {
    return {
      memberId: 0,
      date,
      initialStats: null as MemberStats | null,
      initialBalance: null as MemberTimeBalance | null,
      error: "Miembro no valido" as string | null,
    };
  }

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let initialStats: MemberStats | null = null;
  let initialBalance: MemberTimeBalance | null = null;

  try {
    const [statsRes, balanceRes] = await Promise.all([
      api.members.getStats(memberId, { view: "weekly", date }),
      api.members.getTimeBalance(memberId, date),
    ]);

    if (statsRes.success) initialStats = statsRes;
    else error = statsRes.message || "Error cargando estadisticas";

    if (balanceRes.success) initialBalance = balanceRes;
    else if (!error) error = balanceRes.message || "Error cargando bolsa trimestral";
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando estadisticas";
  }

  return { memberId, date, initialStats, initialBalance, error };
}
