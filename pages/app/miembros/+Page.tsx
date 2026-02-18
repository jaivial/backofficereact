import React, { useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import { ShieldUser } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import type { Member, RoleCatalogItem, RoleUserItem } from "../../../api/types";
import { roleLabel } from "../../../lib/rbac";
import { sessionAtom } from "../../../state/atoms";
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/shell/Avatar";
import { RoleBadge } from "../../../ui/widgets/roles/RoleBadge";
import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";

function initials(firstName: string, lastName: string) {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase() || "MM";
}

function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}

function normalizeEmail(v: string | null | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}

export default function Page() {
  const pageContext = usePageContext();
  const raw = (pageContext.data ?? {}) as Partial<Data>;
  const members = Array.isArray(raw.members) ? raw.members : [];
  const users = Array.isArray(raw.users) ? raw.users : [];
  const roles = Array.isArray(raw.roles) ? raw.roles : [];
  const initialError = typeof raw.error === "string" ? raw.error : null;
  useErrorToast(initialError);
  const session = useAtomValue(sessionAtom);

  const currentEmail = useMemo(() => normalizeEmail(session?.user?.email), [session?.user?.email]);
  const rolesBySlug = useMemo(() => {
    const out = new Map<string, RoleCatalogItem>();
    for (const role of roles) out.set(role.slug, role);
    return out;
  }, [roles]);
  const usersById = useMemo(() => {
    const out = new Map<number, RoleUserItem>();
    for (const user of users) out.set(user.id, user);
    return out;
  }, [users]);
  const usersByEmail = useMemo(() => {
    const out = new Map<string, RoleUserItem>();
    for (const user of users) out.set(normalizeEmail(user.email), user);
    return out;
  }, [users]);

  const isSelfMember = useCallback(
    (member: Member): boolean => {
      if (member.isCurrentUser) return true;
      if (!currentEmail) return false;
      return normalizeEmail(member.email) === currentEmail;
    },
    [currentEmail],
  );

  const memberRoleMeta = useCallback(
    (member: Member): { slug: string; label: string; importance: number | null } => {
      const byId = typeof member.boUserId === "number" ? usersById.get(member.boUserId) : undefined;
      const email = normalizeEmail(member.email);
      const byEmail = email ? usersByEmail.get(email) : undefined;
      const user = byId ?? byEmail;
      if (!user) {
        if (!member.boUserId) return { slug: "sin_usuario", label: "Sin usuario", importance: null };
        return { slug: "sin_rol", label: "Sin rol", importance: null };
      }
      const catalog = rolesBySlug.get(user.role);
      return {
        slug: user.role,
        label: catalog?.label || roleLabel(user.role),
        importance: catalog?.importance ?? user.roleImportance ?? null,
      };
    },
    [rolesBySlug, usersByEmail, usersById],
  );

  return (
    <section aria-label="Miembros y roles" className="bo-content-grid bo-membersPage">
      <div className="bo-panel">
        <div className="bo-panelHead bo-membersIntroHead">
          <div>
            <div className="bo-panelTitle">Equipo y permisos</div>
            <div className="bo-panelMeta">Consulta miembros del restaurante y su rol operativo actual.</div>
          </div>
          <div className="bo-membersIntroBadge">
            <ShieldUser size={16} strokeWidth={1.8} />
            {members.length} miembros
          </div>
        </div>
      </div>

      <div className="bo-membersGrid">
        {members.map((member) => {
          const roleMeta = memberRoleMeta(member);
          return (
            <button
              key={member.id}
              type="button"
              className="bo-memberCard"
              onClick={() => window.location.assign(`/app/miembros/${member.id}`)}
            >
              <div className="bo-memberCardTop">
                <Avatar className="bo-memberAvatar">
                  {member.photoUrl ? <AvatarImage src={member.photoUrl} alt={fullName(member)} /> : null}
                  <AvatarFallback className="bo-memberAvatarFallback">{initials(member.firstName, member.lastName)}</AvatarFallback>
                </Avatar>
                <div className="bo-memberMain">
                  <div className="bo-memberNameRow">
                    <div className="bo-memberName">{fullName(member)}</div>
                    {isSelfMember(member) ? <span className="bo-badge bo-badge--self">Tu</span> : null}
                  </div>
                  <div className="bo-memberSub">{member.email ?? "Sin email"}</div>
                </div>
              </div>

              <div className="bo-memberRoleRow">
                <span className="bo-memberMeta">Rol</span>
                <RoleBadge
                  roleSlug={roleMeta.slug}
                  roleName={roleMeta.label}
                  importance={roleMeta.importance}
                  className={roleMeta.importance === null ? "bo-roleBadge--ghost" : ""}
                />
              </div>

              <div className="bo-memberCardFoot">
                <span className="bo-memberMeta">Contrato semanal</span>
                <span className="bo-badge bo-memberHours">{member.weeklyContractHours.toFixed(2)} h</span>
              </div>
            </button>
          );
        })}

        {members.length === 0 ? (
          <div className="bo-panel bo-panel--empty">
            <div className="bo-panelHead">
              <div className="bo-panelTitle">Sin miembros</div>
              <div className="bo-panelMeta">No hay miembros cargados todavía para este restaurante.</div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
