import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

export interface WebsiteConfig {
  id: number;
  restaurant_id: number;
  template_id: string | null;
  custom_html: string | null;
  domain: string | null;
  is_published: boolean;
}

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Sitio web" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  // No typed client method exists for GET /admin/website, so fetch directly
  // server-side using the request's session cookie. This puts the website
  // config into the first server-rendered HTML instead of a client spinner.
  try {
    const url = new URL("/api/admin/website", backendOrigin);
    const res = await fetch(url, {
      method: "GET",
      headers: { cookie: cookieHeader },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { config: null as WebsiteConfig | null, error: `No se pudo cargar la configuracion (${res.status})` };
    }

    const json = (await res.json()) as { success?: boolean; data?: WebsiteConfig | null };
    if (!json || json.success !== true) {
      return { config: null as WebsiteConfig | null, error: typeof json?.success === "boolean" ? "No se pudo cargar la configuracion" : null };
    }

    return { config: json.data ?? null, error: null as string | null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cargar la configuracion";
    return { config: null as WebsiteConfig | null, error: message };
  }
}
