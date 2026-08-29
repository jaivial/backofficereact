import React from "react";
import { useAtomValue } from "jotai";
import {
  CalendarDays,
  UtensilsCrossed,
  Clock,
  ClipboardList,
  LayoutDashboard,
  Boxes,
  MonitorSmartphone,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { sessionAtom } from "../../state/atoms";
import { sidebarItemsForRole } from "../../lib/rbac";
import { cn } from "../shadcn/utils";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

const ICON_MAP: Record<string, LucideIcon> = {
  reservas: CalendarDays,
  menus: UtensilsCrossed,
  fichaje: Clock,
  horarios: ClipboardList,
  facturas: ClipboardList,
  backoffice: LayoutDashboard,
  stock: Boxes,
  pos: MonitorSmartphone,
  estadisticas: BarChart3,
};

function iconForSection(key: string, size = 22, strokeWidth = 1.8): React.ReactNode {
  const Icon = ICON_MAP[key] ?? LayoutDashboard;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}

const MOBILE_NAV_ITEMS: NavItem[] = [
  { key: "backoffice", label: "Inicio", href: "/m/app/backoffice", icon: LayoutDashboard },
  { key: "reservas", label: "Reservas", href: "/m/app/reservas", icon: CalendarDays },
  { key: "fichaje", label: "Fichaje", href: "/m/app/fichaje", icon: Clock },
  { key: "stock", label: "Stock", href: "/app/stock", icon: Boxes },
  { key: "pos", label: "TPV", href: "/app/pos", icon: MonitorSmartphone },
  { key: "estadisticas", label: "Estadisticas", href: "/app/estadisticas", icon: BarChart3 },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/m/app/backoffice") {
    return pathname === "/m/app/backoffice";
  }
  return pathname.startsWith(href.startsWith("/m") ? href.replace("/m", "") : href);
}

interface MobileNavProps {
  pathname: string;
  className?: string;
}

export function MobileNav({ pathname, className }: MobileNavProps) {
  const session = useAtomValue(sessionAtom);

  const visibleItems = React.useMemo(() => {
    if (!session) return MOBILE_NAV_ITEMS.filter((i) => i.key === "backoffice");
    const allowed = sidebarItemsForRole(
      session.user.role,
      session.user.sectionAccess,
      session.user.roleImportance,
      session.user.appVersion,
    );
    const allowedKeys = new Set(allowed.map((s) => s.key));
    return MOBILE_NAV_ITEMS.filter(
      (item) => item.key === "backoffice" || allowedKeys.has(item.key as any),
    );
  }, [session]);

  return (
    <nav
      className={cn("bo-mobile-nav fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]", className)}
      data-ui="mobile-nav"
      aria-label="Navegacion principal"
    >
      {visibleItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <a
            key={item.key}
            href={item.href}
            className={[
              "bo-mobile-nav-item flex-1 flex flex-col items-center justify-center gap-1 py-3 no-underline transition-colors",
              active
                ? "text-[hsl(var(--primary))]"
                : "text-[hsl(var(--muted-foreground))]",
            ].join(" ")}
            data-ui="mobile-nav-item"
            data-role={item.key}
            aria-current={active ? "page" : undefined}
          >
            <span data-testid={`nav-icon-${item.key}`}>
              {iconForSection(item.key)}
            </span>
            <span
              className="text-[10px] font-medium leading-none"
              data-ui="mobile-nav-label"
            >
              {item.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
