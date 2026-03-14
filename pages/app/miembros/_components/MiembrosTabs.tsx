import React, { useMemo } from "react";
import { ShieldUser, Users2 } from "lucide-react";

import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";

export function MiembrosTabs({
  activeId,
  onNavigate,
}: {
  activeId: "miembros" | "roles";
  onNavigate?: (href: string, id: string, ev: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "miembros", label: "Miembros", href: "/app/miembros", icon: <ShieldUser className="w-[18px] h-[18px] block" /> },
      { id: "roles", label: "Roles", href: "/app/miembros/roles", icon: <Users2 className="w-[18px] h-[18px] block" /> },
    ],
    [],
  );

  return <Tabs tabs={tabs} activeId={activeId} ariaLabel="Secciones de miembros" className="w-fit" onNavigate={onNavigate} />;
}
