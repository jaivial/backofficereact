/**
 * Dashboard & Calendar API Module
 * Handles dashboard metrics and calendar operations
 */

import type { APIError, APISuccess, DashboardMetrics, CalendarDay, InvoiceDashboardMetrics } from "../types";
import type { JsonRequestFn } from "../utils/request";

export type DashboardModule = {
  getMetrics(date: string): Promise<APISuccess<{ metrics: DashboardMetrics; invoiceMetrics: InvoiceDashboardMetrics | null }> | APIError>;
};

export function createDashboardModule(json: JsonRequestFn): DashboardModule {
  return {
    async getMetrics(date: string): Promise<APISuccess<{ metrics: DashboardMetrics; invoiceMetrics: InvoiceDashboardMetrics | null }> | APIError> {
      const q = new URLSearchParams({ date });
      return json(`/api/admin/dashboard/metrics?${q.toString()}`, { method: "GET" });
    },
  };
}

export type CalendarModule = {
  getMonth(params: { year: number; month: number }): Promise<APISuccess<{ data: CalendarDay[] }> | APIError>;
};

export function createCalendarModule(json: JsonRequestFn): CalendarModule {
  return {
    async getMonth(params: { year: number; month: number }): Promise<APISuccess<{ data: CalendarDay[] }> | APIError> {
      const q = new URLSearchParams({ year: String(params.year), month: String(params.month) });
      return json(`/api/admin/calendar?${q.toString()}`, { method: "GET" });
    },
  };
}
