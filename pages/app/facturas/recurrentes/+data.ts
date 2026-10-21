import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../../../api/client";
import type { RecurringInvoice } from "../../../../api/recurring-types";

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
    // Sin filtro is_active: la página pinta activas y pausadas (badge "Pausada",
    // acción reanudar y la stat "Pausadas") y sale de esta misma lista.
    // coord: recurring_list_v1 (FE -> GET /api/admin/recurring-invoices)
    const res: any = await api.recurringInvoices.list({ limit });
    if (res?.success) {
      recurringInvoices = res.recurringInvoices;
      total = res.total;
      page = res.page;
      limit = res.limit;
      activeCount = res.recurringInvoices.filter((r: { is_active: boolean }) => r.is_active).length;
      pausedCount = res.recurringInvoices.filter((r: { is_active: boolean }) => !r.is_active).length;
    } else {
      error = res?.message || "No se pudo cargar la facturación recurrente";
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando facturas recurrentes";
  }

  return { recurringInvoices, total, page, limit, error, activeCount, pausedCount };
}
