import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, ClipboardCheck, Ellipsis, FileText, Home, Link, Settings, ShieldUser, UtensilsCrossed, BarChart3, Receipt, Globe, CookingPot } from "lucide-react";

import type { SidebarItemKey } from "../../lib/rbac";
import { sidebarItemsForRole } from "../../lib/rbac";
import { NavLink } from "../nav/NavLink";

const MOBILE_PRIMARY_ORDER: SidebarItemKey[] = ["reservas", "menus", "comida"];

function iconForItem(key: SidebarItemKey, size = 18, strokeWidth = 1.8) {
  switch (key) {
    case "reservas":
      return <CalendarDays size={size} strokeWidth={strokeWidth} />;
    case "menus":
      return <UtensilsCrossed size={size} strokeWidth={strokeWidth} />;
    case "comida":
      return <CookingPot size={size} strokeWidth={strokeWidth} />;
    case "miembros":
      return <ShieldUser size={size} strokeWidth={strokeWidth} />;
    case "ajustes":
      return <Link size={size} strokeWidth={strokeWidth} />;
    case "website":
      return <Globe size={size} strokeWidth={strokeWidth} />;
    case "fichaje":
      return <ClipboardCheck size={size} strokeWidth={strokeWidth} />;
    case "horarios":
      return <CalendarClock size={size} strokeWidth={strokeWidth} />;
    case "facturas":
      return <FileText size={size} strokeWidth={strokeWidth} />;
    case "reportes":
      return <BarChart3 size={size} strokeWidth={strokeWidth} />;
    case "estado_cuenta":
      return <Receipt size={size} strokeWidth={strokeWidth} />;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const items = useMemo(() => sidebarItemsForRole(role, sectionAccess, roleImportance), [role, roleImportance, sectionAccess]);
  const mobilePrimary = useMemo(() => {
    const map = new Map(items.map((item) => [item.key, item] as const));
    return MOBILE_PRIMARY_ORDER.map((key) => map.get(key)).filter((item): item is (typeof items)[number] => Boolean(item));
  }, [items]);
  const mobilePrimaryKeys = useMemo(() => new Set(mobilePrimary.map((item) => item.key)), [mobilePrimary]);
  const mobileOverflow = useMemo(() => items.filter((item) => !mobilePrimaryKeys.has(item.key)), [items, mobilePrimaryKeys]);
  const homeActive = pathname === "/app" || pathname === "/app/" || pathname === "/app/backoffice" || pathname.startsWith("/app/backoffice/");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <aside className="fixed left-0 top-0 h-screen w-[78px] bg-background/95 backdrop-blur-sm border-r border-border flex flex-col items-center gap-4 py-[18px] z-40" aria-label="Sidebar">
      <div className="w-[42px] h-[42px] rounded-xl grid place-items-center bg-white/5 border border-border text-accent" aria-label="Backoffice">
        <Settings {...iconProps} />
      </div>

      <nav className="flex flex-col gap-2 mt-1.5 hidden md:flex" aria-label="Navigation">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <NavLink key={item.key} href={item.href} active={isActive} label={item.label}>
              {iconForItem(item.key, iconProps.size, iconProps.strokeWidth)}
            </NavLink>
          );
        })}
      </nav>

      <nav className="flex flex-col gap-2 mt-1.5 md:hidden" aria-label="Navigation mobile">
        <div className="grid grid-cols-5 gap-1 w-full px-5">
          <NavLink href="/app/backoffice" active={homeActive} label="Home">
            <Home size={iconProps.size} strokeWidth={iconProps.strokeWidth} />
          </NavLink>
          {mobilePrimary.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <NavLink key={`mobile-${item.key}`} href={item.href} active={isActive} label={item.label}>
                {iconForItem(item.key, iconProps.size, iconProps.strokeWidth)}
              </NavLink>
            );
          })}
          <div className="relative grid place-items-center">
            <button
              type="button"
              className={`w-11 h-11 rounded-2xl border border-transparent bg-transparent text-muted-foreground grid place-items-center cursor-pointer transition-colors hover:bg-white/5 hover:border-white/[0.09] ${mobileMenuOpen ? "bg-primary/20 border-primary/40 text-foreground" : ""}`}
              aria-label="Mas secciones"
              aria-expanded={mobileMenuOpen}
              aria-controls="nav-mobile-overflow"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Ellipsis size={iconProps.size} strokeWidth={iconProps.strokeWidth} />
            </button>
            <div id="nav-mobile-overflow" className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 origin-bottom scale-95 opacity-0 pointer-events-none transition-all duration-150 ${mobileMenuOpen ? "opacity-100 scale-100 pointer-events-auto" : ""}`}>
              <div className="flex flex-col gap-2 p-2 rounded-2xl border border-border bg-secondary shadow-lg">
                {mobileOverflow.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <NavLink key={`mobile-overflow-${item.key}`} href={item.href} active={isActive} label={item.label} onClick={() => setMobileMenuOpen(false)}>
                      {iconForItem(item.key, iconProps.size, iconProps.strokeWidth)}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1" aria-hidden="true" />
    </aside>
  );
}
