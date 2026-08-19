import * as React from "react";

import { Switch } from "../../shadcn/Switch";
import { Panel } from "../../shell/Panel";
import type { LocationBookingConfig } from "../../../api/types";

/**
 * Location booking toggles: "Permitir reserva de planta" / "Permitir reserva de salón".
 *
 * Plain ON/OFF switches in both variants. In "day" variant a date with no
 * stored override shows (and starts from) the global default; toggling to the
 * same value as the global default clears the override so the date inherits it.
 */
export type LocationBookingTogglesProps = {
  variant?: "default" | "day";
  /** Effective values (restaurant defaults in "default" variant). */
  allowFloorReservation: boolean;
  allowSalonReservation: boolean;
  /** "day" only: global values shown as hints. */
  global?: LocationBookingConfig["global"];
  busy?: boolean;
  /** Persist a global toggle ("default" variant). */
  onSetGlobal?: (patch: { allowFloorReservation?: boolean; allowSalonReservation?: boolean }) => void;
  /** Persist a per-date override ("day" variant). */
  onSetOverride?: (patch: { allowFloorReservation?: boolean; allowSalonReservation?: boolean }) => void;
};

export function LocationBookingToggles({
  variant = "default",
  allowFloorReservation,
  allowSalonReservation,
  global,
  busy,
  onSetGlobal,
  onSetOverride,
}: LocationBookingTogglesProps) {
  const isDay = variant === "day";
  const onToggle = isDay ? onSetOverride : onSetGlobal;

  const row = (flag: "floor" | "salon") => {
    const checked = flag === "floor" ? allowFloorReservation : allowSalonReservation;
    const globalValue = flag === "floor" ? global?.allowFloorReservation : global?.allowSalonReservation;
    const label = flag === "floor" ? "Permitir reserva de planta" : "Permitir reserva de salón";
    const hint = isDay
      ? typeof globalValue === "boolean"
        ? `Valor global: ${globalValue ? "activado" : "desactivado"}`
        : "El cliente elige la ubicación durante la reserva"
      : flag === "floor"
        ? "Aparece un selector de planta en el paso 1 de la reserva web"
        : "Aparece un selector de salón en el paso 1 de la reserva web";
    return (
      <div className="bo-locationToggleRow" data-ui={`location-toggle-${flag}-row`}>
        <div className="bo-locationToggleInfo">
          <div className="bo-locationToggleLabel">{label}</div>
          <div className="bo-locationToggleHint">{hint}</div>
        </div>
        <Switch
          checked={checked}
          disabled={busy}
          onCheckedChange={(next) => {
            if (flag === "floor") onToggle?.({ allowFloorReservation: next });
            else onToggle?.({ allowSalonReservation: next });
          }}
          aria-label={label}
          data-ui={`location-${flag}-switch`}
        />
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
      {row("floor")}
      {row("salon")}
      {!allowFloorReservation && !allowSalonReservation ? (
        <div className="bo-locationToggleNote" data-ui="location-both-off-note">
          Con ambos interruptores desactivados, el cliente no elige ubicación: la reserva no incluye selector de planta ni salón.
        </div>
      ) : null}
    </Panel>
  );
}
