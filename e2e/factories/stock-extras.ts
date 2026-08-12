/**
 * Stock warehouse + category factories for E2E tests.
 *
 * Warehouse:
 *   create  → POST /api/admin/stock/warehouses
 *   cleanup → DELETE /api/admin/stock/warehouses/{id}  (rejects default or non-empty → 409, swallowed)
 *
 * Category:
 *   create  → POST /api/admin/stock/categories
 *   cleanup → DELETE /api/admin/stock/categories/{id}  (rejects if in use → 409, swallowed)
 */
import type { TestApiClient } from "../helpers/api-client";

// --- Warehouse ---

export type WarehouseType = "STORAGE" | "SALES" | "PRODUCTION";

export interface WarehouseInput {
  name?: string;
  code?: string;
  type?: WarehouseType;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
}

export interface Warehouse {
  id: number;
  [key: string]: unknown;
}

let whCounter = 0;

export async function createWarehouse(
  api: TestApiClient,
  overrides: WarehouseInput = {},
): Promise<Warehouse> {
  const res = await api.post<{ success: boolean; id?: number; message?: string }>(
    "/api/admin/stock/warehouses",
    {
      name: `E2E WH ${Date.now()}-${++whCounter}`,
      code: `E2E${whCounter}`,
      type: "STORAGE",
      isDefault: false,
      isActive: true,
      ...overrides,
    },
  );
  if (!res.success || typeof res.id !== "number") {
    throw new Error(`createWarehouse failed: ${res.message ?? "no id in response"}`);
  }
  return { id: res.id };
}

export async function deleteWarehouse(api: TestApiClient, id: number): Promise<void> {
  await api.delete(`/api/admin/stock/warehouses/${id}`);
}

export interface WarehouseFactory {
  create(overrides?: WarehouseInput): Promise<Warehouse>;
}

export function makeWarehouseFactory(
  api: TestApiClient,
): { factory: WarehouseFactory; cleanup: () => Promise<void> } {
  const created: number[] = [];
  return {
    factory: {
      async create(overrides?: WarehouseInput) {
        const wh = await createWarehouse(api, overrides);
        created.push(wh.id);
        return wh;
      },
    },
    cleanup: async () => {
      await Promise.all(created.map((id) => deleteWarehouse(api, id).catch(() => undefined)));
    },
  };
}

// --- Category ---

export interface StockCategoryInput {
  name?: string;
  [key: string]: unknown;
}

export interface StockCategory {
  id: number;
  [key: string]: unknown;
}

let catCounter = 0;

export async function createStockCategory(
  api: TestApiClient,
  overrides: StockCategoryInput = {},
): Promise<StockCategory> {
  const res = await api.post<{ success: boolean; id?: number; message?: string }>(
    "/api/admin/stock/categories",
    {
      name: `E2E Cat ${Date.now()}-${++catCounter}`,
      ...overrides,
    },
  );
  if (!res.success || typeof res.id !== "number") {
    throw new Error(`createStockCategory failed: ${res.message ?? "no id in response"}`);
  }
  return { id: res.id };
}

export async function deleteStockCategory(api: TestApiClient, id: number): Promise<void> {
  await api.delete(`/api/admin/stock/categories/${id}`);
}

export interface StockCategoryFactory {
  create(overrides?: StockCategoryInput): Promise<StockCategory>;
}

export function makeStockCategoryFactory(
  api: TestApiClient,
): { factory: StockCategoryFactory; cleanup: () => Promise<void> } {
  const created: number[] = [];
  return {
    factory: {
      async create(overrides?: StockCategoryInput) {
        const cat = await createStockCategory(api, overrides);
        created.push(cat.id);
        return cat;
      },
    },
    cleanup: async () => {
      await Promise.all(created.map((id) => deleteStockCategory(api, id).catch(() => undefined)));
    },
  };
}
