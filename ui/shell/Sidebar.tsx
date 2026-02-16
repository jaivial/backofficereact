import React from "react";
import { CalendarClock, CalendarDays, ClipboardCheck, Link, Settings, ShieldUser, UtensilsCrossed } from "lucide-react";

import type { SidebarItemKey } from "../../lib/rbac";
import { sidebarItemsForRole } from "../../lib/rbac";
import { NavLink } from "../nav/NavLink";

function iconForItem(key: SidebarItemKey, size = 18, strokeWidth = 1.8) {
  switch (key) {
    case "reservas":
      return <CalendarDays size={size} strokeWidth={strokeWidth} />;
    case "menus":
      return <UtensilsCrossed size={size} strokeWidth={strokeWidth} />;
    case "miembros":
      return <ShieldUser size={size} strokeWidth={strokeWidth} />;
    case "ajustes":
      return <Link size={size} strokeWidth={strokeWidth} />;
    case "fichaje":
      return <ClipboardCheck size={size} strokeWidth={strokeWidth} />;
    case "horarios":
      return <CalendarClock size={size} strokeWidth={strokeWidth} />;
    default:
      return <Settings size={size} strokeWidth={strokeWidth} />;
  }
}

export function Sidebar({
  pathname,
  role,
  sectionAccess,
  roleImportance,
}: {
  pathname: string;
  role: string;
  sectionAccess?: string[];
  roleImportance?: number;
}) {
  const iconProps = { size: 18, strokeWidth: 1.8 } as const;
  const items = sidebarItemsForRole(role, sectionAccess, roleImportance);
  return (
    <aside className="bo-sidebar" aria-label="Sidebar">
      <div className="bo-brand" aria-label="Backoffice">
        <Settings {...iconProps} />
      </div>

      <nav className="bo-nav" aria-label="Navigation">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <NavLink key={item.key} href={item.href} active={isActive} label={item.label}>
              {iconForItem(item.key, iconProps.size, iconProps.strokeWidth)}
            </NavLink>
          );
        })}
      </nav>

      <div className="bo-sidebarSpacer" aria-hidden="true" />
    </aside>
  );
}
