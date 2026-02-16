import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Plus, ShieldUser } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { Member, RoleCatalogItem, RoleCurrentUser, RoleUserItem } from "../../../../api/types";
import { sessionAtom } from "../../../../state/atoms";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { RoleCard } from "../../../../ui/widgets/roles/RoleCard";
import { CreateRoleInput, RoleCreateModal } from "../../../../ui/widgets/roles/RoleCreateModal";
import { RoleDetailModal } from "../../../../ui/widgets/roles/RoleDetailModal";
import type { Data } from "./+data";

function fallbackRoleImportance(roleRaw: string | null | undefined): number {
  const role = String(roleRaw ?? "").trim().toLowerCase();
  if (role === "root") return 100;
  if (role === "admin") return 90;
  return 0;
}

function sortRoles(list: RoleCatalogItem[]): RoleCatalogItem[] {
  return [...list].sort((a, b) => {
    if (a.importance !== b.importance) return b.importance - a.importance;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.slug.localeCompare(b.slug);
  });
}

function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}

export default function Page() {
  const pageContext = usePageContext();
  const raw = (pageContext.data ?? {}) as Partial<Data>;
  const initialRoles = Array.isArray(raw.roles) ? sortRoles(raw.roles) : [];
  const initialUsers = Array.isArray(raw.users) ? raw.users : [];
  const initialMembers = Array.isArray(raw.members) ? raw.members : [];
  const initialCurrentUser = raw.currentUser as RoleCurrentUser | null;
  const initialError = typeof raw.error === "string" ? raw.error : null;
  const session = useAtomValue(sessionAtom);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [roles, setRoles] = useState<RoleCatalogItem[]>(initialRoles);
  const [users, setUsers] = useState<RoleUserItem[]>(initialUsers);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [currentUser] = useState<RoleCurrentUser | null>(initialCurrentUser);
  const [error, setError] = useState<string | null>(initialError);
  const [activeRoleSlug, setActiveRoleSlug] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [busyAssign, setBusyAssign] = useState(false);
  const [busyCreate, setBusyCreate] = useState(false);
  useErrorToast(error);

  const rolesBySlug = useMemo(() => new Map(roles.map((r) => [r.slug, r])), [roles]);

  const actorImportance = useMemo(() => {
    if (typeof currentUser?.roleImportance === "number" && currentUser.roleImportance > 0) return currentUser.roleImportance;
    if (typeof session?.user?.roleImportance === "number" && session.user.roleImportance > 0) return session.user.roleImportance;
    const roleFromSession = String(currentUser?.role || session?.user?.role || "")
      .trim()
      .toLowerCase();
    const fromCatalog = rolesBySlug.get(roleFromSession)?.importance;
    if (typeof fromCatalog === "number" && fromCatalog > 0) return fromCatalog;
    return fallbackRoleImportance(roleFromSession);
  }, [currentUser?.role, currentUser?.roleImportance, rolesBySlug, session?.user?.role, session?.user?.roleImportance]);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const membersByBoUserId = useMemo(() => {
    const out = new Map<number, Member>();
    for (const member of members) {
      if (typeof member.boUserId !== "number") continue;
      if (!out.has(member.boUserId)) out.set(member.boUserId, member);
    }
    return out;
  }, [members]);

  const usersCountByRole = useMemo(() => {
    const out = new Map<string, number>();
    for (const member of members) {
      if (typeof member.boUserId !== "number") continue;
      const role = usersById.get(member.boUserId)?.role ?? "";
      if (!role) continue;
      out.set(role, (out.get(role) ?? 0) + 1);
    }
    return out;
  }, [members, usersById]);

  const activeRole = useMemo(() => {
    if (!activeRoleSlug) return null;
    return rolesBySlug.get(activeRoleSlug) ?? null;
  }, [activeRoleSlug, rolesBySlug]);

  const patchUserRole = useCallback(
    (
      prev: RoleUserItem[],
      patch: {
        id: number;
        role: string;
        roleImportance: number;
      },
    ): RoleUserItem[] => {
      const roleMeta = rolesBySlug.get(patch.role);
      const nextImportance = typeof patch.roleImportance === "number" ? patch.roleImportance : roleMeta?.importance ?? 0;

      let found = false;
      const next = prev.map((u) => {
        if (u.id !== patch.id) return u;
        found = true;
        return {
          ...u,
          role: patch.role,
          roleImportance: nextImportance,
        };
      });
      if (found) return next;

      const member = membersByBoUserId.get(patch.id);
      return [
        ...next,
        {
          id: patch.id,
          role: patch.role,
          roleImportance: nextImportance,
          name: member ? fullName(member) : `Usuario #${patch.id}`,
          email: member?.email ?? "",
        },
      ];
    },
    [membersByBoUserId, rolesBySlug],
  );

  const onCreateRole = useCallback(
    async (input: CreateRoleInput) => {
      setBusyCreate(true);
      setError(null);
      try {
        const res = await api.roles.create(input);
        if (!res.success) {
          setError(res.message || "No se pudo crear el rol");
          return;
        }
        setRoles((prev) => sortRoles([...prev, res.role]));
        setCreateOpen(false);
        pushToast({ kind: "success", title: "Rol creado" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear el rol");
      } finally {
        setBusyCreate(false);
      }
    },
    [api.roles, pushToast],
  );

  const onChangeUserRole = useCallback(
    async (userId: number, nextRole: string) => {
      setBusyUserId(userId);
      setError(null);
      try {
        const res = await api.roles.setUserRole(userId, nextRole);
        if (!res.success) {
          setError(res.message || "No se pudo cambiar el rol");
          return;
        }
        setUsers((prev) => patchUserRole(prev, res.user));
        pushToast({ kind: "success", title: "Rol actualizado" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cambiar el rol");
      } finally {
        setBusyUserId(null);
      }
    },
    [api.roles, patchUserRole, pushToast],
  );

  const onAssignRoleToMembers = useCallback(
    async (memberIds: number[], roleSlug: string) => {
      const uniqueMemberIds = [...new Set(memberIds)].filter((id) => Number.isInteger(id) && id > 0);
      if (uniqueMemberIds.length === 0) return;

      setBusyAssign(true);
      setError(null);
      try {
        let updatedMembers = 0;
        for (const memberId of uniqueMemberIds) {
          const currentMember = membersById.get(memberId);
          if (!currentMember) continue;

          let userId = typeof currentMember.boUserId === "number" ? currentMember.boUserId : null;
          if (userId === null) {
            const ensureRes = await api.roles.ensureMemberUser(memberId);
            if (!ensureRes.success) {
              throw new Error(ensureRes.message || "No se pudo crear/vincular usuario backoffice");
            }
            userId = ensureRes.user.id;
            const resolvedUser: RoleUserItem = {
              id: ensureRes.user.id,
              email: ensureRes.user.email,
              name: ensureRes.user.name,
              role: "",
              roleImportance: 0,
            };
            setUsers((prev) => (prev.some((u) => u.id === resolvedUser.id) ? prev : [...prev, resolvedUser]));
            setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, boUserId: userId } : member)));
          }

          if (!userId) continue;
          const res = await api.roles.setUserRole(userId, roleSlug);
          if (!res.success) {
            throw new Error(res.message || "No se pudo asignar el rol");
          }
          setUsers((prev) => patchUserRole(prev, res.user));
          updatedMembers += 1;
        }
        pushToast({ kind: "success", title: "Asignación completada", message: `${updatedMembers} miembros actualizados.` });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo asignar el rol");
      } finally {
        setBusyAssign(false);
      }
    },
    [api.roles, membersById, patchUserRole, pushToast],
  );

  return (
    <section aria-label="Roles" className="bo-content-grid bo-membersPage">
      <div className="bo-panel">
        <div className="bo-panelHead bo-membersIntroHead">
          <div>
            <div className="bo-panelTitle">Roles y jerarquía</div>
            <div className="bo-panelMeta">Gestiona roles por importancia (0-100), permisos y asignación de usuarios.</div>
          </div>
          <div className="bo-membersIntroBadge">
            <ShieldUser size={16} strokeWidth={1.8} />
            {roles.length} roles
          </div>
        </div>
      </div>

      <div className="bo-roleToolbar">
        <div className="bo-mutedText">Tu importancia actual: {actorImportance}</div>
        <button className="bo-btn bo-btn--primary bo-btn--sm" type="button" onClick={() => setCreateOpen(true)}>
          <Plus size={14} strokeWidth={1.8} />
          Nuevo rol
        </button>
      </div>

      <div className="bo-roleGrid">
        {roles.map((role) => (
          <RoleCard
            key={role.slug}
            role={role}
            usersCount={usersCountByRole.get(role.slug) ?? 0}
            onOpen={() => setActiveRoleSlug(role.slug)}
          />
        ))}
      </div>

      <RoleDetailModal
        open={!!activeRole}
        onClose={() => setActiveRoleSlug(null)}
        role={activeRole}
        roles={roles}
        users={users}
        members={members}
        actorImportance={actorImportance}
        busyUserId={busyUserId}
        busyAssign={busyAssign}
        onChangeUserRole={onChangeUserRole}
        onAssignRoleToMembers={onAssignRoleToMembers}
      />

      <RoleCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={onCreateRole}
        busy={busyCreate}
        actorImportance={actorImportance}
      />
    </section>
  );
}
