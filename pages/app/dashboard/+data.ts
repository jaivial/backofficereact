import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { InvoiceDashboardMetrics } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getFirstDayOfMonth(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function getFirstDayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function getInvoiceMetrics(api: ReturnType<typeof createClient>): Promise<InvoiceDashboardMetrics> {
  // Get all invoices (using a high limit to get all)
  const allInvoicesRes = await api.invoices.list({ limit: 10000 });
  if (!allInvoicesRes.success) {
    return { pendingCount: 0, pendingAmount: 0, monthIncome: 0, weekSentCount: 0 };
  }

  const invoices = allInvoicesRes.invoices;
  const today = new Date();
  const firstDayOfMonth = getFirstDayOfMonth();
  const firstDayOfWeek = getFirstDayOfWeek();

  // Facturas pendientes de pago (status: "pendiente")
  const pendingInvoices = invoices.filter((inv) => inv.status === "pendiente");
  const pendingCount = pendingInvoices.length;
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Ingresos del mes (invoices from this month)
  const monthInvoices = invoices.filter((inv) => {
    return inv.invoice_date >= firstDayOfMonth && inv.invoice_date <= todayISO();
  });
  const monthIncome = monthInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Facturas enviadas esta semana (status: "enviada" and sent this week)
  const weekSentInvoices = invoices.filter((inv) => {
    return inv.status === "enviada" && inv.invoice_date >= firstDayOfWeek && inv.invoice_date <= todayISO();
  });
  const weekSentCount = weekSentInvoices.length;

  return {
    pendingCount,
    pendingAmount,
    monthIncome,
    weekSentCount,
  };
}

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Dashboard" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  const api = createClient({ baseUrl: backendOrigin, cookieHeader });
  const res = await api.dashboard.getMetrics(date);

  if (!res.success) {
    return { date, metrics: null as any, invoiceMetrics: null as any, error: res.message };
  }

  // Get invoice metrics
  const invoiceMetrics = await getInvoiceMetrics(api);

  return { date, metrics: res.metrics, invoiceMetrics, error: null as any };
}

