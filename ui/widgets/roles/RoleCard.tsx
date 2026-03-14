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
    <button type="button" className="w-full p-4 rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] bg-bo-surface-2 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:border-white/[0.12]" onClick={onOpen} aria-label={`Abrir rol ${role.label}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg border border-white/[0.07] bg-white/[0.02] flex items-center justify-center text-foreground/80 flex-shrink-0" aria-hidden="true">
          <RoleIcon roleSlug={role.slug} iconKey={role.iconKey} size={20} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{role.label}</div>
        </div>
        <ChevronRight size={16} strokeWidth={1.8} className="text-muted flex-shrink-0" />
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Users size={14} strokeWidth={1.8} />
          {usersCount} miembros
        </span>
        <span>{role.permissions.length} permisos</span>
        <span className="text-foreground/60">Nivel {role.level}</span>
      </div>
    </button>
  );
}
