import React from "react";
import { Select } from "../../inputs/Select";

const YES_NO_OPTIONS = [
  { value: "1", label: "Sí" },
  { value: "0", label: "No" },
];

/**
 * Group-booking settings for a special menu.
 *
 * Two Si/No dropdowns: whether the special menu is offered as a group menu in
 * the booking wizard, and whether guests must pick their principales. Both
 * only make sense with "Añadir platos principales" on, so each one is
 * disabled (with a muted hint) until its prerequisite is met.
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
  /** "Añadir platos principales" is on for this menu. */
  principalesAvailable: boolean;
  busy: boolean;
  onChangeGroupMenuEnabled: (enabled: boolean) => void;
  onChangePrincipalesRequired: (required: boolean) => void;
}) {
  const groupMenuDisabled = busy || !principalesAvailable;
  const principalesRequiredDisabled = busy || !groupMenuEnabled;
  return (
    <div className="bo-field bo-field--full bo-stackFields" data-coordination-id="special_menu_group_booking_v1" data-testid="menu-crear-special-group-booking">
      <div className="bo-field" data-slot="special-group-booking-field">
        <div className="bo-label" data-slot="special-group-booking-label" data-testid="menu-crear-special-group-booking-label">Puede usarse como menú de grupo</div>
        <Select
          className="bo-menuSettingSelect"
          value={groupMenuEnabled ? "1" : "0"}
          onChange={(value) => onChangeGroupMenuEnabled(value === "1")}
          options={YES_NO_OPTIONS}
          size="sm"
          ariaLabel="Puede usarse como menú de grupo"
          disabled={groupMenuDisabled}
          data-testid="menu-crear-special-group-booking-select"
        />
        {!principalesAvailable ? (
          <p className="bo-mutedText" data-testid="menu-crear-special-group-booking-hint">Activa «Añadir platos principales» para poder ofrecerlo como menú de grupo</p>
        ) : null}
      </div>
      <div className="bo-field" data-slot="special-group-booking-required-field">
        <div className="bo-label" data-slot="special-group-booking-required-label" data-testid="menu-crear-special-principales-required-label">Plato principal obligatorio</div>
        <Select
          className="bo-menuSettingSelect"
          value={principalesRequired ? "1" : "0"}
          onChange={(value) => onChangePrincipalesRequired(value === "1")}
          options={YES_NO_OPTIONS}
          size="sm"
          ariaLabel="Plato principal obligatorio"
          disabled={principalesRequiredDisabled}
          data-testid="menu-crear-special-principales-required-select"
        />
        {!groupMenuEnabled ? (
          <p className="bo-mutedText" data-testid="menu-crear-special-principales-required-hint">Activa «Puede usarse como menú de grupo» para exigir los principales.</p>
        ) : null}
      </div>
    </div>
  );
}
