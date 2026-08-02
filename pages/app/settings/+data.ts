import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { RestaurantBranding, RestaurantInfo, RestaurantIntegrations, RestaurantInvoiceSettings, RestaurantWebsiteMenuTemplatesConfig } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Ajustes" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let integrations: RestaurantIntegrations | null = null;
  let branding: RestaurantBranding | null = null;
  let invoiceSettings: RestaurantInvoiceSettings | null = null;
  let websiteMenuTemplates: RestaurantWebsiteMenuTemplatesConfig | null = null;
  let restaurantInfo: RestaurantInfo | null = null;

  try {
    const [a, b, c, d, e] = await Promise.all([
      api.settings.getIntegrations(),
      api.settings.getBranding(),
      api.settings.getInvoiceSettings(),
      api.settings.getWebsiteMenuTemplates(),
      api.config.getRestaurantInfo(),
    ]);
    if (a.success) integrations = a.integrations;
    else error = a.message || "Error cargando integraciones";

    if (b.success) branding = b.branding;
    else if (!error) error = b.message || "Error cargando branding";

    if (c.success) invoiceSettings = c.settings;
    else if (!error) error = c.message || "Error cargando configuracion de facturas";

    if (d.success) websiteMenuTemplates = d;
    else if (!error) error = d.message || "Error cargando pagina web";

    if (e.success) restaurantInfo = e.restaurantInfo;
    else if (!error) error = e.message || "Error cargando datos fiscales";
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando ajustes";
  }

  return { integrations, branding, invoiceSettings, websiteMenuTemplates, restaurantInfo, error };
}
