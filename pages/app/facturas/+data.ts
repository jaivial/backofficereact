import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../../api/client";
import type { Invoice } from "../../../api/types";

type PageData = {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  error: string | null;
};

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Facturas" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let invoices: Invoice[] = [];
  let total = 0;
  let page = 1;
  let limit = 20;
  let error: string | null = null;

  try {
    const res = await api.invoices.list({ limit });
    if (res.success) {
      invoices = res.invoices;
      total = res.total;
      page = res.page;
      limit = res.limit;
    } else {
      error = res.message || "Error cargando facturas";
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando facturas";
  }

  // Page REST data endpoint also serves the persisted view preferences so the
  // tabla/grid mode and visible columns are correct on first paint with no
  // extra round-trip (rides the /api/admin/me session handshake).
  // Coordination ids: facturas_display_preference_v1, facturas_columns_preference_v1
  const rawDisplayMode = pageContext.bo?.session?.preferences?.facturasDisplayMode;
  const displayMode: "tabla" | "grid" = rawDisplayMode === "grid" ? "grid" : "tabla";
  const visibleColumns = pageContext.bo?.session?.preferences?.facturasVisibleColumns ?? "";

  return { invoices, total, page, limit, displayMode, visibleColumns, error };
}
