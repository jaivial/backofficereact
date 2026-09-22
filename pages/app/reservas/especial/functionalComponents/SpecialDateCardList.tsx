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
      <div className="bo-panel" data-testid={`${testId}-empty-panel`}>
        <div
          data-testid={`${testId}-empty`}
          className="bo-panelBody pt-4 text-center text-sm text-[color:var(--bo-muted)]"
        >
          <Sparkles
            size={20}
            strokeWidth={1.6}
            className="mx-auto mb-2 opacity-60"
            aria-hidden="true"
          />
          No hay fechas especiales configuradas todavía.
        </div>
      </div>
    );
  }

  return (
    /* Each card is its own panel surface now, so the stack is a plain
       grid — wrapping it in a second `bo-panel` would nest one panel
       inside another and double the chrome. */
    <div
      data-testid={testId}
      aria-label="Fechas festivas"
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
 * Layout is three stacked rows inside the card body:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  [date icon]  Mon, 15 Jan 2026              [Prereserva]    │  <- header
 *   │                                                             │
 *   │  Title (optional)                                           │
 *   │                                                             │
 *   │  Menús: arroz, postre, ...                                  │  <- menus
 *   │                                                             │
 *   │  ──────────────────────────────────────────────────────────  │
 *   │  [NN%]   👥  0/45  pax  →                                    │  <- count
 *   └─────────────────────────────────────────────────────────────┘
 *
 * - header: small calendar icon + date + prereserva badge (shadcn
 *   rounded-full chip).
 * - menus: a single line-clamp-2 line with the menu list.
 * - count: percentage chip on the LEFT of the people breakdown
 *   (users icon + "people/limit" + "pax" suffix) + chevron on the
 *   right. The percentage sits on the same row so the eye reads
 *   "% → people/limit" left-to-right.
 *
 * The percentage chip is a small square (48px) with just the rounded
 * percentage centered inside — NO donut / circle. Border tints
 * amber/orange/red as occupancy climbs.
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
        // Panel surface. `bo-panel` paints the chrome (radius, background,
        // shadow) and `bo-panelBody` supplies the 0 18px 16px padding —
        // bo-panelBody alone is padding-only, which is why it has to be
        // paired with bo-panel for the card to actually read as a panel.
        "bo-panel bo-panelBody",
        "group relative block w-full cursor-pointer overflow-hidden",
        // pt: bo-panelBody intentionally has no top padding.
        "pt-4 text-left text-[color:var(--bo-text)]",
        "transition-[transform,box-shadow,background-color] duration-150 ease-out",
        "hover:bg-[var(--bo-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bo-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bo-surface)]",
        "active:scale-[0.99] motion-reduce:transition-none",
      )}
      data-testid={testId}
    >
      {/* Three vertical sections, each in its own div. The body is
          a flex column so the rows always stack the same way
          regardless of viewport. */}
      <div className="flex flex-col" data-testid={`${testId}-body`}>

        {/* 1 — Header: date icon + date + prereserva badge. */}
        <div
          className="flex items-start justify-between gap-2"
          data-testid={`${testId}-header`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                "bg-[var(--bo-accent-alpha)] text-[color:var(--bo-accent)]",
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
          <span
            data-testid={`${testId}-prereserva`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              prereserva
                ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "border-[color:var(--bo-card-line)] bg-[var(--bo-surface-2)] text-[color:var(--bo-card-ink-2)]",
            )}
          >
            {prereserva ? "Prereserva" : "Sin prereserva"}
          </span>
        </div>

        {/* Title (optional) — sits inside the header block so a long
            title wraps under the date without pushing the menus row. */}
        {entry.title ? (
          <div
            className="mt-1.5 truncate text-sm font-medium text-[color:var(--bo-text)]"
            data-testid={`${testId}-title`}
          >
            {entry.title}
          </div>
        ) : null}

        {/* 2 — Menus row. Always full-width. */}
        <div
          className="mt-2 line-clamp-2 text-xs text-[color:var(--bo-card-ink-2)]"
          data-testid={`${testId}-menus`}
        >
          <span className="font-medium text-[color:var(--bo-card-ink)]">Menús: </span>
          {menuSummary}
        </div>

        {/* 3 — Count row: percentage chip (LEFT) + people breakdown
            (users icon + ratio + pax suffix) + chevron. The chip
            sits to the LEFT of the breakdown so the operator reads
            "%  ->  people/limit  pax" left-to-right. */}
        <div
          className={cn(
            "mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--bo-card-line)] pt-3",
            "sm:mt-4 sm:gap-3 sm:pt-4",
          )}
          data-testid={`${testId}-count`}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Percentage chip — small square, NO donut/circle. */}
            <OccupancyChip
              pct={occupancy.pct}
              tone={occupancy.tone}
              people={people}
              limit={limit}
              data-testid={`${testId}-occupancy`}
            />
            {/* People breakdown. */}
            <div
              className="flex items-center gap-1.5 text-xs text-[color:var(--bo-card-ink-2)] sm:gap-2"
              data-testid={`${testId}-meta`}
            >
              <span
                aria-hidden="true"
                data-testid={`${testId}-users-icon`}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--bo-surface-2)] text-[color:var(--bo-text)] sm:h-7 sm:w-7"
              >
                <Users size={14} strokeWidth={1.8} />
              </span>
              <span
                className="tabular-nums font-medium text-[color:var(--bo-text)]"
                data-testid={`${testId}-ratio`}
              >
                {people}/{limit}
              </span>
              <span className="hidden sm:inline">pax</span>
            </div>
          </div>
          <ChevronRight
            size={16}
            strokeWidth={1.8}
            className={cn(
              "ml-1 shrink-0 text-[color:var(--bo-card-ink-2)]",
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
 * — just a centered number on a shadcn-style bordered surface. The
 * chip border tints amber/red as occupancy climbs so the operator gets
 * a quick visual cue.
 */
function OccupancyChip({
  pct,
  tone,
  people,
  limit,
  className,
  ...rest
}: {
  pct: number;
  tone: "base" | "y50" | "o75" | "o85" | "r100";
  people: number;
  limit: number;
  className?: string;
  "data-testid"?: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    base: "border-[color:var(--bo-card-line)] bg-[var(--bo-surface-2)] text-[color:var(--bo-text)]",
    y50: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    o75: "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    o85: "border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-300",
    r100: "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-xs font-semibold tabular-nums sm:h-12 sm:w-12 sm:text-sm",
        toneClasses[tone],
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
