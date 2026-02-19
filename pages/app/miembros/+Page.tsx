import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Plus, ShieldUser } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { Member, RoleCatalogItem, RoleUserItem } from "../../../api/types";
import { roleLabel } from "../../../lib/rbac";
import { sessionAtom } from "../../../state/atoms";
import { useToasts } from "../../../ui/feedback/useToasts";
import { imageToWebpMax200KB } from "../../../ui/lib/imageFile";
import { composePhoneE164 } from "../../../ui/lib/phone";
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/shell/Avatar";
import { RoleBadge } from "../../../ui/widgets/roles/RoleBadge";
import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { CreateMemberInput, MemberCreateModal } from "./_components/MemberCreateModal";

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
  const initialMembers = Array.isArray(raw.members) ? raw.members : [];
  const initialUsers = Array.isArray(raw.users) ? raw.users : [];
  const roles = Array.isArray(raw.roles) ? raw.roles : [];
  const initialError = typeof raw.error === "string" ? raw.error : null;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [users, setUsers] = useState<RoleUserItem[]>(initialUsers);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  useErrorToast(initialError);
  const session = useAtomValue(sessionAtom);
  const { pushToast } = useToasts();

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

  const onCreateMember = useCallback(
    async (input: CreateMemberInput) => {
      const digits = input.phoneNumber.replace(/[^0-9]/g, "");
      const phoneE164 = composePhoneE164(input.phoneCountryCode, input.phoneNumber);
      if (digits !== "" && phoneE164 === null) {
        pushToast({ kind: "error", title: "Telefono invalido" });
        return;
      }

      setCreateBusy(true);
      try {
        const res = await api.members.create({
          firstName: input.firstName,
          lastName: input.lastName,
          roleSlug: input.roleSlug,
          email: input.email,
          dni: input.dni,
          phone: phoneE164,
          username: input.username,
          temporaryPassword: input.temporaryPassword,
        });
        if (!res.success) {
          pushToast({ kind: "error", title: "No se pudo crear", message: res.message || "Error al crear miembro" });
          return;
        }

        let nextMember = res.member;
        if (input.avatarFile) {
          try {
            const webpFile = await imageToWebpMax200KB(input.avatarFile);
            const avatarRes = await api.members.uploadAvatar(nextMember.id, webpFile);
            if (avatarRes.success) nextMember = avatarRes.member;
          } catch {
            pushToast({ kind: "info", title: "Miembro creado", message: "No se pudo subir el avatar en este paso." });
          }
        }

        setMembers((prev) => [nextMember, ...prev.filter((member) => member.id !== nextMember.id)]);

        const createdUser = res.user;
        if (createdUser && typeof createdUser.id === "number") {
          const roleMeta = rolesBySlug.get(input.roleSlug);
          setUsers((prev) => {
            const next = prev.filter((u) => u.id !== createdUser.id);
            next.push({
              id: createdUser.id,
              email: createdUser.email || nextMember.email || "",
              name: `${nextMember.firstName} ${nextMember.lastName}`.trim() || `Usuario #${createdUser.id}`,
              role: input.roleSlug,
              roleImportance: roleMeta?.importance ?? 0,
            });
            return next;
          });
        }

        const delivery = Array.isArray(res.invitation?.delivery) ? res.invitation.delivery : [];
        const sentChannels = delivery.filter((d) => d.sent).map((d) => d.channel);
        if (sentChannels.length > 0) {
          pushToast({
            kind: "success",
            title: "Miembro creado",
            message: `Invitación enviada por ${sentChannels.join(" y ")}.`,
          });
        } else if (res.provisioning?.manualCredentials) {
          pushToast({
            kind: "success",
            title: "Miembro creado",
            message: "Credenciales manuales creadas. Se solicitará cambio de password al primer acceso.",
          });
        } else {
          pushToast({ kind: "success", title: "Miembro creado" });
        }

        setCreateOpen(false);
      } catch (err) {
        pushToast({ kind: "error", title: "No se pudo crear", message: err instanceof Error ? err.message : "Error inesperado" });
      } finally {
        setCreateBusy(false);
      }
    },
    [api.members, pushToast, rolesBySlug],
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

      <button className="bo-menuFab" type="button" aria-label="Añadir miembro" onClick={() => setCreateOpen(true)}>
        <Plus size={24} strokeWidth={2} />
      </button>

      <MemberCreateModal
        open={createOpen}
        onClose={() => {
          if (!createBusy) setCreateOpen(false);
        }}
        roles={roles}
        busy={createBusy}
        onCreate={onCreateMember}
      />
    </section>
  );
}
