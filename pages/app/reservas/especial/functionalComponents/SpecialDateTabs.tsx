import React from "react";
import { CalendarDays, Settings2 } from "lucide-react";

import { Tabs } from "../../../../../ui/nav/Tabs";
import type { TabItem } from "../../../../../ui/nav/Tabs";

export type SpecialDateTabId = "ajustes" | "fechas";

/**
 * Tab strip shown only for days that ARE special-menu days: one tab for
 * the "Reservas especiales" settings form, one for the list of every
 * date with a special menu.
 *
 * Rendered in `mode="button"` so switching tabs is local state - no
 * navigation, no remount, which is what keeps the post-activation
 * transition smooth.
 *
 * Coordination id: especial_activate_v1
 */
export function SpecialDateTabs({
  active,
  onChange,
}: {
  active: SpecialDateTabId;
  onChange: (id: SpecialDateTabId) => void;
}) {
  const tabs: TabItem[] = [
    {
      id: "ajustes",
      label: "Reservas especiales",
      href: "#",
      icon: <Settings2 size={16} strokeWidth={1.8} />,
    },
    {
      id: "fechas",
      label: "Fechas con menú especial",
      href: "#",
      icon: <CalendarDays size={16} strokeWidth={1.8} />,
    },
  ];

  return (
    <div data-testid="especial-page-tabs-wrap">
      <Tabs
        tabs={tabs}
        activeId={active}
        mode="button"
        layoutId="especialTabIndicator"
        ariaLabel="Secciones de reservas especiales"
        className="bo-tabs--reservas flex flex-row rounded-xl w-fit my-0 mx-auto"
        onNavigate={(_href, id) => onChange(id as SpecialDateTabId)}
      />
    </div>
  );
}
