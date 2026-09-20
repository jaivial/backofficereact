import React from "react";
import { CalendarDays, ChevronRight, Sparkles, Users } from "lucide-react";

import type { SpecialDateListEntry } from "../../../../../api/types";
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
 *  - hover bg-accent/30 for the icon + occupancy chip
 *
 * Occupancy indicator: a small square chip with just the percentage
 * number — NO donut / circle graph. The chip sits in the header
 * (mobile) or footer (>=sm) and uses the same shadcn `border-border
 * bg-secondary` surface as the users icon. The chip border tints
 * amber/red as occupancy climbs so the operator gets a quick visual
 * signal without a chart.
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
  const occupancy = computeOccupancy(people, limit);

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
      {/* Header row: date + (mobile-only) occupancy chip + prereserva badge.
          On mobile the chip is in the top-right; on >=sm the chip moves
          to the footer and this row only carries the badge. */}
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
          {/* Mobile-only occupancy chip (small) — sits in the header.
              Square container with just the percentage number, NO
              donut / circle graph. */}
          <OccupancyChip
            pct={occupancy.pct}
            tone={occupancy.tone}
            people={people}
            limit={limit}
            className="sm:hidden"
            data-testid={`${testId}-occupancy-mobile`}
          />
          {/* Status badge — shadcn-style secondary/primary variants
              (warning for prereserva, muted otherwise). */}
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

      {/* Title (optional). */}
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

      {/* Footer (>=sm): occupancy chip on the left + ratio + chevron on
          the right. On mobile the chip lives in the header, so this
          footer only shows the ratio + chevron. */}
      <div
        className={cn(
          "mt-3 flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3",
          "sm:mt-4 sm:px-5 sm:py-4",
        )}
        data-testid={`${testId}-footer`}
      >
        {/* sm+ occupancy chip — slightly bigger, sits in the footer
            row. Same square + percentage design, no chart. */}
        <OccupancyChip
          pct={occupancy.pct}
          tone={occupancy.tone}
          people={people}
          limit={limit}
          size="lg"
          className="hidden sm:inline-flex"
          data-testid={`${testId}-occupancy-footer`}
        />

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

/**
 * Small square chip showing the occupancy percentage. NO circle chart
 * — just a centered number on a shadcn-style bordered surface. The chip
 * border tints amber/red as occupancy climbs so the operator gets a
 * quick visual cue.
 *
 * Sizing:
 *  - default: 40px square (mobile header)
 *  - lg:      48px square (sm+ footer)
 *
 * Color tones (matches the DonutOccupancy tones):
 *  - base (0–49%):  border-border, text-card-foreground
 *  - y50 (50–74%):  border-amber-500/40, text-amber-700 dark:text-amber-300
 *  - o75 (75–84%):  border-amber-500/50, text-amber-700 dark:text-amber-300
 *  - o85 (85–99%):  border-orange-500/50, text-orange-700 dark:text-orange-300
 *  - r100 (>=100%): border-red-500/50, text-red-700 dark:text-red-300
 */
function OccupancyChip({
  pct,
  tone,
  people,
  limit,
  size = "sm",
  className,
  ...rest
}: {
  pct: number;
  tone: "base" | "y50" | "o75" | "o85" | "r100";
  people: number;
  limit: number;
  size?: "sm" | "lg";
  className?: string;
  "data-testid"?: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    base: "border-border bg-card text-card-foreground",
    y50: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    o75: "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    o85: "border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-300",
    r100: "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300",
  } as const;
  const sizeClasses =
    size === "lg"
      ? "h-12 w-12 text-sm"
      : "h-10 w-10 text-xs";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-semibold tabular-nums",
        toneClasses[tone],
        sizeClasses,
        className,
      )}
      aria-label={`Ocupación ${pct}% (${people} de ${limit} pax)`}
      title={`${pct}% de ocupación (${people}/${limit} pax)`}
      {...rest}
    >
      {pct}%
    </span>
  );
}

/**
 * Returns the rounded occupancy percentage and the tone bucket it falls
 * into, matching the thresholds used by DonutOccupancy.
 */
function computeOccupancy(
  people: number,
  limit: number,
): { pct: number; tone: "base" | "y50" | "o75" | "o85" | "r100" } {
  if (!Number.isFinite(limit) || limit <= 0) return { pct: 0, tone: "base" };
  const raw = (people / limit) * 100;
  const pct = Number.isFinite(raw) ? Math.round(raw) : 0;
  let tone: "base" | "y50" | "o75" | "o85" | "r100" = "base";
  if (pct >= 100) tone = "r100";
  else if (pct >= 85) tone = "o85";
  else if (pct >= 75) tone = "o75";
  else if (pct >= 50) tone = "y50";
  return { pct, tone };
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
