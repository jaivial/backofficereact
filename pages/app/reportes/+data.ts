import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../../api/client";
import type { TaxReport, TaxReportQuarterlyBreakdown } from "../../../api/types";

type PageData = {
  report: TaxReport | null;
  quarterlyBreakdown: TaxReportQuarterlyBreakdown[];
  currentYear: number;
  error: string | null;
  customers: { name: string; email?: string; dni_cif?: string }[];
};

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Reportes" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  // Get current year and calculate current quarter
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor((now.getMonth() + 3) / 3);
  const quarterStartMonth = (currentQuarter - 1) * 3;
  const dateFrom = `${currentYear}-${String(quarterStartMonth + 1).padStart(2, "0")}-01`;
  const dateTo = new Date(currentYear, quarterStartMonth + 3, 0).toISOString().split("T")[0];

  let report: TaxReport | null = null;
  let quarterlyBreakdown: TaxReportQuarterlyBreakdown[] = [];
  let error: string | null = null;
  let customers: { name: string; email?: string; dni_cif?: string }[] = [];

  try {
    // Fetch IVA report for current quarter
    const reportRes = await api.taxReports.getIVAReport({
      date_from: dateFrom,
      date_to: dateTo,
      include_credit_notes: true,
    });
    if (reportRes.success && reportRes.report) {
      report = reportRes.report;
    }
  } catch (e) {
    // Silently handle - report will be null and user can regenerate
  }

  try {
    // Fetch quarterly breakdown for current year
    const quarterlyRes = await api.taxReports.getQuarterlyBreakdown(currentYear);
    if (quarterlyRes.success && quarterlyRes.quarters) {
      quarterlyBreakdown = quarterlyRes.quarters;
    }
  } catch (e) {
    // Silently handle
  }

  try {
    // Fetch customers with invoices
    const customersRes = await api.taxReports.listCustomersWithInvoices();
    if (customersRes.success && customersRes.customers) {
      customers = customersRes.customers;
    }
  } catch (e) {
    // Silently handle - customers will be loaded on demand
  }

  return { report, quarterlyBreakdown, currentYear, error, customers };
}
