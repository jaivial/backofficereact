import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Users } from "lucide-react";

import type { Member, RoleCatalogItem, RoleUserItem } from "../../../api/types";
import { roleLabel } from "../../../lib/rbac";
import { Modal } from "../../overlays/Modal";
import { RoleBadge } from "./RoleBadge";
import { RoleIcon } from "./RoleIcon";

type Props = {
  open: boolean;
  onClose: () => void;
  role: RoleCatalogItem | null;
  roles: RoleCatalogItem[];
  users: RoleUserItem[];
  members: Member[];
  actorImportance: number;
  busyUserId: number | null;
  busyAssign: boolean;
  onChangeUserRole: (userId: number, nextRole: string) => Promise<void>;
  onAssignRoleToMembers: (memberIds: number[], roleSlug: string) => Promise<void>;
};

type MemberRoleRow = {
  memberId: number;
  userId: number | null;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  roleImportance: number;
  hasUser: boolean;
  hasEmail: boolean;
};

function canManageUser(actorImportance: number, userImportance: number): boolean {
  return actorImportance > userImportance;
}

function canAssignRole(actorImportance: number, roleImportance: number): boolean {
  return actorImportance > roleImportance;
}

function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}

function normalizeEmail(v: string | null | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}

export function RoleDetailModal({
  open,
  onClose,
  role,
  roles,
  users,
  members,
  actorImportance,
  busyUserId,
  busyAssign,
  onChangeUserRole,
  onAssignRoleToMembers,
}: Props) {
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelectedMemberIds([]);
  }, [open, role?.slug]);

  const roleBySlug = useMemo(() => new Map(roles.map((item) => [item.slug, item])), [roles]);
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const usersByEmail = useMemo(() => {
    const out = new Map<string, RoleUserItem>();
    for (const user of users) out.set(normalizeEmail(user.email), user);
    return out;
  }, [users]);

  const memberRows = useMemo<MemberRoleRow[]>(() => {
    const out: MemberRoleRow[] = [];
    for (const member of members) {
      const boUserId = typeof member.boUserId === "number" ? member.boUserId : null;
      const linkedById = boUserId !== null ? usersById.get(boUserId) : undefined;
      const linkedByEmail = linkedById ? undefined : usersByEmail.get(normalizeEmail(member.email));
      const linkedUser = linkedById ?? linkedByEmail;
      const userId = linkedUser?.id ?? boUserId;
      const linkedRole = linkedUser?.role?.trim() ?? "";
      const labelFromCatalog = linkedRole ? roleBySlug.get(linkedRole)?.label : "";
      const memberEmail = normalizeEmail(member.email);

      out.push({
        memberId: member.id,
        userId: userId ?? null,
        name: fullName(member),
        email: member.email || linkedUser?.email || "Sin email",
        role: linkedRole,
        roleLabel: linkedRole ? labelFromCatalog || roleLabel(linkedRole) : userId ? "Sin rol" : "Sin usuario",
        roleImportance: typeof linkedUser?.roleImportance === "number" ? linkedUser.roleImportance : 0,
        hasUser: userId !== null,
        hasEmail: memberEmail !== "",
      });
    }

    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [members, roleBySlug, usersByEmail, usersById]);

  const membersInRole = useMemo(() => {
    if (!role) return [];
    return memberRows.filter((m) => m.role === role.slug);
  }, [memberRows, role]);

  const membersOutRole = useMemo(() => {
    if (!role) return [];
    return memberRows.filter((m) => m.role !== role.slug);
  }, [memberRows, role]);

  const selectedCount = selectedMemberIds.length;

  const onAssignSelected = useCallback(async () => {
    if (!role) return;
    if (selectedMemberIds.length === 0) return;
    await onAssignRoleToMembers(selectedMemberIds, role.slug);
    setSelectedMemberIds([]);
  }, [onAssignRoleToMembers, role, selectedMemberIds]);

  return (
    <Modal open={open} title={role?.label || "Rol"} onClose={onClose} widthPx={960}>
      {role ? (
        <>
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
            <div className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="text-primary" aria-hidden="true">
                <RoleIcon roleSlug={role.slug} iconKey={role.iconKey} size={18} strokeWidth={1.8} />
              </span>
              {role.label}
            </div>
            <button className="w-8 h-8 flex items-center justify-center text-2xl text-muted-foreground hover:text-foreground" type="button" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <div className="mt-[10px]">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="p-4 border-b border-white/[0.06]">
                <div>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                    <Info size={14} strokeWidth={1.8} />
                    Información del rol
                  </div>
                  <div className="text-xs text-muted-foreground">Gestiona permisos y usuarios asignados a este rol.</div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <RoleBadge roleSlug={role.slug} roleName={role.label} importance={role.importance} />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">Permisos</div>
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.map((perm) => (
                      <span key={perm} className="inline-flex items-center px-2 py-1 rounded-md bg-white/[0.04] text-xs text-foreground border border-white/[0.06]">
                        {perm}
                      </span>
                    ))}
                    {role.permissions.length === 0 ? <span className="text-sm text-muted-foreground">Sin permisos</span> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="p-4 border-b border-white/[0.06]">
                <div>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                    <Users size={14} strokeWidth={1.8} />
                    Miembros con este rol
                  </div>
                  <div className="text-xs text-muted-foreground">{membersInRole.length} miembros</div>
                </div>
              </div>
              <div className="p-2 max-h-[300px] overflow-y-auto">
                {membersInRole.map((member) => {
                  const blockedByImportance = !canManageUser(actorImportance, member.roleImportance);
                  const isBusy = member.userId !== null && busyUserId === member.userId;
                  const disabledSelect = !member.hasUser || blockedByImportance || isBusy;
                  return (
                    <label key={member.memberId} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04]">
                      <div className="flex flex-col">
                        <div className="text-sm text-foreground">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                      <select
                        className="h-8 px-2 rounded border border-white/[0.06] bg-white/[0.03] text-sm text-foreground"
                        value={member.role}
                        disabled={disabledSelect}
                        onChange={(ev) => {
                          if (!member.userId) return;
                          void onChangeUserRole(member.userId, ev.target.value);
                        }}
                        aria-label={`Rol de ${member.name}`}
                      >
                        {roles.map((opt) => {
                          const blockedOption = !canAssignRole(actorImportance, opt.importance) && opt.slug !== member.role;
                          return (
                            <option key={opt.slug} value={opt.slug} disabled={blockedOption}>
                              {opt.label}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  );
                })}

                {membersInRole.length === 0 ? <div className="text-sm text-muted-foreground">Ningún miembro tiene este rol.</div> : null}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] flex flex-col">
              <div className="p-4 border-b border-white/[0.06]">
                <div>
                  <div className="text-sm font-semibold text-foreground mb-1">Asignar este rol</div>
                  <div className="text-xs text-muted-foreground">Lista completa de miembros del restaurante.</div>
                </div>
                <span className="text-sm text-muted-foreground mt-2 block">{selectedCount} seleccionados</span>
              </div>

              <div className="p-2 max-h-[250px] overflow-y-auto flex-1">
                {membersOutRole.map((member) => {
                  const checked = selectedMemberIds.includes(member.memberId);
                  const blockedByUser = !canManageUser(actorImportance, member.roleImportance);
                  const blockedByRole = !canAssignRole(actorImportance, role.importance);
                  const missingIdentity = !member.hasUser && !member.hasEmail;
                  const disabled = missingIdentity || blockedByUser || blockedByRole;

                  let reason = "";
                  if (missingIdentity) reason = "Sin email para crear usuario backoffice";
                  else if (blockedByUser) reason = "No puedes cambiar este miembro";
                  else if (blockedByRole) reason = "Tu rol no permite asignar este rol";
                  else if (!member.hasUser) reason = "Se creará usuario backoffice al asignar";

                  return (
                    <label key={member.memberId} className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04] ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(ev) => {
                          const memberId = member.memberId;
                          setSelectedMemberIds((prev) =>
                            ev.target.checked
                              ? prev.includes(memberId)
                                ? prev
                                : [...prev, memberId]
                              : prev.filter((id) => id !== memberId),
                          );
                        }}
                      />
                      <div className="flex flex-col flex-1">
                        <div className="text-sm text-foreground">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                        {reason ? <div className="text-xs text-yellow-400/80 mt-1">{reason}</div> : null}
                      </div>
                      <span className="text-sm text-muted-foreground">{member.roleLabel}</span>
                    </label>
                  );
                })}

                {membersOutRole.length === 0 ? <div className="text-sm text-muted-foreground">No hay más miembros disponibles.</div> : null}
              </div>

              <div className="p-4 border-t border-white/[0.06]">
                <button
                  className="inline-flex items-center justify-center h-8 px-4 rounded-lg w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
                  type="button"
                  disabled={busyAssign || selectedCount === 0 || !canAssignRole(actorImportance, role.importance)}
                  onClick={() => {
                    void onAssignSelected();
                  }}
                >
                  Asignar rol
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </Modal>
  );
}
