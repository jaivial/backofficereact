import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type {
  RestaurantBranding,
  RestaurantIntegrations,
  RestaurantInvoiceSettings,
  InvoiceNumberFormat,
  PdfTemplateType,
  InvoiceRenumberPreview,
  InvoiceRenumberAudit,
  MenuTemplateType,
  RestaurantWebsiteMenuTemplatesConfig,
} from "../../../api/types";
import { PDF_TEMPLATE_OPTIONS } from "../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Select } from "../../../ui/inputs/Select";
import { ConfirmDialog } from "../../../ui/overlays/ConfirmDialog";

const EVENT_OPTIONS = [
  { value: "booking.created", label: "booking.created" },
  { value: "booking.confirmed", label: "booking.confirmed" },
  { value: "booking.cancelled", label: "booking.cancelled" },
] as const;

const MENU_TYPE_OPTIONS: { value: MenuTemplateType; label: string }[] = [
  { value: "closed_conventional", label: "Menu cerrado convencional" },
  { value: "a_la_carte", label: "Menu carta convencional" },
  { value: "closed_group", label: "Menu cerrado grupo" },
  { value: "a_la_carte_group", label: "Menu carta grupo" },
  { value: "special", label: "Menu especial" },
];

function defaultWebsiteMenuTemplates(): RestaurantWebsiteMenuTemplatesConfig {
  return {
    default_theme_id: "villa-carmen",
    overrides: {},
    themes: [
      { id: "villa-carmen", name: "Villa Carmen", active: true },
      { id: "lumen-gold", name: "Lumen Gold", active: true },
      { id: "terra-olive", name: "Terra Olive", active: true },
      { id: "nocturne-copper", name: "Nocturne Copper", active: true },
      { id: "sea-breeze", name: "Sea Breeze", active: true },
    ],
  };
}

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

function defaultInvoiceSettings(): RestaurantInvoiceSettings {
  return {
    format: {
      prefix: "F-",
      suffix: "",
      startingNumber: 1,
      format: "F-{YYYY}-{0001}",
      paddingZeros: 4,
    },
    nextNumber: 1,
    defaultPdfTemplate: "basic",
  };
}

