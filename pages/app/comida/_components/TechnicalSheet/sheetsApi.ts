// Thin transport layer for technical sheets. REST is the hydration source of
// truth; the WebSocket only pushes search results and image-job status on top
// of what these calls already returned.

export type SheetSummary = {
  id: number;
  name: string;
  status: "DRAFT" | "PUBLISHED";
  portions: number;
  imageUrl: string;
  usageCount: number;
  categoryId: number;
  categoryName: string;
  instructions: string;
  componentCount: number;
  stepCount: number;
  allergens: string[];
  /** Null when the sheet has no price: that is unknown, not zero. */
  sellingPriceGross: number | null;
  prepTimeMin: number | null;
};

export type SheetListFilters = {
  q?: string;
  status?: "DRAFT" | "PUBLISHED" | "";
  categoryId?: number | null;
  /** 1-based page. Omitted on legacy callers: the server then returns the first 100. */
  page?: number;
  /** Window size, capped by the server at 100. */
  pageSize?: number;
};

/** Page preferences the list response carries so switchers hydrate on load. */
export type SheetListPreferences = Record<string, string>;

/**
 * Optional output-unit details for a freshly created sheet. Stock creation lets
 * the user pick the dimension and display unit the produced article should
 * use; when omitted the server keeps its COUNT/ud defaults.
 */
export type SheetOutputUnit = {
  baseDimension: string;
  displayUnitCode: string;
  displayUnitLabel: string;
  displayUnitFactor: number;
};

export type SheetComponent = {
  id: number;
  stockItemId: number;
  name: string;
  quantity: number;
  unitId: number;
  unitCode: string;
  qtyBase: number;
  baseUnit: string;
  wastePct: number;
  isOptional: boolean;
  /** The stock item's picture, empty when it has none. */
  imageUrl?: string;
  subRecipeId?: number;
  notes?: string;
};

export type SheetStep = {
  id: number;
  stepNo: number;
  title: string;
  description: string;
  imageUrl: string;
  generationStatus: "NONE" | "PENDING" | "RUNNING" | "READY" | "FAILED";
  generationMode: string;
  generationError: string;
};

export type SheetCostLine = {
  stockItemId: number;
  name: string;
  qtyBase: number;
  baseUnit: string;
  enteredQty: number;
  unitLabel: string;
  wastePct: number;
  unitCostBase: number;
  lineCost: number;
  priceMissing: boolean;
};

export type SheetCost = {
  lines: SheetCostLine[];
  ingredientCost: number;
  labourCost: number;
  directVariableCost: number;
  totalCost: number;
  costPerPortion: number;
  grossPrice: number;
  netPrice: number;
  vatRate: number;
  foodCostPct: number;
  grossMargin: number;
  zone?: string;
  targetFoodCostPct?: number;
  /** False when any ingredient has no purchase price: the total is a floor, not a fact. */
  costComplete: boolean;
  missingPrices: string[];
};

export type SheetAllergens = {
  derived: string[];
  manualAdded: string[];
  manualDisabled: string[];
  effective: string[];
  contributors: Record<string, string[]>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(body.message || "Error en la ficha tecnica");
    // The caller needs the code to distinguish "in use" from a generic failure.
    (error as Error & { code?: string }).code = body.code;
    (error as Error & { payload?: unknown }).payload = body;
    throw error;
  }
  return body as T;
}

