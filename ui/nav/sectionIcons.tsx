import React from "react";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CookingPot,
  FileText,
  Link,
  Receipt,
  Settings,
  ShieldUser,
  UtensilsCrossed,
} from "lucide-react";

import type { SidebarItemKey } from "../../lib/rbac";

export type BOIconOptions = {
  size?: number;
  strokeWidth?: number;
};

export function iconForSidebarItemKey(key: SidebarItemKey, options: BOIconOptions = {}): React.ReactNode {
  const size = options.size ?? 18;
  const strokeWidth = options.strokeWidth ?? 1.8;

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

