import React, { useEffect, useMemo } from "react";

import { Panel } from "../../../../../ui/shell/Panel";
import { Select } from "../../../../../ui/inputs/Select";
import { SwitchField } from "../../../../../ui/inputs/SwitchField";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { BOOKING_NOTIF_COORDINATION_ID, useBookingNotifications } from "./hooks/useBookingNotifications";

const MIN_DAYS_BEFORE = 1;
const MAX_DAYS_BEFORE = 14;

/**
 * WhatsApp booking notification settings. Rendered only while the WhatsApp bot
 * is paired, since every message here travels through that gateway.
 * Coordination id `bkg-wa-notif` matches the backend routes and log points.
 */
export function BookingNotifications({ connected }: { connected: boolean }) {
  const { settings, dirty, saving, setField, load, save } = useBookingNotifications();
  const { pushToast } = useToasts();

  useEffect(() => {
    if (connected) void load();
  }, [connected, load]);

  const dayOptions = useMemo(
    () =>
      Array.from({ length: MAX_DAYS_BEFORE - MIN_DAYS_BEFORE + 1 }, (_, i) => {
        const day = MIN_DAYS_BEFORE + i;
        return { value: String(day), label: day === 1 ? "1 día antes" : `${day} días antes` };
      }),
    [],
  );

  if (!connected) return null;

  const onSave = async () => {
    const ok = await save();
    pushToast(
      ok
        ? { kind: "success", title: "Guardado", message: "Notificaciones de reserva actualizadas" }
        : { kind: "error", title: "Error", message: "No se pudieron guardar las notificaciones" },
    );
  };

  return (
    <Panel
      title="Notificaciones de reserva"
      meta="Mensajes de WhatsApp enviados a los clientes"
      bodyClassName="bo-stack"
      data-ui="config-booking-notif-panel"
      data-slot="config-booking-notif-panel"
      data-coordination-id={BOOKING_NOTIF_COORDINATION_ID}
      data-testid="config-booking-notif-panel"
    >
      <SwitchField
        checked={settings.sendConfirmation}
        onChange={(next) => setField("sendConfirmation", next)}
        label="Enviar mensaje de confirmación"
        description="Al crear una reserva desde la web o desde el backoffice, se envía el WhatsApp de confirmación al cliente."
        disabled={saving}
        data-testid="config-booking-notif-confirmation-switch"
      />

      <SwitchField
        checked={settings.sendReconfirmation}
        onChange={(next) => setField("sendReconfirmation", next)}
        label="Enviar mensaje de reconfirmación"
        description="Recordatorio con botón de confirmación enviado antes del día de la reserva."
        disabled={saving}
        data-testid="config-booking-notif-reconfirmation-switch"
      />

      {settings.sendReconfirmation ? (
        <div className="bo-field" data-slot="config-booking-notif-days-field" data-testid="config-booking-notif-days-field">
          <label className="bo-label" data-slot="config-booking-notif-days-label">
            Días de antelación
          </label>
          <Select
            value={String(settings.reconfirmationDaysBefore)}
            onChange={(value) => setField("reconfirmationDaysBefore", Number(value))}
            options={dayOptions}
            ariaLabel="Días antes de la reserva para enviar el recordatorio"
            disabled={saving}
            data-testid="config-booking-notif-days-before-select"
          />
        </div>
      ) : null}

      <div className="bo-sectionSaveRow" data-slot="config-booking-notif-save-row">
        {dirty ? (
          <button
            type="button"
            className="bo-brandingSaveBtn"
            onClick={() => void onSave()}
            disabled={saving}
            aria-label="Guardar notificaciones de reserva"
            data-testid="config-booking-notif-save-btn"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        ) : null}
      </div>
    </Panel>
  );
}
