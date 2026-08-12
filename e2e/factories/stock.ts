/**
 * Stock item data factory for E2E tests.
 *
 * create  → POST /api/admin/stock/items   (creates item + default display/purchase unit)
 * cleanup → DELETE /api/admin/stock/items/{id}   (soft delete; rejects non-zero stock)
 *
 * The factory creates untracked items by default so DELETE never hits the
 * non-zero-stock rejection. If a test adds stock movements, it should set
 * `isTracked: false` or subtract before cleanup; the cleanup swallows errors
 * from items that can't be deleted.
 */
import type { TestApiClient } from "../helpers/api-client";

export type StockKind = "FINISHED" | "RAW" | "MANUFACTURED";

export interface StockItemInput {
  name?: string;
  sku?: string;
  categoryId?: number;
  kind?: StockKind;
  baseDimension?: string;
  isTracked?: boolean;
  deductionSource?: string;
  displayUnitLabel?: string;
  displayUnitCode?: string;
  displayUnitFactor?: number;
  [key: string]: unknown;
}

export interface StockItem {
  id: number;
  [key: string]: unknown;
}

let counter = 0;

export async function createStockItem(
  api: TestApiClient,
  overrides: StockItemInput = {},
): Promise<StockItem> {
  const res = await api.post<{ success: boolean; id?: number; message?: string }>(
    "/api/admin/stock/items",
    {
      name: `E2E Stock ${Date.now()}-${++counter}`,
      kind: "RAW",
      baseDimension: "COUNT",
      baseUnit: "ud",
      isTracked: false,
      displayUnitLabel: "ud",
      displayUnitCode: "ud",
      displayUnitFactor: 1,
      ...overrides,
    },
  );
  if (!res.success || typeof res.id !== "number") {
    throw new Error(`createStockItem failed: ${res.message ?? "no id in response"}`);
  }
  return { id: res.id };
}

export async function deleteStockItem(api: TestApiClient, id: number): Promise<void> {
  await api.delete(`/api/admin/stock/items/${id}`);
}

export interface StockItemFactory {
  create(overrides?: StockItemInput): Promise<StockItem>;
}

export function makeStockItemFactory(
  api: TestApiClient,
): { factory: StockItemFactory; cleanup: () => Promise<void> } {
  const created: number[] = [];
  return {
    factory: {
      async create(overrides?: StockItemInput) {
        const item = await createStockItem(api, overrides);
        created.push(item.id);
        return item;
      },
    },
    cleanup: async () => {
      await Promise.all(created.map((id) => deleteStockItem(api, id).catch(() => undefined)));
    },
  };
}
