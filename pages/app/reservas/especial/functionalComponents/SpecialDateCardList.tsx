import React from "react";
import { ChevronRight, Sparkles } from "lucide-react";

import type { SpecialDateListEntry } from "../../../../../api/types";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { DonutOccupancy } from "../../../../../ui/widgets/DonutOccupancy";

/**
 * Card list of every active special date for the current tenant.
 * Used when the selected date is NOT a special date yet, so the operator can
 * convert it OR navigate to an existing one.
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
        className="rounded-lg border border-dashed border-(--bo-border) bg-(--bo-surface-2) px-4 py-6 text-center text-sm text-(--bo-muted)"
      >
        {/* Subtle entrance: opacity fades in once the list mounts (interruptible).
            Animation is skipped on first render via key so SSR → CSR doesn't replay. */}
        <Sparkles
          size={18}
          strokeWidth={1.6}
          className="mx-auto mb-2 opacity-60 motion-safe:animate-[sparkle-fade_1.6s_ease-out]"
          aria-hidden="true"
        />
        No hay fechas especiales configuradas todavía.
      </div>
    );
  }

  return (
    <ul data-testid={testId} className="flex flex-col gap-2" aria-label="Fechas con menú especial">
      {list.map((e) => (
        <SpecialDateCard key={e.date} entry={e} onSelect={onSelect} />
      ))}
    </ul>
  );
}

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
    <li>
      {/*
        Surface depth via box-shadow instead of a structural border.
        Concentric: outer radius = --bo-radius-lg; the inner donut block
        uses the same value with a 1px gap so the corners breathe.
        Hover reveals a colored border + accent shadow via the static-cue
        rule (the chevron also nudges right for affordance).
      */}
      <button
        type="button"
        onClick={() => onSelect(entry.date)}
        aria-label={`Ir a ${entry.date}: ${entry.title || menuSummary}`}
        className="group bo-panel relative flex w-full cursor-pointer items-stretch gap-3 overflow-hidden rounded-[var(--bo-radius-lg)] p-3 text-left transition-[transform,opacity,box-shadow,border-color] duration-150 ease-out active:scale-[0.96] hover:border-(--bo-accent-border, rgba(185,168,255,0.35)) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--bo-accent, rgba(185,168,255,0.6)) sm:p-4"
        data-testid={testId}
      >
        <div className="flex items-stretch gap-3">
          {/* Left: title + menu subtitle + prereserva badge */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold tabular-nums" data-testid={`${testId}-date`}>
                {formatHumanDate(entry.date)}
              </span>
              <StatusBadge
                variant={entry.prereserva_enabled ? "warning" : "neutral"}
                size="sm"
                data-testid={`${testId}-prereserva`}
              >
                {entry.prereserva_enabled ? "Prereserva" : "Sin prereserva"}
              </StatusBadge>
            </div>
            {entry.title ? (
              <div className="mt-0.5 truncate text-sm font-medium" data-testid={`${testId}-title`}>
                {entry.title}
              </div>
            ) : null}
            <div className="mt-0.5 line-clamp-2 text-xs text-(--bo-muted)" data-testid={`${testId}-menus`}>
              {menuSummary}
            </div>
          </div>

          {/* Right: occupancy + chevron. Chev nudges right on hover for affordance. */}
          <div className="flex flex-col items-end justify-between gap-2" data-testid={`${testId}-meta`}>
            <DonutOccupancy
              totalPeople={people}
              limit={limit}
              size={48}
              strokeWidth={6}
              data-testid={`${testId}-donut`}
            />
            <div className="flex items-center gap-1 text-xs text-(--bo-muted)">
              <span className="tabular-nums" data-testid={`${testId}-ratio`}>
                {people}/{limit}
              </span>
              <ChevronRight
                size={16}
                strokeWidth={1.8}
                className="text-(--bo-muted) transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
                data-testid={`${testId}-chevron`}
              />
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

function formatHumanDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}
