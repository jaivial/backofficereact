import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { Member, RoleCatalogItem } from "../../../../api/types";

export type MemberRoleInfo = {
  slug: string;
  label: string;
  importance: number;
};

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
      roles: [] as RoleCatalogItem[],
      memberRole: null as MemberRoleInfo | null,
    };
  }

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let member: Member | null = null;
  let roles: RoleCatalogItem[] = [];
  let memberRole: MemberRoleInfo | null = null;

  try {
    const [memberRes, rolesRes] = await Promise.all([api.members.get(memberId), api.roles.list()]);

    if (memberRes.success) member = memberRes.member;
    else error = memberRes.message || "Error cargando miembro";

    if (rolesRes.success) {
      roles = rolesRes.roles;
      const boUserId = member?.boUserId ?? null;
      if (boUserId != null) {
        const u = rolesRes.users.find((item) => item.id === boUserId);
        if (u && u.role) {
          const label = rolesRes.roles.find((r) => r.slug === u.role)?.label ?? u.role;
          memberRole = { slug: u.role, label, importance: u.roleImportance };
        }
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando miembro";
  }

  return { memberId, member, error, roles, memberRole };
}
