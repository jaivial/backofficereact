import React from "react";
import { ChevronRight, Users } from "lucide-react";

import { cn } from "../../shadcn/utils";
import type { RoleCatalogItem } from "../../../api/types";
import { RoleIcon } from "./RoleIcon";

export function RoleCard({
  role,
  usersCount,
  onOpen,
  className,
}: {
  role: RoleCatalogItem;
  usersCount: number;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={cn("bo-roleCard", className)} onClick={onOpen} aria-label={`Abrir rol ${role.label}`} data-testid="role-card-btn">
      <div className="bo-roleCardHead" data-slot="roleCard-roleCardHead">
        <div className="bo-roleCardIcon" aria-hidden="true" data-slot="roleCard-roleCardIcon">
          <RoleIcon roleSlug={role.slug} iconKey={role.iconKey} size={20} strokeWidth={1.8} />
        </div>
        <div className="bo-roleCardTitleWrap" data-slot="roleCard-roleCardTitleWrap">
          <div className="bo-roleCardTitle" data-slot="roleCard-roleCardTitle">{role.label}</div>
        </div>
        <ChevronRight size={16} strokeWidth={1.8} className="bo-roleCardChevron" />
      </div>

      <div className="bo-roleCardFoot" data-slot="roleCard-roleCardFoot">
        <span className="bo-roleCardUsers" data-slot="roleCard-roleCardUsers">
          <Users size={14} strokeWidth={1.8} />
          {usersCount} miembros
        </span>
        <span className="bo-mutedText" data-slot="roleCard-mutedText">{role.permissions.length} permisos</span>
        <span className="bo-roleCardLevel" data-slot="roleCard-roleCardLevel">Nivel {role.level}</span>
      </div>
    </button>
  );
}
