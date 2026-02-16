import React, { useCallback, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { RestaurantBranding, RestaurantIntegrations } from "../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Select } from "../../../ui/inputs/Select";

const EVENT_OPTIONS = [
  { value: "booking.created", label: "booking.created" },
  { value: "booking.confirmed", label: "booking.confirmed" },
  { value: "booking.cancelled", label: "booking.cancelled" },
] as const;

function defaultIntegrations(): RestaurantIntegrations {
  return {
    n8nWebhookUrl: "",
    enabledEvents: [],
    uazapiUrl: "",
    uazapiToken: "",
    restaurantWhatsappNumbers: [],
  };
}

function defaultBranding(): RestaurantBranding {
  return {
    brandName: "",
    logoUrl: "",
    primaryColor: "",
    accentColor: "",
    emailFromName: "",
    emailFromAddress: "",
  };
}

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

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);

  const [integrations, setIntegrations] = useState<RestaurantIntegrations>(() => data.integrations ?? defaultIntegrations());
  const [branding, setBranding] = useState<RestaurantBranding>(() => data.branding ?? defaultBranding());
  const [eventsMode, setEventsMode] = useState<"all" | "custom">(() => (integrations.enabledEvents.length ? "custom" : "all"));
  const [recipientsText, setRecipientsText] = useState(() => joinRecipients(integrations.restaurantWhatsappNumbers));
  useErrorToast(error);

  const eventsModeOptions = useMemo(
    () => [
      { value: "all", label: "Todos" },
      { value: "custom", label: "Personalizado" },
    ],
    [],
  );

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([api.settings.getIntegrations(), api.settings.getBranding()]);
      if (!a.success) throw new Error(a.message || "Error cargando integraciones");
      if (!b.success) throw new Error(b.message || "Error cargando branding");

      setIntegrations(a.integrations);
      setBranding(b.branding);
      setEventsMode(a.integrations.enabledEvents.length ? "custom" : "all");
      setRecipientsText(joinRecipients(a.integrations.restaurantWhatsappNumbers));
      pushToast({ kind: "success", title: "Actualizado" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error recargando");
    } finally {
      setBusy(false);
    }
  }, [api, pushToast]);

  const onEventsModeChange = useCallback((v: string) => {
    const mode = v === "custom" ? "custom" : "all";
    setEventsMode(mode);
    setIntegrations((prev) => {
      if (mode === "all") return { ...prev, enabledEvents: [] };
      if (prev.enabledEvents.length === 0) return { ...prev, enabledEvents: EVENT_OPTIONS.map((e) => e.value) };
      return prev;
    });
  }, []);

  const toggleEvent = useCallback(
    (evName: string) => {
      if (eventsMode !== "custom") return;
      setIntegrations((prev) => {
        const set = new Set(prev.enabledEvents);
        if (set.has(evName)) {
          if (set.size === 1) return prev; // avoid empty allowlist (empty means "all enabled" in backend)
          set.delete(evName);
        } else {
          set.add(evName);
        }
        const next = [...set];
        return { ...prev, enabledEvents: next };
      });
    },
    [eventsMode],
  );

  const saveIntegrations = useCallback(async () => {
    if (eventsMode === "custom" && integrations.enabledEvents.length === 0) {
      pushToast({ kind: "error", title: "Error", message: "Selecciona al menos 1 evento (en modo personalizado)" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: RestaurantIntegrations = {
        ...integrations,
        enabledEvents: eventsMode === "all" ? [] : integrations.enabledEvents,
        restaurantWhatsappNumbers: parseRecipientsText(recipientsText),
      };
      const res = await api.settings.setIntegrations(payload);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
        return;
      }
      setIntegrations(res.integrations);
      setEventsMode(res.integrations.enabledEvents.length ? "custom" : "all");
      setRecipientsText(joinRecipients(res.integrations.restaurantWhatsappNumbers));
      pushToast({ kind: "success", title: "Guardado", message: "Integraciones actualizadas" });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      setBusy(false);
    }
  }, [api, eventsMode, integrations, pushToast, recipientsText]);

  const saveBranding = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.settings.setBranding(branding);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
        return;
      }
      setBranding(res.branding);
      pushToast({ kind: "success", title: "Guardado", message: "Branding actualizado" });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      setBusy(false);
    }
  }, [api, branding, pushToast]);

  const primary = branding.primaryColor?.trim() || "transparent";
  const accent = branding.accentColor?.trim() || "transparent";

  return (
    <section aria-label="Ajustes">
      <div className="bo-toolbar">
        <div className="bo-toolbarLeft">
          <button className="bo-btn bo-btn--ghost" type="button" onClick={reload} disabled={busy}>
            Recargar
          </button>
        </div>
        <div className="bo-toolbarRight">
          <div className="bo-mutedText">{busy ? "Guardando..." : ""}</div>
        </div>
      </div>

      <div className="bo-stack">
        <div className="bo-panel" aria-label="Integraciones">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Integraciones</div>
            <div className="bo-panelMeta">n8n, eventos y WhatsApp</div>
          </div>
          <div className="bo-panelBody">
            <div className="bo-stack">
              <label className="bo-field">
                <div className="bo-label">n8n Webhook URL</div>
                <input
                  className="bo-input"
                  value={integrations.n8nWebhookUrl}
                  placeholder="https://.../webhook/..."
                  onChange={(e) => setIntegrations((p) => ({ ...p, n8nWebhookUrl: e.target.value }))}
                />
              </label>

              <div className="bo-field">
                <div className="bo-label">Eventos</div>
                <div className="bo-row">
                  <Select value={eventsMode} onChange={onEventsModeChange} options={eventsModeOptions} size="sm" ariaLabel="Modo eventos" />
                  <div className="bo-mutedText">{eventsMode === "all" ? "Se envían todos los eventos" : "Selecciona eventos a enviar"}</div>
                </div>
                {eventsMode === "custom" ? (
                  <div className="bo-chips" aria-label="Eventos habilitados">
                    {EVENT_OPTIONS.map((ev) => {
                      const on = integrations.enabledEvents.includes(ev.value);
                      return (
                        <button
                          key={ev.value}
                          type="button"
                          className={`bo-chip${on ? " is-on" : ""}`}
                          onClick={() => toggleEvent(ev.value)}
                        >
                          {ev.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {eventsMode === "custom" ? <div className="bo-mutedText">En modo personalizado debes dejar al menos 1 evento.</div> : null}
              </div>

              <label className="bo-field">
                <div className="bo-label">UAZAPI URL</div>
                <input
                  className="bo-input"
                  value={integrations.uazapiUrl}
                  placeholder="https://...uazapi.com"
                  onChange={(e) => setIntegrations((p) => ({ ...p, uazapiUrl: e.target.value }))}
                />
              </label>

              <label className="bo-field">
                <div className="bo-label">UAZAPI Token</div>
                <input
                  className="bo-input"
                  value={integrations.uazapiToken}
                  placeholder="token"
                  onChange={(e) => setIntegrations((p) => ({ ...p, uazapiToken: e.target.value }))}
                />
              </label>

              <label className="bo-field">
                <div className="bo-label">Números WhatsApp del restaurante</div>
                <textarea
                  className="bo-input bo-textarea"
                  value={recipientsText}
                  placeholder={"Uno por línea. Ej:\n34692747052\n34638857294"}
                  onChange={(e) => setRecipientsText(e.target.value)}
                />
                <div className="bo-mutedText">Se usan para notificar al restaurante (confirmaciones, cancelaciones, modificaciones).</div>
              </label>

              <div className="bo-row">
                <button className="bo-btn bo-btn--primary" type="button" onClick={saveIntegrations} disabled={busy}>
                  Guardar integraciones
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bo-panel" aria-label="Branding">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Branding</div>
            <div className="bo-panelMeta">Nombre, logo y emails</div>
          </div>
          <div className="bo-panelBody">
            <div className="bo-stack">
              <label className="bo-field">
                <div className="bo-label">Nombre de marca</div>
                <input
                  className="bo-input"
                  value={branding.brandName}
                  onChange={(e) => setBranding((p) => ({ ...p, brandName: e.target.value }))}
                />
              </label>

              <label className="bo-field">
                <div className="bo-label">Logo URL</div>
                <input className="bo-input" value={branding.logoUrl} onChange={(e) => setBranding((p) => ({ ...p, logoUrl: e.target.value }))} />
              </label>

              <div className="bo-row">
                <label className="bo-field" style={{ flex: 1, minWidth: 240 }}>
                  <div className="bo-label">Color primario</div>
                  <div className="bo-row">
                    <input className="bo-input bo-input--sm" value={branding.primaryColor} onChange={(e) => setBranding((p) => ({ ...p, primaryColor: e.target.value }))} />
                    <div className="bo-pill" style={{ width: 14, height: 14, background: primary, borderColor: "var(--bo-border)" }} aria-label="Preview color primario" />
                  </div>
                </label>

                <label className="bo-field" style={{ flex: 1, minWidth: 240 }}>
                  <div className="bo-label">Color acento</div>
                  <div className="bo-row">
                    <input className="bo-input bo-input--sm" value={branding.accentColor} onChange={(e) => setBranding((p) => ({ ...p, accentColor: e.target.value }))} />
                    <div className="bo-pill" style={{ width: 14, height: 14, background: accent, borderColor: "var(--bo-border)" }} aria-label="Preview color acento" />
                  </div>
                </label>
              </div>

              <label className="bo-field">
                <div className="bo-label">Email From Name</div>
                <input
                  className="bo-input"
                  value={branding.emailFromName}
                  onChange={(e) => setBranding((p) => ({ ...p, emailFromName: e.target.value }))}
                />
              </label>

              <label className="bo-field">
                <div className="bo-label">Email From Address</div>
                <input
                  className="bo-input"
                  value={branding.emailFromAddress}
                  onChange={(e) => setBranding((p) => ({ ...p, emailFromAddress: e.target.value }))}
                />
              </label>

              <div className="bo-row">
                <button className="bo-btn bo-btn--primary" type="button" onClick={saveBranding} disabled={busy}>
                  Guardar branding
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
