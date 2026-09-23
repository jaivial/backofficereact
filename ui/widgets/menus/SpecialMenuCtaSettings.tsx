import React from "react";
import type { SpecialMenuCtaAction, SpecialMenuCtaConfig } from "../../../api/types";
import { AutosaveInput } from "../../inputs/AutosaveInput";
import { PhoneInput } from "../../inputs/PhoneInput";
import { Select } from "../../inputs/Select";
import { splitStoredPhone } from "../../lib/phone";
import { Switch } from "../../shadcn/Switch";

export type SpecialMenuCtaOption = { value: string; label: string };

const ACTION_OPTIONS: Array<{ value: SpecialMenuCtaAction; label: string }> = [
  { value: "menu", label: "Pagina de menu" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "reservas", label: "Pagina de reserva" },
];

/**
 * "Mostrar boton reservar" settings for a special menu.
 *
 * Presentational only: the caller owns the config and persistence and passes
 * the menu / special-date options it already loaded. Each action reveals only
 * the fields it needs (menu picker, WhatsApp phone + message, reservas date).
 *
 * Coordination id: special_menu_cta_v1
 */
export function SpecialMenuCtaSettings({
  config,
  busy,
  menuOptions,
  specialDateOptions,
  onChange,
}: {
  config: SpecialMenuCtaConfig;
  busy: boolean;
  menuOptions: SpecialMenuCtaOption[];
  specialDateOptions: SpecialMenuCtaOption[];
  onChange: (patch: Partial<SpecialMenuCtaConfig>) => void;
}) {
  const phone = splitStoredPhone(config.whatsapp_phone);
  return (
    <div className="bo-field bo-field--full bo-specialCtaSettings" data-coordination-id="special_menu_cta_v1" data-testid="menu-crear-special-cta-settings">
      <div className="bo-field bo-field--inline" data-slot="special-cta-toggle-row">
        <div className="bo-label" data-slot="special-cta-toggle-label">Mostrar boton reservar</div>
        <Switch checked={config.enabled} disabled={busy} onCheckedChange={(enabled) => onChange({ enabled })} data-testid="menu-crear-special-cta-switch" />
      </div>
      {config.enabled ? (
        <div className="bo-stackFields bo-specialCtaFields" data-testid="menu-crear-special-cta-fields">
          <div className="bo-field" data-slot="special-cta-label-field">
            <div className="bo-label" data-slot="special-cta-label-label">Texto del boton</div>
            <AutosaveInput className="bo-input" value={config.label} placeholder="RESERVAR" onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ label: e.target.value })} data-testid="menu-crear-special-cta-label-input" />
          </div>
          <div className="bo-field" data-slot="special-cta-action-field">
            <div className="bo-label" data-slot="special-cta-action-label">Accion del boton</div>
            <Select className="bo-menuSettingSelect" value={config.action} onChange={(value) => onChange({ action: value as SpecialMenuCtaAction })} options={ACTION_OPTIONS} size="sm" ariaLabel="Accion del boton reservar" disabled={busy} data-testid="menu-crear-special-cta-action-select" />
          </div>
          {config.action === "menu" ? (
            <div className="bo-field" data-slot="special-cta-menu-field">
              <div className="bo-label" data-slot="special-cta-menu-label">Menu de destino</div>
              <Select className="bo-menuSettingSelect" value={String(config.menu_id || "")} onChange={(value) => onChange({ menu_id: Number(value) || 0 })} options={menuOptions} placeholder="Selecciona un menu" size="sm" ariaLabel="Menu de destino del boton" disabled={busy} data-testid="menu-crear-special-cta-menu-select" />
            </div>
          ) : null}
          {config.action === "whatsapp" ? (
            <>
              <div className="bo-field" data-slot="special-cta-whatsapp-field">
                <div className="bo-label" data-slot="special-cta-whatsapp-label">WhatsApp</div>
                <PhoneInput
                  countryCode={phone.countryCode}
                  number={phone.national}
                  onCountryCodeChange={(cc) => onChange({ whatsapp_phone: phone.national ? `${cc}${phone.national}` : "" })}
                  onNumberChange={(national) => onChange({ whatsapp_phone: national.replace(/\D/g, "") ? `${phone.countryCode}${national.replace(/\D/g, "")}` : "" })}
                  disabled={busy}
                  numberAriaLabel="Telefono de WhatsApp del boton"
                />
              </div>
              <div className="bo-field bo-field--full" data-slot="special-cta-message-field">
                <div className="bo-label" data-slot="special-cta-message-label">Mensaje de WhatsApp</div>
                <AutosaveInput multiline rows={3} className="bo-input bo-textarea" value={config.whatsapp_message} placeholder="Hola, quiero reservar el menu especial..." onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ whatsapp_message: e.target.value })} data-testid="menu-crear-special-cta-message-textarea" />
              </div>
            </>
          ) : null}
          {config.action === "reservas" && specialDateOptions.length > 0 ? (
            <div className="bo-field" data-slot="special-cta-date-field">
              <div className="bo-label" data-slot="special-cta-date-label">Fecha de reserva</div>
              <Select
                className="bo-menuSettingSelect"
                value={String(config.special_date_id || 0)}
                onChange={(value) => onChange({ special_date_id: Number(value) || 0 })}
                options={[{ value: "0", label: "Pagina de reservas por defecto" }, ...specialDateOptions]}
                size="sm"
                ariaLabel="Fecha de reserva del boton"
                disabled={busy}
                data-testid="menu-crear-special-cta-date-select"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
