import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Switch } from "../../shadcn/Switch";
import { cn } from "../../shadcn/utils";
import { HourSplitCard, type HourSplitEditMode } from "./HourSplitCard";
import {
  rebalanceByPercentage,
  rebalanceByPeople,
  percentagesToPeople,
  sumPercentages,
  type Percentages,
} from "./lib/rebalance";

export type HourSplitConfigProps = {
  enabled: boolean;
  dailyLimit: number;
  activeHours: string[];
  percentages: Percentages;
  /** People capacity per hour; derived client-side when omitted (default variant). */
  hourlyCapacities?: Record<string, number>;
  bookingsByHour?: Record<string, number>;
  /** "override" | "default" — where the effective flag comes from. */
  source?: "override" | "default";
  /** "day" (live bookings) | "default" (restaurant template, no bookings). */
  variant?: "day" | "default";
  busy?: boolean;
  className?: string;
  onToggleEnabled: (next: boolean) => void;
  /** Persist percentages. Return false to signal error (toast). */
  onCommitPercentages: (percentages: Percentages) => Promise<boolean> | boolean;
  pushToast: (toast: { kind: "success" | "error"; title: string; message?: string }) => void;
};

const COMMIT_DEBOUNCE_MS = 600;

export function HourSplitConfig({
  enabled,
  dailyLimit,
  activeHours,
  percentages,
  bookingsByHour,
  source,
  variant = "day",
  busy,
  className,
  onToggleEnabled,
  onCommitPercentages,
  pushToast,
}: HourSplitConfigProps) {
  const [local, setLocal] = React.useState<Percentages>(percentages);
  const [mode, setMode] = React.useState<HourSplitEditMode>("percentage");
  const [open, setOpen] = React.useState(true);
  const commitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync local state when the source-of-truth percentages change (e.g. reload, date change).
  React.useEffect(() => {
    setLocal(percentages);
  }, [percentages]);

  React.useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, []);

  // Capacities are always derived from the local (optimistic) percentages so the
  // donuts reflow live as the user edits. The server hourlyCapacities prop is only
  // used to seed the initial render before the first edit.
  const capacities = React.useMemo<Record<string, number>>(
    () => percentagesToPeople(local, dailyLimit),
    [local, dailyLimit],
  );

  const scheduleCommit = React.useCallback(
    (next: Percentages) => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(async () => {
        const result = await Promise.resolve(onCommitPercentages(next));
        if (result) {
          pushToast({ kind: "success", title: "Guardado", message: "Reparto por hora actualizado" });
        } else {
          pushToast({ kind: "error", title: "Error", message: "No se pudo guardar el reparto por hora" });
        }
      }, COMMIT_DEBOUNCE_MS);
    },
    [onCommitPercentages, pushToast],
  );

  const handleCardChange = React.useCallback(
    (hour: string, value: number, cardMode: HourSplitEditMode) => {
      const next =
        cardMode === "percentage"
          ? rebalanceByPercentage(local, hour, value)
          : rebalanceByPeople(local, hour, value, dailyLimit);
      setLocal(next);
      scheduleCommit(next);
    },
    [local, dailyLimit, scheduleCommit],
  );

  const handleReset = React.useCallback(() => {
    const next = Object.fromEntries(activeHours.map((h) => [h, 0])) as Percentages;
    // Equal split via rebalance seed.
    const seeded = rebalanceByPercentage(next, activeHours[0], 100 / activeHours.length);
    setLocal(seeded);
    scheduleCommit(seeded);
  }, [activeHours, scheduleCommit]);

  const totalPct = sumPercentages(local);
  const totalPeople = Object.values(capacities).reduce((a, b) => a + b, 0);

  const helperText =
    variant === "default"
      ? "Reparto por hora por defecto aplicado a nuevas fechas."
      : enabled
        ? "Reparte el aforo diario entre las horas activas."
        : "Sin reparto por hora: se permite reservar cualquier hora mientras quede aforo diario.";

  return (
    <section
      className={cn("bo-panel bo-hsplitConfig", open && "is-open", className)}
      data-testid="hour-split-config"
      data-ui="hour-split-config"
      aria-label="Reparto por hora"
    >
      <div className="bo-panelHead bo-hsplitConfigHead" data-slot="hsplit-head">
        <button
          type="button"
          className="bo-hsplitConfigTrigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="bo-hsplit-cards"
          data-testid="hour-split-config-trigger"
          data-ui="hour-split-config-trigger"
        >
          <span className="bo-panelTitle" data-slot="hsplit-title">
            Reparto por hora
          </span>
          {source ? (
            <span className="bo-panelMeta" data-slot="hsplit-source" data-testid="hour-split-source">
              {source === "override" ? "Override del día" : "Por defecto"}
            </span>
          ) : null}
          <span className="bo-accordionIcon" data-slot="hsplit-chevron" aria-hidden="true">
            <ChevronDown size={16} strokeWidth={1.8} />
          </span>
        </button>
      </div>

      <div className="bo-panelBody bo-hsplitConfigBody" data-slot="hsplit-body">
        <div className="bo-row bo-hsplitToggleRow" data-slot="hsplit-toggle-row">
          <label className="bo-label bo-hsplitToggleLabel" htmlFor="hsplit-toggle" data-slot="hsplit-toggle-label">
            Reparto por hora activo
          </label>
          <Switch
            id="hsplit-toggle"
            checked={enabled}
            disabled={busy}
            onCheckedChange={onToggleEnabled}
            aria-label="Activar o desactivar reparto por hora"
            data-testid="hour-split-toggle"
            data-ui="hour-split-toggle"
          />
        </div>

        <p className="bo-mutedText bo-hsplitHelper" data-slot="hsplit-helper">
          {helperText}
        </p>

        {enabled ? (
          <>
            <div
              className="bo-hsplitCards"
              data-slot="hsplit-cards"
              data-testid="hour-split-cards"
              id="bo-hsplit-cards"
              role="list"
              hidden={!open}
            >
              {activeHours.map((hour) => (
                <div role="listitem" key={hour} data-slot="hsplit-card-wrapper">
                  <HourSplitCard
                    hour={hour}
                    percentage={local[hour] ?? 0}
                    bookings={bookingsByHour?.[hour] ?? 0}
                    capacity={capacities[hour] ?? 0}
                    dailyLimit={dailyLimit}
                    mode={mode}
                    disabled={busy}
                    onChange={handleCardChange}
                    onModeChange={setMode}
                  />
                </div>
              ))}
            </div>

            <div className="bo-row bo-hsplitTotals" data-slot="hsplit-totals">
              <div className="bo-mutedText" data-slot="hsplit-totals-pct" data-testid="hour-split-totals-pct">
                Total: {Math.round(totalPct)}%
              </div>
              <div className="bo-mutedText" data-slot="hsplit-totals-people" data-testid="hour-split-totals-people">
                {totalPeople}/{dailyLimit} pax
              </div>
              <button
                type="button"
                className="bo-btn bo-btn--ghost bo-hsplitReset"
                onClick={handleReset}
                disabled={busy}
                data-testid="hour-split-reset"
                data-ui="hour-split-reset"
              >
                Reparto igualitario
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
