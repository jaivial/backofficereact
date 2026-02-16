import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { Member } from "../../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

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
  config({ title: memberId > 0 ? `Miembro #${memberId} · Informacion` : "Miembro" });

  if (!memberId) {
    return {
      memberId: 0,
      member: null as Member | null,
      error: "Miembro no valido" as string | null,
    };
  }

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let member: Member | null = null;

  try {
    const res = await api.members.get(memberId);
    if (res.success) member = res.member;
    else error = res.message || "Error cargando miembro";
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando miembro";
  }

  return { memberId, member, error };
}
