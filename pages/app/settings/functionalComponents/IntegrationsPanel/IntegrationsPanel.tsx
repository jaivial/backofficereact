import React, { useCallback, useMemo, useState } from "react";
import { Select } from "../../../../../ui/inputs/Select";
import type { RestaurantIntegrations } from "../../../../../api/types";

const EVENT_OPTIONS = [
  { value: "booking.created", label: "booking.created" },
  { value: "booking.confirmed", label: "booking.confirmed" },
  { value: "booking.cancelled", label: "booking.cancelled" },
] as const;

function parseRecipientsText(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    let n = p.replace(/[^\d]/g, "");
    if (!n) continue;
    if (n.length === 9) n = "34" + n;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function joinRecipients(list: string[] | undefined | null): string {
  return (list ?? []).join("\n");
}

interface IntegrationsPanelProps {
  integrations: RestaurantIntegrations;
  busy: boolean;
  onIntegrationsChange: React.Dispatch<React.SetStateAction<RestaurantIntegrations>>;
  onSave: () => Promise<void>;
}

export function IntegrationsPanel({ integrations, busy, onIntegrationsChange, onSave }: IntegrationsPanelProps) {
  const [eventsMode, setEventsMode] = useState<"all" | "custom">(
    () => (integrations.enabledEvents.length ? "custom" : "all"),
  );
  const [recipientsText, setRecipientsText] = useState(() => joinRecipients(integrations.restaurantWhatsappNumbers));

  const eventsModeOptions = useMemo(
    () => [
      { value: "all", label: "Todos" },
      { value: "custom", label: "Personalizado" },
    ],
    [],
  );

  const onEventsModeChange = useCallback((v: string) => {
    const mode = v === "custom" ? "custom" : "all";
    setEventsMode(mode);
    onIntegrationsChange((prev) => {
      if (mode === "all") return { ...prev, enabledEvents: [] };
      if (prev.enabledEvents.length === 0) return { ...prev, enabledEvents: EVENT_OPTIONS.map((e) => e.value) };
      return prev;
    });
  }, [onIntegrationsChange]);

  const toggleEvent = useCallback(
    (evName: string) => {
      if (eventsMode !== "custom") return;
      onIntegrationsChange((prev) => {
        const set = new Set(prev.enabledEvents);
        if (set.has(evName)) {
          if (set.size === 1) return prev;
          set.delete(evName);
        } else {
          set.add(evName);
        }
        const next = [...set];
        return { ...prev, enabledEvents: next };
      });
    },
    [eventsMode, onIntegrationsChange],
  );

  const handleSave = useCallback(async () => {
    onIntegrationsChange((prev) => ({
      ...prev,
      restaurantWhatsappNumbers: parseRecipientsText(recipientsText),
    }));
    await onSave();
  }, [recipientsText, onIntegrationsChange, onSave]);

  return (
    <div className="bo-panel" aria-label="Integraciones" data-ui="integrations-panel">
      <div className="bo-panelHead" data-slot="panelHead">
        <div className="bo-panelTitle" data-ui="panelTitle">Integraciones</div>
        <div className="bo-panelMeta" data-ui="panelMeta">n8n, eventos y WhatsApp</div>
      </div>
      <div className="bo-panelBody" data-slot="panelBody">
        <div className="bo-stack" data-slot="integrationsPanel-stack">
          <label className="bo-field" data-ui="n8nField">
            <div className="bo-label" data-slot="fieldLabel">n8n Webhook URL</div>
            <input
              className="bo-input"
              value={integrations.n8nWebhookUrl}
              placeholder="https://.../webhook/..."
              onChange={(e) => onIntegrationsChange((p) => ({ ...p, n8nWebhookUrl: e.target.value }))}
              data-slot="fieldInput"
            />
          </label>

          <div className="bo-field" data-ui="eventsField">
            <div className="bo-label" data-slot="fieldLabel">Eventos</div>
            <div className="bo-row" data-slot="fieldRow">
              <Select value={eventsMode} onChange={onEventsModeChange} options={eventsModeOptions} size="sm" ariaLabel="Modo eventos" data-slot="eventsSelect" />
              <div className="bo-mutedText" data-slot="eventsHint">
                {eventsMode === "all" ? "Se envian todos los eventos" : "Selecciona eventos a enviar"}
              </div>
            </div>
            {eventsMode === "custom" ? (
              <div className="bo-chips" aria-label="Eventos habilitados" data-slot="eventChips">
                {EVENT_OPTIONS.map((ev) => {
                  const on = integrations.enabledEvents.includes(ev.value);
                  return (
                    <button
                      key={ev.value}
                      type="button"
                      className={`bo-chip${on ? " is-on" : ""}`}
                      onClick={() => toggleEvent(ev.value)}
                      data-slot="eventChip"
                    >
                      {ev.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {eventsMode === "custom" ? (
              <div className="bo-mutedText" data-slot="eventsWarning">En modo personalizado debes dejar al menos 1 evento.</div>
            ) : null}
          </div>

          <label className="bo-field" data-ui="uazapiUrlField">
            <div className="bo-label" data-slot="fieldLabel">UAZAPI URL</div>
            <input
              className="bo-input"
              value={integrations.uazapiUrl}
              placeholder="https://...uazapi.com"
              onChange={(e) => onIntegrationsChange((p) => ({ ...p, uazapiUrl: e.target.value }))}
              data-slot="fieldInput"
            />
          </label>

          <label className="bo-field" data-ui="uazapiTokenField">
            <div className="bo-label" data-slot="fieldLabel">UAZAPI Token</div>
            <input
              className="bo-input"
              value={integrations.uazapiToken}
              placeholder="token"
              onChange={(e) => onIntegrationsChange((p) => ({ ...p, uazapiToken: e.target.value }))}
              data-slot="fieldInput"
            />
          </label>

          <label className="bo-field" data-ui="whatsappField">
            <div className="bo-label" data-slot="fieldLabel">Numeros WhatsApp del restaurante</div>
            <textarea
              className="bo-input bo-textarea"
              value={recipientsText}
              placeholder={"Uno por linea. Ej:\n34692747052\n34638857294"}
              onChange={(e) => setRecipientsText(e.target.value)}
              data-slot="fieldInput"
            />
            <div className="bo-mutedText" data-slot="fieldHint">
              Se usan para notificar al restaurante (confirmaciones, cancelaciones, modificaciones).
            </div>
          </label>

          <div className="bo-row" data-slot="actions">
            <button className="bo-btn bo-btn--primary" type="button" onClick={handleSave} disabled={busy} data-role="saveBtn">
              Guardar integraciones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
