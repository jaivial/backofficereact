import React from "react";
import { CalendarDays, LayoutDashboard, Link, Settings, UtensilsCrossed } from "lucide-react";

import { NavLink } from "../nav/NavLink";

export function Sidebar({ pathname }: { pathname: string }) {
  const iconProps = { size: 18, strokeWidth: 1.8 } as const;
  return (
    <aside className="bo-sidebar" aria-label="Sidebar">
      <div className="bo-brand" aria-label="Backoffice">
        <LayoutDashboard {...iconProps} />
      </div>

      <nav className="bo-nav" aria-label="Navigation">
        <NavLink href="/app/dashboard" active={pathname.startsWith("/app/dashboard") || pathname === "/app"} label="Dashboard">
          <LayoutDashboard {...iconProps} />
        </NavLink>
        <NavLink href="/app/reservas" active={pathname.startsWith("/app/reservas")} label="Reservas">
          <CalendarDays {...iconProps} />
        </NavLink>
        <NavLink href="/app/menus" active={pathname.startsWith("/app/menus")} label="Menus">
          <UtensilsCrossed {...iconProps} />
        </NavLink>
        <NavLink href="/app/config" active={pathname.startsWith("/app/config")} label="Configuracion">
          <Settings {...iconProps} />
        </NavLink>
        <NavLink href="/app/settings" active={pathname.startsWith("/app/settings")} label="Ajustes">
          <Link {...iconProps} />
        </NavLink>
      </nav>

      <div className="bo-sidebarSpacer" aria-hidden="true" />
    </aside>
  );
}
