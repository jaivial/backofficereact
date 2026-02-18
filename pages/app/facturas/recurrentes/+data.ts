import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../../api/client";
import type { RecurringInvoice } from "../../../api/recurring-types";

type PageData = {
  recurringInvoices: RecurringInvoice[];
  total: number;
  page: number;
  limit: number;
  error: string | null;
  activeCount: number;
  pausedCount: number;
};

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Facturación Recurrente" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let recurringInvoices: RecurringInvoice[] = [];
  let total = 0;
  let page = 1;
  let limit = 20;
  let error: string | null = null;
  let activeCount = 0;
  let pausedCount = 0;

  try {
    const res = await api.recurringInvoices.list({ limit, is_active: true });
    if (res.success) {
      recurringInvoices = res.recurringInvoices;
      total = res.total;
      page = res.page;
      limit = res.limit;
      activeCount = res.recurringInvoices.filter(r => r.is_active).length;
      pausedCount = res.recurringInvoices.filter(r => !r.is_active).length;
    } else {
      error = res.message || "Error cargando facturas recurrentes";
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando facturas recurrentes";
  }

  return { recurringInvoices, total, page, limit, error, activeCount, pausedCount };
}
