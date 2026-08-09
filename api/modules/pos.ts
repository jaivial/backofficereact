/**
 * POS API Module
 * Cash day lifecycle: what the till has open, what it took, and sealing it.
 */

import type { APIError, APISuccess, POSCashDay, POSCashDayCurrent, POSCashDayTables } from "../types";
import type { JsonRequestFn } from "../utils/request";

export type POSModule = {
  cashDays: {
    current(params?: { date?: string }): Promise<APISuccess<POSCashDayCurrent> | APIError>;
    list(params: { from: string; to: string }): Promise<APISuccess<{ items: POSCashDay[] }> | APIError>;
    tables(params: { date: string }): Promise<APISuccess<POSCashDayTables> | APIError>;
    open(params: { date?: string; openingCashCents?: number; force?: boolean; notes?: string }): Promise<APISuccess<{ cashDay: POSCashDay }> | APIError>;
    close(params: { id: number; countedCashCents: number; notes?: string; discrepancyReason?: string }): Promise<APISuccess<{ cashDay: POSCashDay }> | APIError>;
  };
};

const jsonHeaders = { "content-type": "application/json" };

export function createPOSModule(json: JsonRequestFn): POSModule {
  return {
    cashDays: {
      async current(params?: { date?: string }): Promise<APISuccess<POSCashDayCurrent> | APIError> {
        const q = new URLSearchParams();
        if (params?.date) q.set("date", params.date);
        const query = q.toString();
        return json(`/api/admin/pos/cash-days/current${query ? `?${query}` : ""}`, { method: "GET" });
      },
      async list(params: { from: string; to: string }): Promise<APISuccess<{ items: POSCashDay[] }> | APIError> {
        const q = new URLSearchParams({ from: params.from, to: params.to });
        return json(`/api/admin/pos/cash-days?${q.toString()}`, { method: "GET" });
      },
      async tables(params: { date: string }): Promise<APISuccess<POSCashDayTables> | APIError> {
        return json(`/api/admin/pos/cash-days/${params.date}/tables`, { method: "GET" });
      },
      async open(params: { date?: string; openingCashCents?: number; force?: boolean; notes?: string }): Promise<APISuccess<{ cashDay: POSCashDay }> | APIError> {
        return json("/api/admin/pos/cash-days", { method: "POST", headers: jsonHeaders, body: JSON.stringify(params) });
      },
      async close(params: { id: number; countedCashCents: number; notes?: string; discrepancyReason?: string }): Promise<APISuccess<{ cashDay: POSCashDay }> | APIError> {
        const { id, ...body } = params;
        return json(`/api/admin/pos/cash-days/${id}/close`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
      },
    },
  };
}
