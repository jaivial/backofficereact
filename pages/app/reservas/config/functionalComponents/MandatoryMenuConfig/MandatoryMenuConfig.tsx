import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info } from "lucide-react";
import { Switch } from "../../../../../../ui/shadcn/Switch";
import { MandatoryMenuSelector } from "../../../../../../ui/widgets/MandatoryMenuSelector";
import { InfoModal } from "../../../../../../ui/overlays/InfoModal";
import type { MandatoryMenuConfigProps } from "./types/mandatoryMenuConfig.types";

export function MandatoryMenuConfig({
  availableMenus,
  selectedMenuIds,
  menuChooseMain,
  mandatoryBooking,
  showMandatoryInfo,
  mandatoryMenuBusy,
  mandatoryMenuStatus,
  onToggle,
  onMenuChange,
  onBookingChange,
  onInfoToggle,
  onInfoClose,
  onSave,
}: MandatoryMenuConfigProps) {
  return (
    <motion.div
      data-ui="mandatory-menus-panel"
      data-testid="reservas-config-mandatory-menus-panel"
      key="config-mandatory-menus"
      className="bo-panel overflow-hidden w-full max-w-[768px] mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div data-slot="panel-head" className="bo-panelHead px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 mx-auto justify-center" data-testid="reservas-config-mandatory-head">
        <div className="flex flex-col sm:items-center sm:justify-between gap-2 mx-auto" data-slot="mandatoryMenuConfig-mx-auto" data-testid="reservas-config-mandatory-head-inner">
          <div data-slot="mandatoryMenuConfig-div" data-testid="reservas-config-mandatory-titles">
            <div data-role="title" className="bo-panelTitle text-base sm:text-lg text-center" data-testid="reservas-config-mandatory-title">Reserva de menús</div>
            <div data-slot="meta" className="bo-panelMeta text-xs sm:text-sm mt-0.5 text-center" data-testid="reservas-config-mandatory-subtitle">
              Los clientes eligen menú antes de confirmar la reserva
            </div>
          </div>
          <div className="flex items-center gap-3 mx-auto" data-ui="mandatory-toggle" data-testid="reservas-config-mandatory-toggle-row">
            <span className={`text-sm font-medium ${mandatoryMenuStatus ? "text-(--bo-accent)" : "text-(--bo-muted)"} transition-colors duration-150`} data-slot="mandatoryMenuConfig-span" data-testid="reservas-config-mandatory-toggle-label">
              {mandatoryMenuStatus ? "Activado" : "Desactivado"}
            </span>
            <Switch
              checked={mandatoryMenuStatus}
              onCheckedChange={onToggle}
              disabled={mandatoryMenuBusy}
              aria-label="Activar menús obligatorios"
              data-ui="mandatory-switch"
              data-testid="reservas-config-mandatory-switch"
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mandatoryMenuStatus && (
          <motion.div
            data-slot="panel-body"
            data-testid="reservas-config-mandatory-body"
            className="bo-panelBody px-4 pb-4 sm:px-6 sm:pb-5"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Info notice */}
            <div data-ui="info-notice" className="mb-4 p-3 rounded-lg bg-(--bo-surface-2) border border-(--bo-border)" data-testid="reservas-config-mandatory-info-notice">
              <div className="flex gap-4 items-center mx-auto !content-center" data-slot="mandatoryMenuConfig-!content-center" data-testid="reservas-config-mandatory-info-row">
                <Info size={16} strokeWidth={1.8} className="text-(--bo-accent) mt-0.5 flex-shrink-0" aria-hidden="true" data-ui="info-icon" />
                <p className="text-xs text-(--bo-muted) leading-relaxed" data-role="info-text" data-testid="reservas-config-mandatory-info-text">
                  Los menús seleccionados aparecerán durante el proceso de reserva. <br data-ui="br" /> Los clientes deberán elegir uno antes de confirmar.
                </p>
              </div>
            </div>

            {/* Menu selector */}
            <div className="mb-4" data-ui="menu-selector-wrapper" data-testid="reservas-config-mandatory-menu-selector">
              <MandatoryMenuSelector
                menus={availableMenus}
                selectedMenuIds={selectedMenuIds}
                menuChooseMain={menuChooseMain}
                onChange={(ids: number[], chooseMain: number[]) => {
                  onMenuChange(ids, chooseMain);
                }}
              />
            </div>

            {/* Booking option */}
            <div className="flex sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-(--bo-surface-2) border border-(--bo-border) w-fit mx-auto flex-row-reverse items-center" data-ui="mandatory-booking-row" data-testid="reservas-config-mandatory-booking-row">
              <label className="bo-checkboxContainer gap-3" data-ui="mandatory-booking-label" data-testid="reservas-config-mandatory-booking-label">
                <input
                  type="checkbox"
                  checked={mandatoryBooking}
                  onChange={(e) => onBookingChange(e.target.checked)}
                  aria-label="Reserva obligatoria"
                  data-ui="mandatory-booking-checkbox"
                  data-testid="reservas-config-mandatory-booking-checkbox"
                />
                <span className="bo-checkboxMark" aria-hidden="true" data-ui="mandatory-booking-checkbox-mark" data-testid="reservas-config-mandatory-booking-checkbox-mark" />
                <div data-slot="booking-label-text" data-testid="reservas-config-mandatory-booking-text">
                  <span className="text-sm font-medium text-(--bo-text) block" data-role="booking-title" data-testid="reservas-config-mandatory-booking-title">Reserva obligatoria</span>
                  <span className="text-xs text-(--bo-muted)" data-role="booking-desc" data-testid="reservas-config-mandatory-booking-desc">El cliente debe seleccionar menú para continuar</span>
                </div>
              </label>
              <button
                type="button"
                className="bo-btn bo-btn--ghost bo-btn--icon p-2 text-(--bo-muted) hover:text-(--bo-accent) transition-colors duration-150 self-start sm:self-center"
                onClick={onInfoToggle}
                aria-label="Más información"
                data-ui="mandatory-info-btn"
                data-testid="reservas-config-mandatory-info-btn"
              >
                <Info size={16} strokeWidth={1.8} aria-hidden="true" data-ui="info-btn-icon" />
              </button>
            </div>

            {/* Save button */}
            <div className="flex justify-center mt-4" data-ui="mandatory-save" data-testid="reservas-config-mandatory-save-row">
              <button
                type="button"
                className="bo-btn primary w-full sm:w-auto px-8"
                onClick={() => void onSave()}
                disabled={mandatoryMenuBusy || selectedMenuIds.length === 0}
                data-ui="save-mandatory-btn"
                data-testid="reservas-config-mandatory-save-btn"
              >
                {mandatoryMenuBusy ? (
                  <span className="flex items-center gap-2" data-ui="saving-indicator" data-testid="reservas-config-mandatory-saving">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" data-ui="spinner" />
                    <span data-role="saving-text" data-testid="reservas-config-mandatory-saving-text">Guardando...</span>
                  </span>
                ) : (
                  <span data-role="save-btn-text" data-testid="reservas-config-mandatory-save-btn-text">Guardar configuración</span>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InfoModal
        open={showMandatoryInfo}
        title="Reserva obligatoria"
        content="Si se selecciona reserva obligatoria, los clientes deben seleccionar un menú para poder avanzar con su reserva. Si no se selecciona la casilla, los menús serán mostrados durante el proceso de reserva, pero el cliente puede continuar sin seleccionar uno."
        onClose={onInfoClose}
      />
    </motion.div>
  );
}
