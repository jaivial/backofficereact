import * as React from "react";

import { Switch } from "../../shadcn/Switch";
import { Panel } from "../../shell/Panel";
import type { LocationBookingConfig } from "../../../api/types";

/**
 * Location booking toggles: "Permitir reserva de planta" / "Permitir reserva de salón".
 *
 * variant="default" — global restaurant defaults: plain ON/OFF switches.
 * variant="day" — per-date tri-state: inherit (null) | ON | OFF, showing the
 * inherited global value while in inherit mode.
 */
export type LocationBookingTogglesProps = {
  variant?: "default" | "day";
  /** Effective values (defaults in "default" variant, effective in "day" variant). */
  allowFloorReservation: boolean;
  allowSalonReservation: boolean;
  /** "day" only: raw override state (null = inherit) + global values for hints. */
  override?: LocationBookingConfig["override"];
  global?: LocationBookingConfig["global"];
  busy?: boolean;
  /** Persist a global toggle ("default" variant). */
  onSetGlobal?: (patch: { allowFloorReservation?: boolean; allowSalonReservation?: boolean }) => void;
  /** Persist a per-date override ("day" variant). null = inherit the global default. */
  onSetOverride?: (patch: { allowFloorReservation?: boolean | null; allowSalonReservation?: boolean | null }) => void;
};

type TriStateOption = {
  id: "inherit" | "on" | "off";
  label: string;
};

const TRI_STATE_OPTIONS: TriStateOption[] = [
  { id: "inherit", label: "Heredar" },
  { id: "on", label: "Sí" },
  { id: "off", label: "No" },
];

function triStateFromOverride(value: boolean | null | undefined): "inherit" | "on" | "off" {
  if (value === true) return "on";
  if (value === false) return "off";
  return "inherit";
}

export function LocationBookingToggles({
  variant = "default",
  allowFloorReservation,
  allowSalonReservation,
  override,
  global,
  busy,
  onSetGlobal,
  onSetOverride,
}: LocationBookingTogglesProps) {
  const isDay = variant === "day";

  const triButton = (flag: "floor" | "salon") => {
    const overrideValue = flag === "floor" ? override?.allowFloorReservation : override?.allowSalonReservation;
    const globalValue = flag === "floor" ? global?.allowFloorReservation : global?.allowSalonReservation;
    const current = triStateFromOverride(overrideValue);
    return (
      <div className="bo-locationTriState" role="group" aria-label={flag === "floor" ? "Modo reserva de planta" : "Modo reserva de salón"} data-ui={`location-tri-${flag}`}>
        {TRI_STATE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`bo-locationTriBtn${current === option.id ? " is-active" : ""}`}
            disabled={busy}
            aria-pressed={current === option.id}
            onClick={() => {
              if (!onSetOverride) return;
              const next = option.id === "inherit" ? null : option.id === "on";
              if (flag === "floor") onSetOverride({ allowFloorReservation: next });
              else onSetOverride({ allowSalonReservation: next });
            }}
          >
            {option.label}
            {option.id === "inherit" && typeof globalValue === "boolean"
              ? ` (${globalValue ? "sí" : "no"})`
              : ""}
          </button>
        ))}
      </div>
    );
  };

  return (
    <Panel
      title="Reserva de ubicación"
      meta={isDay ? "Por fecha" : "Por defecto"}
      bodyClassName="bo-locationToggles"
      data-ui="location-booking-toggles"
    >
      <div className="bo-locationToggleRow" data-ui="location-toggle-floor-row">
        <div className="bo-locationToggleInfo">
          <div className="bo-locationToggleLabel">Permitir reserva de planta</div>
          {isDay ? (
            <div className="bo-locationToggleHint">El cliente elige la planta durante la reserva</div>
          ) : (
            <div className="bo-locationToggleHint">Aparece un selector de planta en el paso 1 de la reserva web</div>
          )}
        </div>
        {isDay ? (
          triButton("floor")
        ) : (
          <Switch
            checked={allowFloorReservation}
            disabled={busy}
            onCheckedChange={(checked) => onSetGlobal?.({ allowFloorReservation: checked })}
            aria-label="Permitir reserva de planta"
            data-ui="location-floor-switch"
          />
        )}
      </div>

      <div className="bo-locationToggleRow" data-ui="location-toggle-salon-row">
        <div className="bo-locationToggleInfo">
          <div className="bo-locationToggleLabel">Permitir reserva de salón</div>
          {isDay ? (
            <div className="bo-locationToggleHint">El cliente elige el salón durante la reserva</div>
          ) : (
            <div className="bo-locationToggleHint">Aparece un selector de salón en el paso 1 de la reserva web</div>
          )}
        </div>
        {isDay ? (
          triButton("salon")
        ) : (
          <Switch
            checked={allowSalonReservation}
            disabled={busy}
            onCheckedChange={(checked) => onSetGlobal?.({ allowSalonReservation: checked })}
            aria-label="Permitir reserva de salón"
            data-ui="location-salon-switch"
          />
        )}
      </div>

      {!allowFloorReservation && !allowSalonReservation ? (
        <div className="bo-locationToggleNote" data-ui="location-both-off-note">
          Con ambos interruptores desactivados, el cliente no elige ubicación: la reserva no incluye selector de planta ni salón.
        </div>
      ) : null}
    </Panel>
  );
}
