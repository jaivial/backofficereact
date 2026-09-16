import React from "react";

// Coordination id: menu_weekday_availability_v1 + config_weekday_grid_v1
// Shared 7-card weekday selector. Extracted from the inline grid that used to
// live in /app/config (Panel bodyClassName "bo-panelBody bo-configWeekdayGrid")
// so the menu editor reuses the exact same interaction and styling.
//
// The canonical keys are the same tokens persisted in the backend
// `menu_weekday_availability` table and exposed by the public client SDK, so a
// card highlighted here is understood everywhere else.
//
// The component renders the seven cards as a fragment: the caller owns the
// grid container so it can keep the shared `bo-configWeekdayGrid` body class.

export type WeekdayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type WeekdayGridDay<K extends string = WeekdayKey> = {
  key: K;
  label: string;
  shortLabel: string;
};

export const WEEKDAYS: WeekdayGridDay[] = [
  { key: "monday", label: "Lunes", shortLabel: "L" },
  { key: "tuesday", label: "Martes", shortLabel: "M" },
  { key: "wednesday", label: "Miércoles", shortLabel: "X" },
  { key: "thursday", label: "Jueves", shortLabel: "J" },
  { key: "friday", label: "Viernes", shortLabel: "V" },
  { key: "saturday", label: "Sábado", shortLabel: "S" },
  { key: "sunday", label: "Domingo", shortLabel: "D" },
];

export type WeekdayGridProps<K extends string = WeekdayKey> = {
  /** Weekday cards to render. Defaults to the canonical Monday..Sunday list. */
  days?: WeekdayGridDay<K>[];
  /** Selected state per weekday key; truthy means highlighted (is-on). */
  selected: Partial<Record<K, boolean>>;
  /** Fired when a card is tapped. Cards toggle between selected / not selected. */
  onToggle: (key: K) => void;
  /** When true the cards are rendered disabled (e.g. while a save is running). */
  busy?: boolean;
  /** Hard-disable every card regardless of busy. */
  disabled?: boolean;
  /** Prefix for the per-card data-testid (unique per usage site). */
  testIdPrefix?: string;
  /** Prefix for the per-card data-slot. */
  slotPrefix?: string;
  /** Suffix used in the aria-label when the card is selected. */
  selectedLabel?: string;
  /** Suffix used in the aria-label when the card is not selected. */
  unselectedLabel?: string;
};

export function WeekdayGrid<K extends string = WeekdayKey>({
  days = WEEKDAYS as unknown as WeekdayGridDay<K>[],
  selected,
  onToggle,
  busy = false,
  disabled = false,
  testIdPrefix = "weekday",
  slotPrefix = "weekday",
  selectedLabel = "seleccionado",
  unselectedLabel = "no seleccionado",
}: WeekdayGridProps<K>) {
  const isDisabled = disabled || busy;
  return (
    <>
      {days.map((weekday) => {
        const isOn = Boolean(selected[weekday.key]);
        return (
          <button
            key={weekday.key}
            type="button"
            className={`bo-hourCard bo-configDayCard${isOn ? " is-on" : ""}`}
            disabled={isDisabled}
            aria-pressed={isOn}
            aria-label={`${weekday.label} (${isOn ? selectedLabel : unselectedLabel})`}
            onClick={() => onToggle(weekday.key)}
            data-slot={`${slotPrefix}-button`}
            data-testid={`${testIdPrefix}-${weekday.key}`}
          >
            <div className="bo-configDayCardLabel" data-slot={`${slotPrefix}-label`}>
              <span className="bo-configDayCardLabelFull" data-slot={`${slotPrefix}-labelFull`}>{weekday.label}</span>
              <span className="bo-configDayCardLabelShort" aria-hidden="true" data-slot={`${slotPrefix}-labelShort`}>
                {weekday.shortLabel}
              </span>
            </div>
          </button>
        );
      })}
    </>
  );
}

export default WeekdayGrid;