export const sheetsApi = {
  list: (filters: SheetListFilters | string = "", init?: RequestInit) => {
    // A bare string is still accepted so existing callers keep working.
    const applied: SheetListFilters = typeof filters === "string" ? { q: filters } : filters;
    const params = new URLSearchParams();
    if (applied.q) params.set("q", applied.q);
    if (applied.status) params.set("status", applied.status);
    if (applied.categoryId) params.set("categoryId", String(applied.categoryId));
    if (applied.page) params.set("page", String(applied.page));
    if (applied.pageSize) params.set("pageSize", String(applied.pageSize));
    const query = params.toString();
    return request<{
      sheets: SheetSummary[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      preferences?: SheetListPreferences;
    }>(
      `/comida/technical-sheets${query ? `?${query}` : ""}`,
      init,
    );
  },
  create: (name: string, portions: number, outputUnit?: SheetOutputUnit) =>
    request<{ sheetId: number; outputItemId: number }>("/comida/technical-sheets", {
      method: "POST",
      body: JSON.stringify(outputUnit ? { name, portions, ...outputUnit } : { name, portions }),
    }),
  /**
   * Returns the product's sheet, creating and linking it if there is none.
   * Idempotent on the server: React can run the triggering effect more than
   * once, and a client-side guard does not survive a remount.
   */
  ensureForProduct: (itemId: number, name: string, source: "comida" | "vinos" | "postres" = "comida") =>
    request<{ sheetId: number; reused?: boolean }>("/comida/technical-sheets/ensure", {
      method: "POST",
      body: JSON.stringify({ itemId, name, source }),
    }),
  duplicate: (sheetId: number, name?: string) =>
    request<{ sheetId: number; outputItemId: number }>(
      `/comida/technical-sheets/${sheetId}/duplicate`,
      { method: "POST", body: JSON.stringify({ name: name ?? "" }) },
    ),
  usage: (sheetId: number) =>
    request<{ products: { id: number; name: string }[]; usedBySheets: string[]; inUse: boolean }>(
      `/comida/technical-sheets/${sheetId}/usage`,
    ),
  remove: (sheetId: number) =>
    request<Record<string, never>>(`/comida/technical-sheets/${sheetId}`, { method: "DELETE" }),
  components: (sheetId: number) =>
    request<{ components: SheetComponent[] }>(`/comida/technical-sheets/${sheetId}/components`),
  addComponent: (sheetId: number, input: Record<string, unknown>) =>
    request<{ componentId: number }>(`/comida/technical-sheets/${sheetId}/components`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  patchComponent: (sheetId: number, componentId: number, input: Record<string, unknown>) =>
    request<Record<string, never>>(
      `/comida/technical-sheets/${sheetId}/components/${componentId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  removeComponent: (sheetId: number, componentId: number) =>
    request<Record<string, never>>(
      `/comida/technical-sheets/${sheetId}/components/${componentId}`,
      { method: "DELETE" },
    ),
  steps: (sheetId: number) =>
    request<{ steps: SheetStep[] }>(`/comida/technical-sheets/${sheetId}/steps`),
  addStep: (sheetId: number, input: { title?: string; description?: string }) =>
    request<{ stepId: number; stepNo: number }>(`/comida/technical-sheets/${sheetId}/steps`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  patchStep: (sheetId: number, stepId: number, input: Record<string, unknown>) =>
    request<Record<string, never>>(`/comida/technical-sheets/${sheetId}/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  removeStep: (sheetId: number, stepId: number) =>
    request<Record<string, never>>(`/comida/technical-sheets/${sheetId}/steps/${stepId}`, {
      method: "DELETE",
    }),
  /**
   * Direct upload. The client has already compressed to WebP; the server
   * normalises again because a client cannot be trusted about image bytes.
   */
  uploadStepImage: async (sheetId: number, stepId: number, file: File) => {
    const form = new FormData();
    form.append("image", file);
    const response = await fetch(
      `/api/admin/comida/technical-sheets/${sheetId}/steps/${stepId}/image`,
      { method: "POST", credentials: "include", body: form },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      throw new Error(body.message || "No se pudo subir la imagen");
    }
    return body as { imageUrl: string };
  },
  /** Queues AI work; the result arrives over the socket, not from this call. */
  createStepImageJob: (
    sheetId: number,
    stepId: number,
    input: { mode: "AI_ENHANCE" | "AI_GENERATE"; prompt?: string; idempotencyKey?: string },
  ) =>
    request<{ jobId: number; reused?: boolean }>(
      `/comida/technical-sheets/${sheetId}/steps/${stepId}/image-jobs`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  reorderSteps: (sheetId: number, stepIds: number[]) =>
    request<Record<string, never>>(`/comida/technical-sheets/${sheetId}/steps/order`, {
      method: "PUT",
      body: JSON.stringify({ stepIds }),
    }),
  cost: (sheetId: number) =>
    request<{ cost: SheetCost }>(`/comida/technical-sheets/${sheetId}/cost`),
  allergens: (sheetId: number) =>
    request<SheetAllergens>(`/comida/technical-sheets/${sheetId}/allergens`),
  patchAllergens: (sheetId: number, input: { added?: string[]; disabled?: string[] }) =>
    request<SheetAllergens>(`/comida/technical-sheets/${sheetId}/allergens`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  /**
   * `source` selects the catalogue: wine lives in its own table keyed by `num`,
   * everything else is a comida_items row.
   */
  setProductionType: (
    itemId: number,
    productionType: "RAW" | "MANUFACTURED",
    stockRecipeId?: number,
    source?: "comida" | "vinos" | "postres",
  ) =>
    request<Record<string, never>>(`/comida/items/${itemId}/production-type`, {
      method: "PATCH",
      body: JSON.stringify({
        productionType,
        stockRecipeId: stockRecipeId ?? null,
        source: source ?? "comida",
      }),
    }),
};
