import * as React from "react";

import { HourSplitDonut } from "./HourSplitDonut";
import { cn } from "../../shadcn/utils";

export type HourSplitEditMode = "percentage" | "people";

export type HourSplitCardProps = {
  hour: string;
  percentage: number;
  bookings: number;
  /** Derived people capacity for this hour (round(pct/100*limit)). */
  capacity: number;
  dailyLimit: number;
  mode: HourSplitEditMode;
  disabled?: boolean;
  /** Fired with the raw new value for this hour in the active mode (caller rebalances). */
  onChange: (hour: string, value: number, mode: HourSplitEditMode) => void;
  /** Fired when the card's own mode toggle is flipped (parent owns mode to keep siblings in sync). */
  onModeChange: (mode: HourSplitEditMode) => void;
};

export function HourSplitCard({
  hour,
  percentage,
  bookings,
  capacity,
  dailyLimit,
  mode,
  disabled,
  onChange,
  onModeChange,
}: HourSplitCardProps) {
  const inputId = `hsplit-${hour.replace(":", "")}`;
  const max = mode === "percentage" ? 100 : dailyLimit;
  const value = mode === "percentage" ? percentage : capacity;

  return (
    <div
      className="bo-hsplitCard bo-card"
      data-testid={`hour-split-card-${hour}`}
      data-ui="hour-split-card"
      data-hour={hour}
    >
      <div className="bo-hsplitCardHead" data-slot="card-head">
        <div className="bo-hsplitCardHour" data-slot="card-hour">{hour}</div>
        <div className="bo-mutedText bo-hsplitCardBookings" data-slot="card-bookings">
          {bookings} reservados
        </div>
      </div>

      <HourSplitDonut bookings={bookings} capacity={capacity} percentage={percentage} label={hour} />

      <div className="bo-hsplitCardMode" data-slot="card-mode" role="group" aria-label={`Modo de edición ${hour}`}>
        <button
          type="button"
          className={cn("bo-hsplitModeBtn", mode === "percentage" && "is-active")}
          onClick={() => onModeChange("percentage")}
          disabled={disabled}
          aria-pressed={mode === "percentage"}
          data-testid={`hour-split-mode-pct-${hour}`}
          data-ui="hour-split-mode-pct"
        >
          %
        </button>
        <button
          type="button"
          className={cn("bo-hsplitModeBtn", mode === "people" && "is-active")}
          onClick={() => onModeChange("people")}
          disabled={disabled}
          aria-pressed={mode === "people"}
          data-testid={`hour-split-mode-px-${hour}`}
          data-ui="hour-split-mode-people"
        >
          pax
        </button>
      </div>

      <div className="bo-field bo-hsplitCardField" data-slot="card-field">
        <label className="bo-label bo-hsplitCardLabel" htmlFor={inputId} data-slot="card-label">
          {mode === "percentage" ? "Porcentaje" : "Personas"}
        </label>
        <input
          id={inputId}
          className="bo-input bo-input--sm bo-hsplitCardInput"
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          aria-label={`${mode === "percentage" ? "Porcentaje" : "Personas"} para la hora ${hour}`}
          data-testid={`hour-split-input-${hour}`}
          data-ui="hour-split-input"
          data-hour={hour}
          data-mode={mode}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChange(hour, Math.max(0, Math.min(max, Math.trunc(n))), mode);
          }}
        />
      </div>
    </div>
  );
}
