import React from "react";
import { Switch } from "../../shadcn/Switch";

/**
 * Group-booking settings for a special menu.
 *
 * Two toggle switches: whether the special menu is offered as a group menu in
 * the booking wizard, and whether guests must pick their principales.
 *
 * Being a group menu does not need principals: a menu can be booked without
 * the guests choosing a main course, so this switch is always usable. Only
 * "Plato principal obligatorio" depends on the principals, so it stays disabled
 * (with an inline hint) until the menu offers at least one main dish.
 *
 * Presentational: the caller owns the state and persistence.
 * Coordination id: special_menu_group_booking_v1
 */
export function SpecialMenuGroupBookingSettings({
  groupMenuEnabled,
  principalesRequired,
  principalesAvailable,
  busy,
  onChangeGroupMenuEnabled,
  onChangePrincipalesRequired,
}: {
  groupMenuEnabled: boolean;
  principalesRequired: boolean;
  /** The menu offers at least one main dish to choose from. */
  principalesAvailable: boolean;
  busy: boolean;
  onChangeGroupMenuEnabled: (enabled: boolean) => void;
  onChangePrincipalesRequired: (required: boolean) => void;
}) {
  const groupMenuDisabled = busy;
  const principalesRequiredDisabled = busy || !groupMenuEnabled || !principalesAvailable;
  return (
    <div className="bo-field bo-field--full bo-stackFields" data-coordination-id="special_menu_group_booking_v1" data-testid="menu-crear-special-group-booking">
      <div className="bo-field" data-slot="special-group-booking-field" data-testid="menu-crear-special-group-booking-field">
        <label className="bo-switchRow" data-slot="special-group-booking-label-row">
          <span className="bo-label" data-slot="special-group-booking-label" data-testid="menu-crear-special-group-booking-label">Puede usarse como menú de grupo</span>
          <Switch
            checked={groupMenuEnabled}
            disabled={groupMenuDisabled}
            onCheckedChange={onChangeGroupMenuEnabled}
            aria-label="Puede usarse como menú de grupo"
            data-testid="menu-crear-special-group-booking-switch"
          />
        </label>
        <p className="bo-mutedText" data-testid="menu-crear-special-group-booking-state">
          {groupMenuEnabled ? "Se ofrece como menú de grupo en las reservas." : "No se ofrece como menú de grupo."}
        </p>
      </div>
      <div className="bo-field" data-slot="special-group-booking-required-field" data-testid="menu-crear-special-principales-required-field">
        <label className="bo-switchRow" data-slot="special-group-booking-required-label-row">
          <span className="bo-label" data-slot="special-group-booking-required-label" data-testid="menu-crear-special-principales-required-label">Plato principal obligatorio</span>
          <Switch
            checked={principalesRequired}
            disabled={principalesRequiredDisabled}
            onCheckedChange={onChangePrincipalesRequired}
            aria-label="Plato principal obligatorio"
            data-testid="menu-crear-special-principales-required-switch"
          />
        </label>
        {!principalesAvailable ? (
          <p className="bo-mutedText" data-testid="menu-crear-special-principales-required-hint">
            Añade platos principales para poder exigir que elija uno.
          </p>
        ) : !groupMenuEnabled ? (
          <p className="bo-mutedText" data-testid="menu-crear-special-principales-required-hint">
            Activa «Puede usarse como menú de grupo» para exigir los principales.
          </p>
        ) : (
          <p className="bo-mutedText" data-testid="menu-crear-special-principales-required-state">
            {principalesRequired ? "El comensal debe elegir un plato principal." : "El comensal puede reservar sin elegir plato principal."}
          </p>
        )}
      </div>
    </div>
  );
}
