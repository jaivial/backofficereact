/**
 * Tables API Module
 * Handles table map operations, layout, and texture uploads
 */

import type { APIError, APISuccess, TableMapArea, TableMapItem } from "../types";
import type { JsonRequestFn, WithQueryFn } from "../utils/request";

export type TablesModule = {
  list(params?: {
    date?: string;
    floor_number?: number;
  }): Promise<
    APISuccess<{ data: TableMapArea[]; areas: TableMapArea[]; tables: TableMapItem[]; layout?: Record<string, unknown> }> | APIError
  >;
  create(input: Partial<TableMapItem> & {
    entity?: "table" | "area";
    area_id?: number;
    name?: string;
    date?: string;
    floor_number?: number;
  }): Promise<APISuccess<{ item: any; table?: TableMapItem; entity: string }> | APIError>;
  update(input: Partial<TableMapItem> & {
    id?: number;
    entity?: "table" | "area" | "layout";
    area_id?: number;
    name?: string;
    date?: string;
    floor_number?: number;
    metadata?: Record<string, unknown>;
  }): Promise<APISuccess<{ item?: any; table?: TableMapItem; entity: string; layout?: Record<string, unknown> }> | APIError>;
  saveLayout(input: {
    date: string;
    floor_number: number;
    metadata: Record<string, unknown>;
  }): Promise<APISuccess<{ entity: "layout"; layout: Record<string, unknown> }> | APIError>;
  uploadTextureImage(id: number, file: File): Promise<APISuccess<{ id: number; imageUrl: string }> | APIError>;
};

export function createTablesModule(json: JsonRequestFn, withQuery: WithQueryFn): TablesModule {
  return {
    async list(params?: {
      date?: string;
      floor_number?: number;
    }): Promise<
      APISuccess<{ data: TableMapArea[]; areas: TableMapArea[]; tables: TableMapItem[]; layout?: Record<string, unknown> }> | APIError
    > {
      return json(withQuery("/api/admin/tables", params), { method: "GET" });
    },

    async create(input: Partial<TableMapItem> & {
      entity?: "table" | "area";
      area_id?: number;
      name?: string;
      date?: string;
      floor_number?: number;
    }): Promise<APISuccess<{ item: any; table?: TableMapItem; entity: string }> | APIError> {
      return json("/api/admin/tables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    },

    async update(input: Partial<TableMapItem> & {
      id?: number;
      entity?: "table" | "area" | "layout";
      area_id?: number;
      name?: string;
      date?: string;
      floor_number?: number;
      metadata?: Record<string, unknown>;
    }): Promise<APISuccess<{ item?: any; table?: TableMapItem; entity: string; layout?: Record<string, unknown> }> | APIError> {
      return json("/api/admin/tables", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    },

    async saveLayout(input: {
      date: string;
      floor_number: number;
      metadata: Record<string, unknown>;
    }): Promise<APISuccess<{ entity: "layout"; layout: Record<string, unknown> }> | APIError> {
      return json("/api/admin/tables/layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    },

    async uploadTextureImage(id: number, file: File): Promise<APISuccess<{ id: number; imageUrl: string }> | APIError> {
      const form = new FormData();
      form.append("image", file, file.name || "texture.webp");
      return json(`/api/admin/tables/${id}/texture-image`, { method: "POST", body: form });
    },
  };
}
