import React from "react";
import { CalendarDays, ChevronRight, Sparkles, Users } from "lucide-react";

import type { SpecialDateListEntry } from "../../../../../api/types";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { DonutOccupancy } from "../../../../../ui/widgets/DonutOccupancy";

/**
 * Card list of every special date for the current tenant.
 * Used in the Especial tab so the operator can jump to any existing
 * special date without leaving the tab.
 */
export function SpecialDateCardList({
  entries,
  onSelect,
  testId = "special-date-card-list",
}: {
  entries: SpecialDateListEntry[] | undefined | null;
  onSelect: (date: string) => void;
  testId?: string;
}) {
  const list = entries ?? [];
  if (list.length === 0) {
    return (
      <div
        data-testid={`${testId}-empty`}
        className="rounded-[var(--bo-radius-lg)] border border-dashed border-(--bo-border) bg-(--bo-surface-2) px-4 py-8 text-center text-sm text-(--bo-muted)"
      >
        <Sparkles
          size={20}
          strokeWidth={1.6}
          className="mx-auto mb-2 opacity-60"
          aria-hidden="true"
        />
        No hay fechas especiales configuradas todavía.
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      aria-label="Fechas con menú especial"
      // Each card is its own component (NOT a list item) so it fills the
      // available width of the parent grid. The wrapper grid stacks them
      // vertically with a consistent gap; on wide viewports the parent
      // grid in +Page.tsx can switch to multi-column if desired.
      className="grid grid-cols-1 gap-3"
      role="group"
    >
      {list.map((e) => (
        <SpecialDateCard key={e.date} entry={e} onSelect={onSelect} />
      ))}
    </div>
  );
}

/**
 * One card per special date. Renders as a single `<button>` so the entire
 * surface is the tap target (>=44px tall, accessible by default) and the
 * grid layout below never depends on a list-wrapper.
 *
 * Layout (mobile first, then sm+):
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │ [date  Wed, 15 Jan 2026]    [Prereserva]  • 12/45 pax → │
 *   │ Title (optional)                                       │
 *   │ Menus: arroz, postre, ...                              │
 *   │ ─────────────────────────────────────────────────────  │
 *   │ [donut 48px]                                           │
 *   └────────────────────────────────────────────────────────┘
 *
 * The card uses a CSS grid so every region has a defined slot — the
 * header row never wraps the donut under the title by accident, and
 * the meta line never reflows onto two lines on narrow screens.
 */
function SpecialDateCard({
  entry,
  onSelect,
}: {
  entry: SpecialDateListEntry;
  onSelect: (date: string) => void;
}) {
  const menus = entry.menus ?? [];
  const menuSummary = menus.length === 0 ? "Sin menús asignados" : menus.join(", ");
  const people = typeof entry.people === "number" ? entry.people : 0;
  const limit = typeof entry.limit === "number" && entry.limit > 0 ? entry.limit : 45;
  const testId = `special-date-card-${entry.date}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.date)}
      aria-label={`Ir a ${entry.date}: ${entry.title || menuSummary}`}
      className="bo-panel group relative w-full cursor-pointer overflow-hidden rounded-[var(--bo-radius-lg)] p-4 text-left transition-[transform,opacity,box-shadow,border-color] duration-150 ease-out active:scale-[0.98] hover:border-(--bo-accent-border, rgba(185,168,255,0.45)) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--bo-accent, rgba(185,168,255,0.6))"
      data-testid={testId}
      // Single grid: header / title / menus / footer — each cell occupies
      // a deterministic slot. min-w-0 everywhere so long titles truncate
      // instead of pushing the donut out of the viewport on phones.
    >
      {/* Header: date + prereserva badge + ratio + chevron */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays
            size={16}
            strokeWidth={1.6}
            className="shrink-0 text-(--bo-accent, rgba(185,168,255,0.9))"
            aria-hidden="true"
          />
          <span
            className="truncate text-sm font-semibold tabular-nums"
            data-testid={`${testId}-date`}
          >
            {formatHumanDate(entry.date)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <StatusBadge
            variant={entry.prereserva_enabled ? "warning" : "neutral"}
            size="sm"
            data-testid={`${testId}-prereserva`}
          >
            {entry.prereserva_enabled ? "Prereserva" : "Sin prereserva"}
          </StatusBadge>
        </div>
      </div>

      {/* Title (optional, truncate-safe) */}
      {entry.title ? (
        <div
          className="mt-2 truncate text-sm font-medium text-(--bo-fg)"
          data-testid={`${testId}-title`}
        >
          {entry.title}
        </div>
      ) : null}

      {/* Menus: line-clamp-2 keeps the card compact when the menu list is long */}
      <div
        className="mt-1 line-clamp-2 text-xs text-(--bo-muted)"
        data-testid={`${testId}-menus`}
      >
        <span className="font-medium text-(--bo-fg)/80">Menús: </span>
        {menuSummary}
      </div>

      {/* Footer: donut on the left, occupancy summary on the right. */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-(--bo-border)/60 pt-3">
        <DonutOccupancy
          totalPeople={people}
          limit={limit}
          size={44}
          strokeWidth={6}
          data-testid={`${testId}-donut`}
        />
        <div
          className="flex flex-1 items-center justify-end gap-2 text-xs text-(--bo-muted)"
          data-testid={`${testId}-meta`}
        >
          <Users
            size={14}
            strokeWidth={1.8}
            className="shrink-0"
            aria-hidden="true"
          />
          <span className="tabular-nums font-medium text-(--bo-fg)" data-testid={`${testId}-ratio`}>
            {people}/{limit}
          </span>
          <span className="hidden sm:inline">pax</span>
          <ChevronRight
            size={16}
            strokeWidth={1.8}
            className="ml-1 shrink-0 text-(--bo-muted) transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
            data-testid={`${testId}-chevron`}
          />
        </div>
      </div>
    </button>
  );
}

function formatHumanDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
