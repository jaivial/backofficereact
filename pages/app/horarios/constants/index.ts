import type { Transition } from "motion/react";
import { pad2 } from "../utils";

export type HorariosCalendarTab = "miembros" | "reservas";

import type { TabItem } from "../ui/nav/Tabs";

export const MY_SCHEDULE_VIEW_TAB_ITEMS: TabItem[] = [
  { id: "diario", label: "Diario", href: "#", icon: null },
  { id: "semanal", label: "Semanal", href: "#", icon: null },
];

export const MY_SCHEDULE_VIEW_KEY = "bo_horarios_my_schedule_view";

export const ANIMATION_CALENDAR_TRANSITION: Transition = { duration: 0.6, ease: "easeInOut" as const };
export const ANIMATION_CALENDAR_TRANSITION_REDUCED: Transition = { duration: 0 };

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => pad2(i));
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => pad2(i));
