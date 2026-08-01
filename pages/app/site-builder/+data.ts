import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

/**
 * Server-side hydration for the site-builder editor. Fetches the restaurant's
 * site-builder state (sites, pages, components) from the Go backend over REST
 * (vike SSR). All subsequent CRUD goes over the WebSocket bridge.
 */

export type Data = {
  site: Record<string, unknown> | null;
  pages: Record<string, unknown>[];
  components: Record<string, unknown>[];
  error: string | null;
};

export async function data(pageContext: PageContextServer): Promise<Data> {
  const config = useConfig();
  config({ title: "Editor de Sitio Web" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  const api = async (path: string): Promise<any> => {
    const res = await fetch(`${backendOrigin}/admin${path}`, {
      headers: { cookie: cookieHeader, "content-type": "application/json" },
    });
    if (!res.ok) throw new Error(`SSR fetch ${path}: ${res.status}`);
    return res.json();
  };

  const safeCall = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const [sitesData, componentsData] = await Promise.all([
    safeCall(() => api("/site-builder/sites"), { success: false }),
    safeCall(() => api("/site-builder/components"), { success: false }),
  ]);

  const sites: Record<string, unknown>[] = sitesData.sites ?? [];
  const site = sites[0] ?? null;

  let pages: Record<string, unknown>[] = [];
  if (site && typeof site.id === "string") {
    const pagesData = await safeCall(() => api(`/site-builder/sites/${site.id}/pages`), { success: false });
    pages = pagesData.pages ?? [];
  }

  return {
    site,
    pages,
    components: componentsData.components ?? [],
    error: null,
  };
}
