import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

export type PlataformaPageData = {
  dashboard: Awaited<ReturnType<typeof fetchDashboard>>;
  error: string | null;
};

export type Data = Awaited<ReturnType<typeof data>>;

async function fetchDashboard(backendOrigin: string, cookieHeader: string) {
  try {
    const res = await fetch(`${backendOrigin}/admin/platform/dashboard`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function data(pageContext: PageContextServer): Promise<PlataformaPageData> {
  const config = useConfig();
  config({ title: "Plataforma" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  const dashboard = await fetchDashboard(backendOrigin, cookieHeader);

  return {
    dashboard,
    error: dashboard ? null : "No se pudo cargar el dashboard de plataforma",
  };
}
