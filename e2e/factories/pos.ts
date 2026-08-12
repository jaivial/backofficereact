/**
 * POS product + category factories for E2E tests.
 *
 * Product:
 *   create  → POST /api/admin/pos/products   (body: name, priceGrossCents, isActive, ...)
 *   cleanup → DELETE /api/admin/pos/products/{id}
 *
 * Category:
 *   create  → POST /api/admin/pos/categories  (body: name, sortOrder, isActive)
 *   cleanup → DELETE /api/admin/pos/categories/{id}
 */
import type { TestApiClient } from "../helpers/api-client";

// --- Product ---

export interface POSProductInput {
  name?: string;
  sku?: string;
  categoryId?: number;
  priceGrossCents?: number;
  vatRateId?: number;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface POSProduct {
  id: number;
  [key: string]: unknown;
}

let prodCounter = 0;

export async function createPOSProduct(
  api: TestApiClient,
  overrides: POSProductInput = {},
): Promise<POSProduct> {
  const res = await api.post<{ success: boolean; id?: number; message?: string }>(
    "/api/admin/pos/products",
    {
      name: `E2E Product ${Date.now()}-${++prodCounter}`,
      priceGrossCents: 500,
      isActive: true,
      ...overrides,
    },
  );
  if (!res.success || typeof res.id !== "number") {
    throw new Error(`createPOSProduct failed: ${res.message ?? "no id in response"}`);
  }
  return { id: res.id };
}

export async function deletePOSProduct(api: TestApiClient, id: number): Promise<void> {
  await api.delete(`/api/admin/pos/products/${id}`);
}

export interface POSProductFactory {
  create(overrides?: POSProductInput): Promise<POSProduct>;
}

export function makePOSProductFactory(
  api: TestApiClient,
): { factory: POSProductFactory; cleanup: () => Promise<void> } {
  const created: number[] = [];
  return {
    factory: {
      async create(overrides?: POSProductInput) {
        const p = await createPOSProduct(api, overrides);
        created.push(p.id);
        return p;
      },
    },
    cleanup: async () => {
      await Promise.all(created.map((id) => deletePOSProduct(api, id).catch(() => undefined)));
    },
  };
}

// --- Category ---

export interface POSCategoryInput {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface POSCategory {
  id: number;
  [key: string]: unknown;
}

let catCounter = 0;

export async function createPOSCategory(
  api: TestApiClient,
  overrides: POSCategoryInput = {},
): Promise<POSCategory> {
  const res = await api.post<{ success: boolean; id?: number; message?: string }>(
    "/api/admin/pos/categories",
    {
      name: `E2E Cat ${Date.now()}-${++catCounter}`,
      sortOrder: 0,
      isActive: true,
      ...overrides,
    },
  );
  if (!res.success || typeof res.id !== "number") {
    throw new Error(`createPOSCategory failed: ${res.message ?? "no id in response"}`);
  }
  return { id: res.id };
}

export async function deletePOSCategory(api: TestApiClient, id: number): Promise<void> {
  await api.delete(`/api/admin/pos/categories/${id}`);
}

export interface POSCategoryFactory {
  create(overrides?: POSCategoryInput): Promise<POSCategory>;
}

export function makePOSCategoryFactory(
  api: TestApiClient,
): { factory: POSCategoryFactory; cleanup: () => Promise<void> } {
  const created: number[] = [];
  return {
    factory: {
      async create(overrides?: POSCategoryInput) {
        const c = await createPOSCategory(api, overrides);
        created.push(c.id);
        return c;
      },
    },
    cleanup: async () => {
      await Promise.all(created.map((id) => deletePOSCategory(api, id).catch(() => undefined)));
    },
  };
}