function defaultInvoiceFormat(): InvoiceNumberFormat {
  return {
    prefix: "F-",
    suffix: "",
    startingNumber: 1,
    format: "F-{YYYY}-{0001}",
    paddingZeros: 4,
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
  const [invoiceSettings, setInvoiceSettings] = useState<RestaurantInvoiceSettings>(() => data.invoiceSettings ?? defaultInvoiceSettings());
  const [websiteMenuTemplates, setWebsiteMenuTemplates] = useState<RestaurantWebsiteMenuTemplatesConfig>(
    () => data.websiteMenuTemplates ?? defaultWebsiteMenuTemplates(),
  );
  const [websiteTemplateUsePerType, setWebsiteTemplateUsePerType] = useState<boolean>(
    () => Object.keys((data.websiteMenuTemplates?.overrides || {})).length > 0,
  );
  const [eventsMode, setEventsMode] = useState<"all" | "custom">(() => (integrations.enabledEvents.length ? "custom" : "all"));
  const [recipientsText, setRecipientsText] = useState(() => joinRecipients(integrations.restaurantWhatsappNumbers));

  // Renumbering state
  const [renumberStartingNumber, setRenumberStartingNumber] = useState(invoiceSettings.nextNumber);
  const [renumberGenerateByDate, setRenumberGenerateByDate] = useState(false);
  const [renumberDateFormat, setRenumberDateFormat] = useState("YYYY");
  const [renumberPreview, setRenumberPreview] = useState<InvoiceRenumberPreview[] | null>(null);
  const [renumberHistory, setRenumberHistory] = useState<InvoiceRenumberAudit[]>([]);
  const [renumberLoading, setRenumberLoading] = useState(false);
  const [showConfirmApply, setShowConfirmApply] = useState(false);

  useErrorToast(error);

  // Load renumber history on mount
  useEffect(() => {
    loadRenumberHistory();
  }, []);

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
      const [a, b, c, d] = await Promise.all([
        api.settings.getIntegrations(),
        api.settings.getBranding(),
        api.settings.getInvoiceSettings(),
        api.settings.getWebsiteMenuTemplates(),
      ]);
      if (!a.success) throw new Error(a.message || "Error cargando integraciones");
      if (!b.success) throw new Error(b.message || "Error cargando branding");
      if (!c.success) throw new Error(c.message || "Error cargando configuracion de facturas");
      if (!d.success) throw new Error(d.message || "Error cargando pagina web");

      setIntegrations(a.integrations);
      setBranding(b.branding);
      setInvoiceSettings(c.settings);
      setWebsiteMenuTemplates(d);
      setWebsiteTemplateUsePerType(Object.keys(d.overrides || {}).length > 0);
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

  const saveInvoiceSettings = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.settings.setInvoiceSettings(invoiceSettings);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
        return;
      }
      setInvoiceSettings(res.settings);
      pushToast({ kind: "success", title: "Guardado", message: "Configuracion de facturas actualizada" });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      setBusy(false);
    }
  }, [api, invoiceSettings, pushToast]);

  const saveWebsiteMenuTemplates = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const overrides = websiteTemplateUsePerType ? websiteMenuTemplates.overrides : {};
      const res = await api.settings.setWebsiteMenuTemplates({
        default_theme_id: websiteMenuTemplates.default_theme_id,
        overrides,
      });
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
        return;
      }
      setWebsiteMenuTemplates({
        default_theme_id: res.default_theme_id,
        overrides: res.overrides || {},
        themes: res.themes || [],
      });
      setWebsiteTemplateUsePerType(Object.keys(res.overrides || {}).length > 0);
      pushToast({ kind: "success", title: "Guardado", message: "Pagina web actualizada" });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      setBusy(false);
    }
  }, [api, pushToast, websiteMenuTemplates, websiteTemplateUsePerType]);

  // Renumbering handlers
  const previewRenumber = useCallback(async () => {
    setRenumberLoading(true);
    setError(null);
    try {
      const res = await api.invoices.previewRenumber({
        startingNumber: renumberStartingNumber,
        generateByDate: renumberGenerateByDate,
        dateFormat: renumberGenerateByDate ? renumberDateFormat : undefined,
      });
      if (!res.success) {
        setRenumberPreview(null);
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo previsualizar" });
        return;
      }
      setRenumberPreview(res.preview || []);
      pushToast({ kind: "success", title: "Previsualizacion lista", message: `${res.preview?.length || 0} facturas seran renumeradas` });
    } catch (e) {
      setRenumberPreview(null);
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo previsualizar" });
    } finally {
      setRenumberLoading(false);
    }
  }, [api, renumberStartingNumber, renumberGenerateByDate, renumberDateFormat, pushToast]);

  const applyRenumber = useCallback(async () => {
    setRenumberLoading(true);
    setError(null);
    try {
      const res = await api.invoices.applyRenumber({
        startingNumber: renumberStartingNumber,
        generateByDate: renumberGenerateByDate,
        dateFormat: renumberGenerateByDate ? renumberDateFormat : undefined,
      });
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo aplicar" });
        return;
      }
      setRenumberPreview(null);
      setShowConfirmApply(false);
      // Update invoice settings with new next number
      const newNextNumber = renumberGenerateByDate
        ? renumberStartingNumber
        : renumberStartingNumber + (res.preview?.length || 0);
      setInvoiceSettings((prev) => ({ ...prev, nextNumber: newNextNumber }));
      // Refresh history
      loadRenumberHistory();
      pushToast({ kind: "success", title: "Renumeracion completada", message: `${res.applied_count} facturas renumeradas` });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo aplicar" });
    } finally {
      setRenumberLoading(false);
    }
  }, [api, renumberStartingNumber, renumberGenerateByDate, renumberDateFormat, pushToast]);

  const loadRenumberHistory = useCallback(async () => {
    try {
      const res = await api.invoices.getRenumberHistory();
      if (res.success) {
        setRenumberHistory(res.audits || []);
      }
    } catch (e) {
      // Silently fail for history loading
      console.error("Failed to load renumber history:", e);
    }
  }, [api]);

  // Preview invoice number format
  const previewInvoiceNumber = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const num = invoiceSettings.nextNumber;
    const paddedNum = String(num).padStart(invoiceSettings.format.paddingZeros, "0");
    const format = invoiceSettings.format.format;

    return format
      .replace("{YYYY}", String(year))
      .replace("{YY}", String(year).slice(-2))
      .replace("{0001}", paddedNum)
      .replace("{000}", paddedNum.slice(-3))
      .replace("{00}", paddedNum.slice(-2))
      .replace("{0}", paddedNum.slice(-1))
      .replace("{N}", String(num))
      .replace("{prefix}", invoiceSettings.format.prefix)
      .replace("{suffix}", invoiceSettings.format.suffix);
  }, [invoiceSettings]);

  const websiteThemeOptions = useMemo(
    () => (websiteMenuTemplates.themes || []).map((theme) => ({ value: theme.id, label: theme.name || theme.id })),
    [websiteMenuTemplates.themes],
  );

  const primary = branding.primaryColor?.trim() || "transparent";
  const accent = branding.accentColor?.trim() || "transparent";

  return (
    <section aria-label="Ajustes">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-transparent text-foreground text-sm font-bold transition-all hover:bg-white/[0.04]" type="button" onClick={reload} disabled={busy}>
            Recargar
          </button>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-mutedText">{busy ? "Guardando..." : ""}</div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-lg bg-card shadow-soft" aria-label="Integraciones">
          <div className="flex items-end justify-between pb-2 px-4 pt-4">
            <div className="text-sm font-bold text-foreground">Integraciones</div>
            <div className="text-xs text-muted-foreground">n8n, eventos y WhatsApp</div>
          </div>
          <div className="p-4">
            <div className="flex flex-col gap-4 p-4">
              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">n8n Webhook URL</div>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  value={integrations.n8nWebhookUrl}
                  placeholder="https://.../webhook/..."
                  onChange={(e) => setIntegrations((p) => ({ ...p, n8nWebhookUrl: e.target.value }))}
                />
              </label>

              <div className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">Eventos</div>
                <div className="flex gap-4">
                  <Select value={eventsMode} onChange={onEventsModeChange} options={eventsModeOptions} size="sm" ariaLabel="Modo eventos" />
                  <div className="text-mutedText">{eventsMode === "all" ? "Se envían todos los eventos" : "Selecciona eventos a enviar"}</div>
                </div>
                {eventsMode === "custom" ? (
                  <div className="rounded-fulls" aria-label="Eventos habilitados">
                    {EVENT_OPTIONS.map((ev) => {
                      const on = integrations.enabledEvents.includes(ev.value);
                      return (
                        <button
                          key={ev.value}
                          type="button"
                          className={`rounded-full${on ? " is-on" : ""}`}
                          onClick={() => toggleEvent(ev.value)}
                        >
                          {ev.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {eventsMode === "custom" ? <div className="text-mutedText">En modo personalizado debes dejar al menos 1 evento.</div> : null}
              </div>

              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">UAZAPI URL</div>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  value={integrations.uazapiUrl}
                  placeholder="https://...uazapi.com"
                  onChange={(e) => setIntegrations((p) => ({ ...p, uazapiUrl: e.target.value }))}
                />
              </label>

              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">UAZAPI Token</div>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  value={integrations.uazapiToken}
                  placeholder="token"
                  onChange={(e) => setIntegrations((p) => ({ ...p, uazapiToken: e.target.value }))}
                />
              </label>

              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">Números WhatsApp del restaurante</div>
                <textarea
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors foregroundarea"
                  value={recipientsText}
                  placeholder={"Uno por línea. Ej:\n34692747052\n34638857294"}
                  onChange={(e) => setRecipientsText(e.target.value)}
                />
                <div className="text-mutedText">Se usan para notificar al restaurante (confirmaciones, cancelaciones, modificaciones).</div>
              </label>

              <div className="flex gap-4">
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto" type="button" onClick={saveIntegrations} disabled={busy}>
                  Guardar integraciones
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card shadow-soft" aria-label="Branding">
          <div className="flex items-end justify-between pb-2 px-4 pt-4">
            <div className="text-sm font-bold text-foreground">Branding</div>
            <div className="text-xs text-muted-foreground">Nombre, logo y emails</div>
          </div>
          <div className="p-4">
            <div className="flex flex-col gap-4 p-4">
              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">Nombre de marca</div>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  value={branding.brandName}
                  onChange={(e) => setBranding((p) => ({ ...p, brandName: e.target.value }))}
                />
              </label>

              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">Logo URL</div>
                <input className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors" value={branding.logoUrl} onChange={(e) => setBranding((p) => ({ ...p, logoUrl: e.target.value }))} />
              </label>

              <div className="flex gap-4">
                <label className="grid gap-2 flex-1">
                  <div className="text-sm font-semibold text-muted-foreground">Color primario</div>
                  <div className="flex gap-4">
                    <input className="h-[34px] rounded-sm border border bg-card-2 text-foreground px-3 outline-none min-w-0 transition-colors" value={branding.primaryColor} onChange={(e) => setBranding((p) => ({ ...p, primaryColor: e.target.value }))} />
                    <div className="w-3.5 h-3.5 rounded-full border border shrink-0" style={{ background: primary }} aria-label="Preview color primario" />
                  </div>
                </label>

                <label className="grid gap-2 flex-1">
                  <div className="text-sm font-semibold text-muted-foreground">Color acento</div>
                  <div className="flex gap-4">
                    <input className="h-[34px] rounded-sm border border bg-card-2 text-foreground px-3 outline-none min-w-0 transition-colors" value={branding.accentColor} onChange={(e) => setBranding((p) => ({ ...p, accentColor: e.target.value }))} />
                    <div className="w-3.5 h-3.5 rounded-full border border shrink-0" style={{ background: accent }} aria-label="Preview color acento" />
                  </div>
                </label>
              </div>

              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">Email From Name</div>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  value={branding.emailFromName}
                  onChange={(e) => setBranding((p) => ({ ...p, emailFromName: e.target.value }))}
                />
              </label>

              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">Email From Address</div>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  value={branding.emailFromAddress}
                  onChange={(e) => setBranding((p) => ({ ...p, emailFromAddress: e.target.value }))}
                />
              </label>

              <div className="flex gap-4">
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={saveBranding} disabled={busy}>
                  Guardar branding
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card shadow-soft" aria-label="Pagina web">
          <div className="flex items-end justify-between pb-2 px-4 pt-4">
            <div className="text-sm font-bold text-foreground">Pagina web</div>
            <div className="text-xs text-muted-foreground">Plantillas premium para menus por tipo</div>
          </div>
          <div className="p-4">
            <div className="flex flex-col gap-4 p-4">
              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">Plantilla por defecto</div>
                <Select
                  value={websiteMenuTemplates.default_theme_id}
                  onChange={(value) => setWebsiteMenuTemplates((prev) => ({ ...prev, default_theme_id: value }))}
                  options={websiteThemeOptions}
                  size="sm"
                  ariaLabel="Plantilla por defecto"
                />
                <div className="text-mutedText">Se aplica a toda la web premium y sirve como fallback para tipos sin override.</div>
              </label>

              <div className="grid gap-2">
                <label className="w-4 h-4 rounded border border bg-background-primary">
                  <input
                    type="checkbox"
                    checked={websiteTemplateUsePerType}
                    onChange={(e) => setWebsiteTemplateUsePerType(e.target.checked)}
                  />
                  <span>Usar plantilla distinta por tipo de menu</span>
                </label>
              </div>

              {websiteTemplateUsePerType ? (
                <div className="flex flex-col gap-4 p-4">
                  {MENU_TYPE_OPTIONS.map((menuTypeOption) => (
                    <label className="grid gap-2" key={menuTypeOption.value}>
                      <div className="text-sm font-semibold text-muted-foreground">{menuTypeOption.label}</div>
                      <Select
                        value={websiteMenuTemplates.overrides[menuTypeOption.value] || websiteMenuTemplates.default_theme_id}
                        onChange={(value) =>
                          setWebsiteMenuTemplates((prev) => ({
                            ...prev,
                            overrides: {
                              ...prev.overrides,
                              [menuTypeOption.value]: value,
                            },
                          }))
                        }
                        options={websiteThemeOptions}
                        size="sm"
                        ariaLabel={`Plantilla para ${menuTypeOption.label}`}
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-4">
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={saveWebsiteMenuTemplates} disabled={busy}>
                  Guardar pagina web
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card shadow-soft" aria-label="Numeracion de facturas">
          <div className="flex items-end justify-between pb-2 px-4 pt-4">
            <div className="text-sm font-bold text-foreground">Numeracion de facturas</div>
            <div className="text-xs text-muted-foreground">Configura el formato de los numeros de factura</div>
          </div>
          <div className="p-4">
            <div className="flex flex-col gap-4 p-4">
              <div className="text-mutedText mb-4">
                Usa los siguientes tokens en el formato: {"{YYYY}"} (año), {"{YY}"} (año corto), {"{0001}"} (numero con ceros), {"{N}"} (numero sin padding), {"{prefix}"} (prefijo), {"{suffix}"} (sufijo)
              </div>

              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">Formato</div>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  value={invoiceSettings.format.format}
                  onChange={(e) => setInvoiceSettings((p) => ({ ...p, format: { ...p.format, format: e.target.value } }))}
                  placeholder="F-{YYYY}-{0001}"
                />
              </label>

              <div className="flex gap-4">
                <label className="grid gap-2 flex-1">
                  <div className="text-sm font-semibold text-muted-foreground">Prefijo</div>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    value={invoiceSettings.format.prefix}
                    onChange={(e) => setInvoiceSettings((p) => ({ ...p, format: { ...p.format, prefix: e.target.value } }))}
                    placeholder="F-"
                  />
                </label>

                <label className="grid gap-2 flex-1">
                  <div className="text-sm font-semibold text-muted-foreground">Sufijo</div>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    value={invoiceSettings.format.suffix}
                    onChange={(e) => setInvoiceSettings((p) => ({ ...p, format: { ...p.format, suffix: e.target.value } }))}
                    placeholder=""
                  />
                </label>
              </div>

              <div className="flex gap-4">
                <label className="grid gap-2 flex-1">
                  <div className="text-sm font-semibold text-muted-foreground">Numero inicial</div>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    type="number"
                    min="1"
                    value={invoiceSettings.format.startingNumber}
                    onChange={(e) => setInvoiceSettings((p) => ({ ...p, format: { ...p.format, startingNumber: parseInt(e.target.value) || 1 } }))}
                  />
                </label>

                <label className="grid gap-2 flex-1">
                  <div className="text-sm font-semibold text-muted-foreground">Digitos de relleno (0001)</div>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    type="number"
                    min="1"
                    max="10"
                    value={invoiceSettings.format.paddingZeros}
                    onChange={(e) => setInvoiceSettings((p) => ({ ...p, format: { ...p.format, paddingZeros: parseInt(e.target.value) || 4 } }))}
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <div className="text-sm font-semibold text-muted-foreground">Proximo numero</div>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  type="number"
                  min="1"
                  value={invoiceSettings.nextNumber}
                  onChange={(e) => setInvoiceSettings((p) => ({ ...p, nextNumber: parseInt(e.target.value) || 1 }))}
                />
                <div className="text-mutedText">El numero que se usara para la siguiente factura</div>
              </label>

              <div className="grid gap-2 bo-panelPreview">
                <div className="text-sm font-semibold text-muted-foreground">Vista previa del siguiente numero de factura</div>
                <div className="text-2xl font-semibold mt-2 font-mono">{previewInvoiceNumber}</div>
              </div>

              <div className="flex gap-4">
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={saveInvoiceSettings} disabled={busy}>
                  Guardar configuracion
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card shadow-soft" aria-label="Renumerar facturas">
          <div className="flex items-end justify-between pb-2 px-4 pt-4">
            <div className="text-sm font-bold text-foreground">Renumerar facturas</div>
            <div className="text-xs text-muted-foreground">Reasigna numeros de factura de forma masiva</div>
          </div>
          <div className="p-4">
            <div className="flex flex-col gap-4 p-4">
              <div className="text-mutedText mb-4">
                Esta herramienta permite renumerar todas las facturas existentes. Se mantendra un registro de auditoria con los cambios realizados. Es recomendable previsualizar antes de aplicar.
              </div>

              <div className="flex gap-4">
                <label className="grid gap-2 flex-1">
                  <div className="text-sm font-semibold text-muted-foreground">Numero inicial</div>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    type="number"
                    min="1"
                    value={renumberStartingNumber}
                    onChange={(e) => setRenumberStartingNumber(parseInt(e.target.value) || 1)}
                  />
                  <div className="text-mutedText">El numero desde el cual comenzar la renumeracion</div>
                </label>
              </div>

              <div className="grid gap-2">
                <label className="w-4 h-4 rounded border border bg-background-primary">
                  <input
                    type="checkbox"
                    checked={renumberGenerateByDate}
                    onChange={(e) => setRenumberGenerateByDate(e.target.checked)}
                  />
                  <span>Generar secuencia basada en fecha</span>
                </label>
                <div className="text-mutedText">Si esta marcado, las facturas se numeraran por ao/mes en lugar de una secuencia continua</div>
              </div>

              {renumberGenerateByDate && (
                <div className="flex gap-4">
                  <label className="grid gap-2 flex-1">
                    <div className="text-sm font-semibold text-muted-foreground">Formato de fecha</div>
                    <Select
                      value={renumberDateFormat}
                      onChange={(v) => setRenumberDateFormat(v)}
                      options={[
                        { value: "YYYY", label: "Anual (F-2026-0001)" },
                        { value: "YYYY-MM", label: "Mensual (F-2026-02-0001)" },
                      ]}
                      size="sm"
                      ariaLabel="Formato de fecha"
                    />
                  </label>
                </div>
              )}

              <div className="flex gap-4 mt-2">
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-card-2 text-foreground text-sm font-bold transition-all hover:border-primary hover:bg-card-2/80 disabled:opacity-55 disabled:cursor-not-allowed"
                  type="button"
                  onClick={previewRenumber}
                  disabled={renumberLoading}
                >
                  {renumberLoading ? "Cargando..." : "Previsualizar cambios"}
                </button>
              </div>

              {renumberPreview && renumberPreview.length > 0 && (
                <div className="grid gap-2 mt-4">
                  <div className="text-sm font-semibold text-muted-foreground">Previsualizacion ({renumberPreview.length} facturas)</div>
                  <div className="max-h-[300px] overflow-y-auto border border rounded-sm mt-2">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th>Factura Actual</th>
                          <th>Nuevo Numero</th>
                          <th>Cliente</th>
                          <th>Fecha</th>
                          <th>Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renumberPreview.slice(0, 50).map((item, idx) => (
                          <tr key={item.invoice_id}>
                            <td>{item.current_number || "-"}</td>
                            <td className="font-semibold">{item.new_number}</td>
                            <td>{item.customer_name}</td>
                            <td>{item.invoice_date}</td>
                            <td>{item.amount.toFixed(2)} EUR</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {renumberPreview.length > 50 && (
                      <div className="text-mutedText text-center p-2">
                        ... y {renumberPreview.length - 50} facturas mas
                      </div>
                    )}
                  </div>
                </div>
              )}

              {renumberPreview && renumberPreview.length > 0 && (
                <div className="flex gap-4 mt-4">
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed"
                    type="button"
                    onClick={() => setShowConfirmApply(true)}
                    disabled={renumberLoading}
                  >
                    Aplicar renumeracion
                  </button>
                </div>
              )}

              <div className="grid gap-2 mt-6">
                <div className="text-sm font-semibold text-muted-foreground">Historial de renumeraciones</div>
                {renumberHistory.length === 0 ? (
                  <div className="text-mutedText mt-2">No hay historial de renumeraciones</div>
                ) : (
                  <div className="bo-auditHistory mt-2">
                    {renumberHistory.map((audit) => (
                      <div key={audit.id} className="bo-auditItem">
                        <div className="font-semibold">
                          {audit.affected_invoices} facturas renumeradas
                        </div>
                        <div className="text-mutedText">
                          Formato: {audit.previous_format} -&gt; {audit.new_format} | Inicio: {audit.starting_number}
                        </div>
                        <div className="text-mutedText">
                          Por: {audit.performed_by_name} | Fecha: {new Date(audit.performed_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card shadow-soft" aria-label="Plantilla de PDF">
          <div className="flex items-end justify-between pb-2 px-4 pt-4">
            <div className="text-sm font-bold text-foreground">Plantilla de PDF</div>
            <div className="text-xs text-muted-foreground">Selecciona el diseño predeterminado para las facturas</div>
          </div>
          <div className="p-4">
            <div className="flex flex-col gap-4 p-4">
              <div className="text-mutedText mb-4">
                Elige el diseño que se utilizará por defecto al generar los PDFs de las facturas. Los usuarios podrán elegir una plantilla diferente al crear cada factura.
              </div>

              <div className="bo-pdfTemplateOptions">
                {PDF_TEMPLATE_OPTIONS.map((template) => (
                  <label
                    key={template.value}
                    className={`bo-pdfTemplateCard ${invoiceSettings.defaultPdfTemplate === template.value ? "bo-pdfTemplateCard--selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="pdfTemplate"
                      value={template.value}
                      checked={invoiceSettings.defaultPdfTemplate === template.value}
                      onChange={(e) => setInvoiceSettings((p) => ({ ...p, defaultPdfTemplate: e.target.value as PdfTemplateType }))}
                      className="bo-pdfTemplateRadio"
                    />
                    <div className="bo-pdfTemplateCardContent">
                      <div className="bo-pdfTemplateCardTitle">{template.label}</div>
                      <div className="bo-pdfTemplateCardDesc">{template.description}</div>
                    </div>
                    {invoiceSettings.defaultPdfTemplate === template.value && (
                      <div className="bo-pdfTemplateCardCheck">✓</div>
                    )}
                  </label>
                ))}
              </div>

              <div className="flex gap-4">
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={saveInvoiceSettings} disabled={busy}>
                  Guardar configuracion
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirmApply}
        title="Confirmar renumeracion"
        message={`Estas seguro de que deseas renumerar ${renumberPreview?.length || 0} facturas? Esta accion no se puede deshacer y se creara un registro de auditoria.`}
        confirmLabel="Renumerar"
        cancelLabel="Cancelar"
        onConfirm={applyRenumber}
        onCancel={() => setShowConfirmApply(false)}
        busy={renumberLoading}
      />
    </section>
  );
}
