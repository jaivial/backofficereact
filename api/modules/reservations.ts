/**
 * Reservations API Module
 * Handles booking operations, search, and table assignments
 */

import type { APIError, APISuccess, Booking, ConfigFloor } from "../types";
import type { JsonRequestFn, WithQueryFn } from "../utils/request";

export type ReservasModule = {
  list(params: {
    date: string;
    status?: string;
    q?: string;
    page?: number;
    count?: number;
    sort?: "reservation_time" | "added_date";
    dir?: "asc" | "desc";
  }): Promise<
    APISuccess<{ bookings: Booking[]; floors?: ConfigFloor[]; total_count: number; total: number; page: number; count: number }> | APIError
  >;
  cancel(id: number): Promise<APISuccess | APIError>;
  exportDay(date: string): Promise<APISuccess<{ bookings: Booking[] }> | APIError>;
  get(id: number): Promise<APISuccess<{ booking: Booking }> | APIError>;
  create(input: any): Promise<APISuccess<{ booking: Booking }> | APIError>;
  patch(id: number, patch: any): Promise<APISuccess<{ booking: Booking }> | APIError>;
  search(params: {
    date_from?: string;
    date_to?: string;
    name?: string;
    phone?: string;
    party_size?: number;
    time?: string;
  }): Promise<APISuccess<{ results: any[] }> | APIError>;
};

export function createReservasModule(json: JsonRequestFn, withQuery: WithQueryFn): ReservasModule {
  return {
    async list(params: {
      date: string;
      status?: string;
      q?: string;
      page?: number;
      count?: number;
      sort?: "reservation_time" | "added_date";
      dir?: "asc" | "desc";
    }): Promise<
      APISuccess<{ bookings: Booking[]; floors?: ConfigFloor[]; total_count: number; total: number; page: number; count: number }> | APIError
    > {
      const q = new URLSearchParams();
      q.set("date", params.date);
      if (params.status) q.set("status", params.status);
      if (params.q) q.set("q", params.q);
      if (params.page !== undefined) q.set("page", String(params.page));
      if (params.count !== undefined) q.set("count", String(params.count));
      if (params.sort) q.set("sort", params.sort);
      if (params.dir) q.set("dir", params.dir);
      return json(`/api/admin/bookings?${q.toString()}`, { method: "GET" });
    },

    async cancel(id: number): Promise<APISuccess | APIError> {
      return json(`/api/admin/bookings/${id}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    },

    async exportDay(date: string): Promise<APISuccess<{ bookings: Booking[] }> | APIError> {
      return json(`/api/admin/bookings/export?date=${encodeURIComponent(date)}`, { method: "GET" });
    },

    async get(id: number): Promise<APISuccess<{ booking: Booking }> | APIError> {
      return json(`/api/admin/bookings/${id}`, { method: "GET" });
    },

    async create(input: any): Promise<APISuccess<{ booking: Booking }> | APIError> {
      return json("/api/admin/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    },

    async patch(id: number, patch: any): Promise<APISuccess<{ booking: Booking }> | APIError> {
      return json(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
    },

    async search(params: {
      date_from?: string;
      date_to?: string;
      name?: string;
      phone?: string;
      party_size?: number;
      time?: string;
    }): Promise<APISuccess<{ results: any[] }> | APIError> {
      return json(withQuery("/api/admin/bookings/search", params), { method: "GET" });
    },
  };
}
