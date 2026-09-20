import React from "react";
import { CalendarDays, ChevronRight, Sparkles, Users } from "lucide-react";

import type { SpecialDateListEntry } from "../../../../../api/types";
import { DonutOccupancy } from "../../../../../ui/widgets/DonutOccupancy";
import { cn } from "../../../../../ui/shadcn/utils";

/**
 * Card list of every special date for the current tenant. Used in the
 * Especial tab so the operator can jump to any existing special date
 * without leaving the tab.
 *
 * Each card is its own block component (a single `<button>`) so it
 * fills the available width of the parent grid. They are NOT list
 * items — see the comment on SpecialDateCard for the rationale.
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
        className={cn(
          "rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground",
          "shadow-sm",
        )}
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
 * One card per special date. The whole surface is a single `<button>`
 * so the tap target is the entire card (>=44px tall, accessible by
 * default) and the grid layout below never depends on a list-wrapper.
 *
 * shadcn-style chrome:
 *  - rounded-lg border bg-card text-card-foreground shadow-sm
 *  - hover lifts the shadow + accent border
 *  - hover bg-accent/30 for the icon + donut ring
 *
 * Responsive donut position:
 *  - mobile (<sm): the donut sits in the top-right of the header row
 *    next to the prereserva badge so the body stays single-column.
 *  - tablet (sm): the donut moves to the bottom-left of a footer row
 *    that also shows the occupancy ratio.
 *  - desktop (md+): the donut grows a bit and the footer is wider
 *    with the ratio + chevron aligned right.
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
  const prereserva = entry.prereserva_enabled;
  const testId = `special-date-card-${entry.date}`;

  // Donut sizing per breakpoint. Mobile-first: small in the header,
  // bigger in the footer from `sm` up.
  const donutSizeMobile = 40;
  const donutSizeFooter = 56;

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.date)}
      aria-label={`Ir a ${entry.date}: ${entry.title || menuSummary}`}
      className={cn(
        // shadcn Card surface
        "group relative block w-full cursor-pointer overflow-hidden rounded-lg",
        "border border-border bg-card text-card-foreground shadow-sm",
        "transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out",
        "hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.99]",
        "text-left",
      )}
      data-testid={testId}
    >
      {/* Header row: date + (mobile-only) donut + prereserva badge.
          On mobile the donut is in the top-right; on >=sm the donut
          moves to the footer and this row only carries the badge. */}
      <div
        className={cn(
          "flex items-start justify-between gap-2 px-4 pt-4 sm:pt-5",
          // Bottom padding becomes 0 on >=sm because the footer takes over.
          "pb-3 sm:pb-0",
        )}
        data-testid={`${testId}-header`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Calendar accent in a small accent-tinted square so it reads
              as a "date chip" instead of a stray icon. */}
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              "bg-accent/40 text-primary",
            )}
            data-testid={`${testId}-date-icon`}
          >
            <CalendarDays size={14} strokeWidth={1.8} />
          </span>
          <span
            className="truncate text-sm font-semibold tabular-nums"
            data-testid={`${testId}-date`}
          >
            {formatHumanDate(entry.date)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Mobile-only compact donut (40px) — sits in the header. */}
          <div className="sm:hidden" data-testid={`${testId}-donut-mobile-wrap`}>
            <DonutOccupancy
              totalPeople={people}
              limit={limit}
              size={donutSizeMobile}
              strokeWidth={5}
              className="shrink-0"
              data-testid={`${testId}-donut`}
            />
          </div>
          {/* Status badge — shadcn-style secondary/primary variants
              (warning for prereserva, muted otherwise). We reuse the
              project's StatusBadge for consistency, but the colors
              map to the same semantic vars. */}
          <span
            data-testid={`${testId}-prereserva`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              prereserva
                ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "border-border bg-secondary text-muted-foreground",
            )}
          >
            {prereserva ? "Prereserva" : "Sin prereserva"}
          </span>
        </div>
      </div>

      {/* Title (optional). Sits below the header on mobile; sits in
          the same row as the footer donut on >=sm. */}
      {entry.title ? (
        <div
          className={cn(
            "truncate px-4 text-sm font-medium text-card-foreground",
            "sm:px-5",
          )}
          data-testid={`${testId}-title`}
        >
          {entry.title}
        </div>
      ) : null}

      {/* Menus line. Always full-width. */}
      <div
        className={cn(
          "mt-1 line-clamp-2 px-4 text-xs text-muted-foreground",
          "sm:px-5",
        )}
        data-testid={`${testId}-menus`}
      >
        <span className="font-medium text-foreground/80">Menús: </span>
        {menuSummary}
      </div>

      {/* Footer (>=sm): donut on the left + occupancy ratio on the right.
          On mobile the donut lives in the header, so this footer only
          shows the ratio + chevron. */}
      <div
        className={cn(
          "mt-3 flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3",
          "sm:mt-4 sm:px-5 sm:py-4",
        )}
        data-testid={`${testId}-footer`}
      >
        {/* sm+ donut — bigger, sits in a 56px slot so the arc + center
            text stay legible. The shadcn surface uses `bg-accent/40`
            inside the DonutOccupancy center to lift the percentage off
            the card surface. */}
        <div className="hidden sm:block shrink-0" data-testid={`${testId}-donut-footer-wrap`}>
          <DonutOccupancy
            totalPeople={people}
            limit={limit}
            size={donutSizeFooter}
            strokeWidth={6}
            className="shrink-0"
            data-testid={`${testId}-donut`}
          />
        </div>

        <div
          className={cn(
            "flex flex-1 items-center justify-end gap-2 text-xs text-muted-foreground",
            "sm:gap-2.5",
          )}
          data-testid={`${testId}-meta`}
        >
          <span
            aria-hidden="true"
            data-testid={`${testId}-users-icon`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-secondary-foreground sm:h-7 sm:w-7"
          >
            <Users size={14} strokeWidth={1.8} />
          </span>
          <span
            className="tabular-nums font-medium text-card-foreground"
            data-testid={`${testId}-ratio`}
          >
            {people}/{limit}
          </span>
          <span className="hidden sm:inline">pax</span>
          <ChevronRight
            size={16}
            strokeWidth={1.8}
            className={cn(
              "ml-1 shrink-0 text-muted-foreground",
              "transition-transform duration-150 ease-out",
              "group-hover:translate-x-0.5 motion-reduce:transition-none",
            )}
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
