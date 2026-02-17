import React from "react";
import { ChevronRight, Users } from "lucide-react";

import type { RoleCatalogItem } from "../../../api/types";
import { RoleIcon } from "./RoleIcon";

export function RoleCard({
  role,
  usersCount,
  onOpen,
}: {
  role: RoleCatalogItem;
  usersCount: number;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="bo-roleCard" onClick={onOpen} aria-label={`Abrir rol ${role.label}`}>
      <div className="bo-roleCardHead">
        <div className="bo-roleCardIcon" aria-hidden="true">
          <RoleIcon roleSlug={role.slug} iconKey={role.iconKey} size={20} strokeWidth={1.8} />
        </div>
        <div className="bo-roleCardTitleWrap">
          <div className="bo-roleCardTitle">{role.label}</div>
        </div>
        <ChevronRight size={16} strokeWidth={1.8} className="bo-roleCardChevron" />
      </div>

      <div className="bo-roleCardFoot">
        <span className="bo-roleCardUsers">
          <Users size={14} strokeWidth={1.8} />
          {usersCount} miembros
        </span>
        <span className="bo-mutedText">{role.permissions.length} permisos</span>
        <span className="bo-roleCardLevel">Nivel {role.level}</span>
      </div>
    </button>
  );
}
