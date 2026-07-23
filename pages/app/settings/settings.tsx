import React, { useCallback, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type {
  RestaurantBranding,
  RestaurantIntegrations,
  RestaurantInvoiceSettings,
  RestaurantWebsiteMenuTemplatesConfig,
} from "../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { PageToolbar } from "../../../ui/shell/PageToolbar";
import { IntegrationsPanel } from "./functionalComponents/IntegrationsPanel/IntegrationsPanel";
import { BrandingPanel } from "./functionalComponents/BrandingPanel/BrandingPanel";
import { WebsitePanel } from "./functionalComponents/WebsitePanel/WebsitePanel";
import { InvoiceNumberingPanel } from "./functionalComponents/InvoiceNumberingPanel/InvoiceNumberingPanel";
import { PdfTemplatePanel } from "./functionalComponents/PdfTemplatePanel/PdfTemplatePanel";

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

  useErrorToast(error);

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
      pushToast({ kind: "success", title: "Actualizado" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error recargando");
    } finally {
      setBusy(false);
    }
  }, [api, pushToast]);

  const saveIntegrations = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.settings.setIntegrations(integrations);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
        return;
      }
      setIntegrations(res.integrations);
      pushToast({ kind: "success", title: "Guardado", message: "Integraciones actualizadas" });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      setBusy(false);
    }
  }, [api, integrations, pushToast]);

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

  return (
    <section aria-label="Ajustes" data-ui="settings-page">
      <PageToolbar
        left={
          <button className="bo-btn bo-btn--ghost" type="button" onClick={reload} disabled={busy} data-role="reloadBtn">
            Recargar
          </button>
        }
        right={
          <div className="bo-mutedText" data-slot="busyIndicator">{busy ? "Guardando..." : ""}</div>
        }
        data-ui="toolbar"
      />

      <div className="bo-stack" data-ui="panelsStack">
        <IntegrationsPanel
          integrations={integrations}
          busy={busy}
          onIntegrationsChange={setIntegrations}
          onSave={saveIntegrations}
        />
        <BrandingPanel
          branding={branding}
          busy={busy}
          onBrandingChange={setBranding}
          onSave={saveBranding}
        />
        <WebsitePanel
          websiteMenuTemplates={websiteMenuTemplates}
          websiteTemplateUsePerType={websiteTemplateUsePerType}
          busy={busy}
          onTemplatesChange={setWebsiteMenuTemplates}
          onUsePerTypeChange={setWebsiteTemplateUsePerType}
          onSave={saveWebsiteMenuTemplates}
        />
        <InvoiceNumberingPanel
          invoiceSettings={invoiceSettings}
          busy={busy}
          onSettingsChange={setInvoiceSettings}
          onSave={saveInvoiceSettings}
        />
        <PdfTemplatePanel
          invoiceSettings={invoiceSettings}
          busy={busy}
          onSettingsChange={setInvoiceSettings}
          onSave={saveInvoiceSettings}
        />
      </div>
    </section>
  );
}
