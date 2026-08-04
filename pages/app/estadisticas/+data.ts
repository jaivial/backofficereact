import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { AnalyticsGranularity, AnalyticsOverview, AnalyticsOverviewParams } from "../../../api/types";

export type EstadisticasPageData = {
  params: AnalyticsOverviewParams;
  overview: AnalyticsOverview | null;
  error: string | null;
};

export type Data = Awaited<ReturnType<typeof data>>;

const GRANULARITIES: AnalyticsGranularity[] = ["day", "week", "month", "quarter", "year"];
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayISO(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defaultRange(now = new Date()): Pick<AnalyticsOverviewParams, "from" | "to"> {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: todayISO(from), to: todayISO(to) };
}

function searchValue(search: Record<string, unknown> | undefined, key: string): string {
  const value = search?.[key];
  return typeof value === "string" ? value : "";
}

function parseAnalyticsParams(search: Record<string, unknown> | undefined, now = new Date()): AnalyticsOverviewParams {
  const fallback = defaultRange(now);
  const from = searchValue(search, "from");
  const to = searchValue(search, "to");
  const candidateFrom = ISO_DATE_PATTERN.test(from) ? from : fallback.from;
  const candidateTo = ISO_DATE_PATTERN.test(to) ? to : fallback.to;
  const range = candidateFrom <= candidateTo ? { from: candidateFrom, to: candidateTo } : fallback;
  const rawGranularity = searchValue(search, "granularity") as AnalyticsGranularity;
  const granularity = GRANULARITIES.includes(rawGranularity) ? rawGranularity : "day";
  const compare = searchValue(search, "compare");

  return {
    ...range,
    granularity,
    ...(compare === "none" ? {} : { compare: "previous" as const }),
  };
}

export async function data(pageContext: PageContextServer): Promise<EstadisticasPageData> {
  const config = useConfig();
  config({ title: "Estadisticas" });

  const params = parseAnalyticsParams(pageContext.urlParsed?.search as Record<string, unknown> | undefined);
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  try {
    const response = await api.analytics.getOverview(params);
    if (!response.success) return { params, overview: null, error: response.message };
    return { params, overview: response, error: null };
  } catch (error) {
    return {
      params,
      overview: null,
      error: error instanceof Error ? error.message : "Error cargando estadisticas",
    };
  }
}
