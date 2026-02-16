import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { Member, RoleCatalogItem, RoleCurrentUser, RoleUserItem } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Miembros" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let members: Member[] = [];
  let roles: RoleCatalogItem[] = [];
  let users: RoleUserItem[] = [];
  let currentUser: RoleCurrentUser | null = null;

  try {
    const [membersRes, rolesRes] = await Promise.all([api.members.list(), api.roles.list()]);
    if (membersRes.success) members = membersRes.members;
    else error = membersRes.message || "Error cargando miembros";

    if (rolesRes.success) {
      roles = rolesRes.roles;
      users = rolesRes.users;
      currentUser = rolesRes.currentUser;
    } else if (!error) {
      error = rolesRes.message || "Error cargando roles";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando miembros";
  }

  return { members, roles, users, currentUser, error };
}
