import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../../api/client";
import type { Member, MemberStats } from "../../../../../api/types";

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
  config({ title: memberId > 0 ? `Miembro #${memberId} · Contrato` : "Contrato" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();

  if (!memberId) {
    return {
      memberId: 0,
      member: null as Member | null,
      initialStats: null as MemberStats | null,
      date,
      error: "Miembro no valido" as string | null,
    };
  }

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let member: Member | null = null;
  let initialStats: MemberStats | null = null;

  try {
    const [memberRes, statsRes] = await Promise.all([
      api.members.get(memberId),
      api.members.getStats(memberId, { view: "weekly", date }),
    ]);

    if (memberRes.success) member = memberRes.member;
    else error = memberRes.message || "Error cargando miembro";

    if (statsRes.success) initialStats = statsRes;
    else if (!error) error = statsRes.message || "Error cargando datos de contrato";
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando contrato";
  }

  return { memberId, member, initialStats, date, error };
}
