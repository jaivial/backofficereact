import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const mobileMoreRef = useRef<HTMLDivElement | null>(null);
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
    const onDocPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!mobileMoreRef.current?.contains(target)) setMobileMenuOpen(false);
    };
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <aside className="bo-sidebar" aria-label="Sidebar">
      <div className="bo-brand" aria-label="Backoffice">
        <Settings {...iconProps} />
      </div>

      <nav className="bo-nav bo-navDesktop" aria-label="Navigation">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <NavLink key={item.key} href={item.href} active={isActive} label={item.label}>
              {iconForItem(item.key, iconProps.size, iconProps.strokeWidth)}
            </NavLink>
          );
        })}
      </nav>

      <nav className="bo-nav bo-navMobile" aria-label="Navigation mobile">
        <div className="bo-navMobileMain">
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
          <div className="bo-navMobileMoreWrap" ref={mobileMoreRef}>
            <button
              type="button"
              className={`bo-navBtn bo-navBtn--glass bo-navBtn--mobileMore${mobileMenuOpen ? " is-active" : ""}`}
              aria-label="Mas secciones"
              aria-expanded={mobileMenuOpen}
              aria-controls="bo-nav-mobile-overflow"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Ellipsis size={iconProps.size} strokeWidth={iconProps.strokeWidth} />
            </button>
            <div id="bo-nav-mobile-overflow" className={`bo-navMobileOverflow${mobileMenuOpen ? " is-open" : ""}`}>
              <div className="bo-navMobileOverflowList">
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

      <div className="bo-sidebarSpacer" aria-hidden="true" />
    </aside>
  );
}
