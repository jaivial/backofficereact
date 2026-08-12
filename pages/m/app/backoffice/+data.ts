import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { DashboardMetrics } from "../../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Dashboard" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let metrics: DashboardMetrics | null = null;

  try {
    const res = await api.dashboard.getMetrics(date);
    if (res.success) metrics = res.metrics;
  } catch {
    // Swallow: mobile dashboard renders an empty metrics section on null.
  }

  return { metrics };
}
