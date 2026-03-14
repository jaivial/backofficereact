import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";

export type Data = Awaited<ReturnType<typeof data>>;

interface WebsiteConfig {
  id: number;
  restaurant_id: number;
  template_id: string | null;
  custom_html: string | null;
  domain: string | null;
  is_published: boolean;
}

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Website" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  try {
    const res = await api.request<{ success: boolean; data: WebsiteConfig | null }>("/admin/website", {
      method: "GET",
    });

    if (res.success) {
      return { config: res.data, error: null };
    }
    return { config: null, error: res.data || "Error cargando configuración" };
  } catch (err) {
    return { config: null, error: err instanceof Error ? err.message : "Error cargando configuración" };
  }
}
