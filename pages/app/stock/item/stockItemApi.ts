// Shared transport + types for the stock item detail page (/app/stock/item?id=).
// The backend has no single-GET-by-id endpoint yet, so we resolve an item by
// paging through /items and finding the id (cheap for the item counts we have).

export type Warehouse = {
  id: number;
  name: string;
  code?: string;
  type: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  notes?: string;
};

export type Unit = { id: number; code: string; label: string; factorToBase: number };

export type StockItem = {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  categoryName?: string;
  kind: string;
  baseDimension: string;
  baseUnit: string;
  isTracked: boolean;
  deductionSource: string;
  quantityBase: number;
  parLevelBase: number;
  reorderPointBase: number;
  displayUnit: Unit;
};

export type Movement = {
  id: number;
  quantityBase: number;
  type: string;
  wasteReason?: string;
  enteredQuantity: number;
  enteredUnit: string;
  warehouseName: string;
  note?: string;
  actorName: string;
  occurredAt: string;
  expiresAt?: string | null;
};

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/admin/stock${path}`, { ...init, credentials: "include", headers });
  const body = (await response.json()) as T & { success?: boolean; message?: string };
  if (!response.ok || !body.success) throw new Error(body.message || "Error de stock");
  return body as T;
}

export async function fetchItemById(id: number): Promise<StockItem | null> {
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const data = await request<{ items: StockItem[]; totalPages: number }>(`/items?page=${page}&pageSize=${pageSize}`);
    const found = data.items.find((item) => item.id === id);
    if (found) return found;
    if (page >= data.totalPages) return null;
    page += 1;
  }
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const data = await request<{ warehouses: Warehouse[] }>("/warehouses");
  return data.warehouses;
}
