import { createPOSModule } from "./modules/pos";
import type {
  APIError,
  APISuccess,
  Booking,
  CancelledBookingItem,
  ModifiedBookingItem,
  BOSession,
  ConfigDefaults,
  ConfigDailyLimit,
  ConfigDayStatus,
  ConfigDayRangeResult,
  ConfigMesasDeDos,
  ConfigMesasDeTres,
  ConfigFloor,
  ConfigOpeningHours,
  ConfigSalonCondesa,
  TableMapArea,
  TableMapItem,
  WeekdayOpen,
  DashboardMetrics,
  InvoiceDashboardMetrics,
  HorariosCalendarResponse,
  CalendarDay,
  DishCatalogItem,
  GroupMenu,
  GroupMenuV2,
  MenuSlider,
  MenuSliderImage,
  SliderMode,
  GroupMenuV2Dish,
  GroupMenuV2Section,
  GroupMenuV2Summary,
  GroupMenuSummary,
  HorarioMonthPoint,
  FichajeActiveEntry,
  FichajeHourlyCost,
  FichajePosRevenue,
  FichajePosSeriesPoint,
  FichajeSchedule,
  FichajeState,
  TimeEntry,
  Member,
  MemberCompensation,
  MemberCompensationInput,
  LabourCostReport,
  DeliveryAttempt,
  MemberInvitationPreview,
  InvitationOnboardingMember,
  PasswordResetPreview,
  MemberStats,
  MemberStatsTableRow,
  MemberTimeBalance,
  MemberYearStats,
  MenuDish,
  MenuTable,
  MenuVisibilityItem,
  FoodCategory,
  FoodItem,
  Postre,
  RoleCatalogItem,
  RoleCurrentUser,
  RoleUserItem,
  RestaurantBranding,
  RestaurantIntegrations,
  RestaurantInvoiceSettings,
  RestaurantWebsiteMenuTemplatesConfig,
  MenuTemplateType,
  Vino,
  InvoiceTemplate,
  InvoiceTemplateInput,
  ReminderTemplate,
  ReminderTemplateInput,
  ReminderSettings,
  InvoiceReminder,
  SendReminderInput,
  MenuSelectorItem,
  LegalPage,
  LegalPageListResponse,
  LegalPageSlug,
  LegalPageUpsertRequest,
  POSBootstrap,
  POSSettings,
  POSTicket,
  AnalyticsOverview,
  AnalyticsOverviewParams,
  AnalyticsRefreshRequest,
  AnalyticsRefreshResponse,
} from "./types";
import type { BORole } from "../lib/rbac";
import { emitSessionExpired, emitSessionExpirationUpdate } from "../lib/session-expiration";

type ClientOpts = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  cookieHeader?: string;
  timeoutMs?: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

// Session-persistent correlation id, shared with the group-menu AI websocket so
// browser calls, backend checkpoints and DB writes can be joined for one session.
// Coordination id: bo_correlation_id_v1 (browser -> x-correlation-id -> backend logCheckpoint)
export function currentCorrelationId(): string {
  if (!isBrowser()) return "";
  try {
    const existing = window.sessionStorage.getItem("vcCorrelationId");
    if (existing) return existing;
    const minted = `bo-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.sessionStorage.setItem("vcCorrelationId", minted);
    return minted;
  } catch {
    return "";
  }
}

async function readJSON(res: Response): Promise<any> {
  const txt = await res.text();
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

export function createClient(opts: ClientOpts = { baseUrl: "" }) {
  const normalizedOpts: ClientOpts = {
    baseUrl: opts?.baseUrl ?? "",
    fetchImpl: opts?.fetchImpl,
    cookieHeader: opts?.cookieHeader,
    timeoutMs: opts?.timeoutMs ?? (isBrowser() ? 0 : 8_000),
  };
  const fetchImpl = normalizedOpts.fetchImpl ?? fetch;
  const baseUrl = normalizedOpts.baseUrl.replace(/\/+$/, "");

  function normalizeAdminPath(path: string): string {
    if (path === "/admin") return "/api/admin";
    if (path.startsWith("/admin/")) return `/api${path}`;
    return path;
  }

  async function apiFetch(path: string, init: RequestInit): Promise<Response> {
    const url = baseUrl + normalizeAdminPath(path);
    const headers = new Headers(init.headers ?? {});

    if (!isBrowser()) {
      if (normalizedOpts.cookieHeader) headers.set("cookie", normalizedOpts.cookieHeader);
    } else if (!headers.has("x-correlation-id")) {
      const cid = currentCorrelationId();
      if (cid) headers.set("x-correlation-id", cid);
    }
    // Browser: always include cookies (same-origin via /api proxy).
    const withCreds = isBrowser() ? { credentials: "include" as RequestCredentials } : {};

    return fetchImpl(url, {
      ...init,
      ...withCreds,
      headers,
      signal: init.signal ?? ((normalizedOpts.timeoutMs ?? 0) > 0 ? AbortSignal.timeout(normalizedOpts.timeoutMs!) : undefined),
    });
  }

  async function json<T>(path: string, init: RequestInit): Promise<T> {
    const res = await apiFetch(path, init);
    const data = await readJSON(res);
    emitSessionExpirationUpdate((data as any)?.moving_expiration_date ?? res.headers.get("x-moving-expiration-date"));
    if (res.status === 401) {
      emitSessionExpired();
    }
    if (!res.ok) {
      const msg = data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  }

  async function jsonWithFallback<T>(paths: string[], init: RequestInit): Promise<T> {
    let lastError: Error | null = null;
    for (const path of paths) {
      try {
        return await json<T>(path, init);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Unknown error");
      }
    }
    throw (lastError ?? new Error("No endpoint available"));
  }

  function withQuery(path: string, params?: Record<string, string | number | boolean | null | undefined>): string {
    if (!params) return path;
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === "") continue;
      q.set(key, String(value));
    }
    const qs = q.toString();
    return qs ? `${path}?${qs}` : path;
  }

  type ComidaListParams = {
    tipo?: string;
    active?: number;
    search?: string;
    q?: string;
    page?: number;
    limit?: number;
    pageSize?: number;
    categoria?: string;
    category?: string;
    alergeno?: string;
    suplemento?: number;
  };

  type ComidaWriteInput = {
    tipo?: string;
    nombre: string;
    precio: number;
    descripcion?: string;
    titulo?: string;
    suplemento?: number;
    alergenos?: string[];
    active?: boolean;
    imageBase64?: string;
    categoria?: string;
    category?: string;
    category_id?: number | null;
  };

  type ComidaPatchInput = Partial<{
    tipo: string;
    nombre: string;
    precio: number;
    descripcion: string;
    titulo: string;
    suplemento: number;
    alergenos: string[];
    active: boolean;
    imageBase64: string;
    categoria: string;
    category: string;
    category_id: number | null;
  }>;

  type FallbackComidaCategory = "platos" | "bebidas" | "cafes";

  function parseEmbeddedPrice(v: string): number {
    const m = v.match(/(\d+(?:[.,]\d{1,2})?)\s*€/);
    if (!m || !m[1]) return 0;
    const n = Number(m[1].replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeMenuTipo(v: string | undefined, fallback: "ENTRANTE" | "PRINCIPAL" | "ARROZ" = "PRINCIPAL"): string {
    const raw = String(v ?? "").trim().toUpperCase();
    if (raw === "ENTRANTE" || raw === "PRINCIPAL" || raw === "ARROZ") return raw;
    if (raw.includes("ENTRANTE")) return "ENTRANTE";
    if (raw.includes("ARROZ")) return "ARROZ";
    return fallback;
  }

  function normalizedComidaText(v: string): string {
    return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  const CAFE_TYPE_HINTS = new Set(["CAFE", "CAFEES", "CAFES", "INFUSION", "INFUSIONES", "CHOCOLATE", "TE"]);
  const BEBIDA_TYPE_HINTS = new Set([
    "BEBIDA",
    "BEBIDAS",
    "REFRESCO",
    "REFRESCOS",
    "AGUA",
    "ZUMO",
    "ZUMOS",
    "CERVEZA",
    "CERVEZAS",
    "COPA",
    "COPAS",
  ]);
  const CAFE_TEXT_HINTS = ["cafe", "cafes", "espresso", "capuccino", "cappuccino", "infusion", "te", "chocolate caliente"];
  const BEBIDA_TEXT_HINTS = [
    "bebida",
    "refresco",
    "agua",
    "zumo",
    "cerveza",
    "copa",
    "coctel",
    "cocktail",
    "tinto de verano",
    "sangria",
    "vermut",
  ];

  function includesAnyHint(haystack: string, hints: string[]): boolean {
    // Match hints as whole words only. A substring match (e.g. "te" inside
    // "tomate"/"teriyaki") wrongly reclassified many platos as cafes/bebidas.
    return hints.some((hint) => {
      const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
    });
  }

  function classifyFallbackFoodItem(item: FoodItem): FallbackComidaCategory {
    const tipoUpper = String(item.tipo ?? "").trim().toUpperCase();
    if (CAFE_TYPE_HINTS.has(tipoUpper)) return "cafes";
    if (BEBIDA_TYPE_HINTS.has(tipoUpper)) return "bebidas";

    const text = normalizedComidaText(`${item.tipo ?? ""} ${item.nombre ?? ""} ${item.descripcion ?? ""}`);
    if (includesAnyHint(text, CAFE_TEXT_HINTS)) return "cafes";
    if (includesAnyHint(text, BEBIDA_TEXT_HINTS)) return "bebidas";
    return "platos";
  }

  function mapMenuDishToFoodItem(dish: MenuDish): FoodItem {
    const descripcion = String(dish.descripcion ?? "").trim();
    const price = parseEmbeddedPrice(descripcion);
    return {
      num: dish.num,
      tipo: String(dish.tipo ?? "").trim() || "PRINCIPAL",
      nombre: descripcion,
      precio: price,
      descripcion,
      titulo: "",
      suplemento: 0,
      alergenos: Array.isArray(dish.alergenos) ? dish.alergenos : [],
      active: !!dish.active,
      has_foto: false,
    };
  }

  function applyComidaFilters(items: FoodItem[], params?: ComidaListParams): FoodItem[] {
    if (!params) return items;
    const searchQ = String(params.search ?? params.q ?? "").trim().toLowerCase();
    const tipoQ = String(params.tipo ?? "").trim().toLowerCase();
    const activeQ = params.active;

    return items.filter((item) => {
      if (tipoQ && String(item.tipo ?? "").toLowerCase() !== tipoQ) return false;
      if (activeQ === 0 && item.active) return false;
      if (activeQ === 1 && !item.active) return false;
      if (searchQ) {
        const haystack = `${item.nombre} ${item.descripcion}`.toLowerCase();
        if (!haystack.includes(searchQ)) return false;
      }
      return true;
    });
  }

  function normalizeComidaListParams(params?: ComidaListParams): ComidaListParams | undefined {
    if (!params) return undefined;
    const next: ComidaListParams = { ...params };
    if (!next.search && typeof next.q === "string" && next.q.trim() !== "") {
      next.search = next.q;
    }
    if (!next.limit && typeof next.pageSize === "number" && Number.isFinite(next.pageSize) && next.pageSize > 0) {
      next.limit = next.pageSize;
    }
    return next;
  }

  // Fetch a single comida catalog item via the dedicated detail endpoint.
  // Regression: get() methods used to list(limit:500) and filter client-side.
  async function getComidaItem<T extends Record<string, unknown>>(basePath: string, id: number): Promise<APISuccess<T> | APIError> {
    const res = await json<APISuccess<T> | APIError>(`${basePath}/${id}`, { method: "GET" });
    if (!res.success) return res;
    return res as APISuccess<T>;
  }

  async function listComidaWithFallback(
    primaryPath: string,
    fallbackMenuPath: "/api/admin/menus/dia" | "/api/admin/menus/finde",
    params?: ComidaListParams,
    skipPrimary = false,
    fallbackCategory?: FallbackComidaCategory,
  ): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> {
    const fromFallback = async (): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> => {
      const fallbackRes = await json<APISuccess<{ menu: MenuTable }> | APIError>(fallbackMenuPath, { method: "GET" });
      if (!fallbackRes.success) return fallbackRes;

      const dishes = Array.isArray(fallbackRes.menu?.dishes)
        ? fallbackRes.menu.dishes.filter((dish) => String(dish.tipo ?? "").toUpperCase() !== "PRECIO")
        : [];
      let mappedItems = dishes.map(mapMenuDishToFoodItem);
      if (fallbackCategory) {
        mappedItems = mappedItems.filter((item) => classifyFallbackFoodItem(item) === fallbackCategory);
      }
      const items = applyComidaFilters(mappedItems, params);
      return {
        success: true,
        items,
        total: items.length,
        page: 1,
        limit: items.length,
      };
    };

    if (skipPrimary) return fromFallback();
    try {
      return await json(withQuery(primaryPath, params), { method: "GET" });
    } catch {
      return fromFallback();
    }
  }

  async function createComidaWithFallback(
    primaryPath: string,
    fallbackCreatePath: "/api/admin/menus/dia/dishes" | "/api/admin/menus/finde/dishes",
    input: ComidaWriteInput,
    fallbackTipo: "ENTRANTE" | "PRINCIPAL" | "ARROZ" = "PRINCIPAL",
    skipPrimary = false,
  ): Promise<APISuccess<{ num: number }> | APIError> {
    const fromFallback = async (): Promise<APISuccess<{ num: number }> | APIError> => {
      const descripcion = String(input.descripcion ?? input.nombre ?? "").trim();
      const fallbackRes = await json<APISuccess<{ dish: MenuDish }> | APIError>(fallbackCreatePath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tipo: normalizeMenuTipo(input.tipo, fallbackTipo),
          descripcion,
          alergenos: input.alergenos ?? [],
          active: input.active ?? true,
        }),
      });
      if (!fallbackRes.success) return fallbackRes;
      return { success: true, num: fallbackRes.dish.num };
    };

    if (skipPrimary) return fromFallback();
    try {
      return await json(primaryPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      return fromFallback();
    }
  }

  async function patchComidaWithFallback(
    primaryPath: string,
    fallbackPatchPath: string,
    patch: ComidaPatchInput,
    fallbackTipo: "ENTRANTE" | "PRINCIPAL" | "ARROZ" = "PRINCIPAL",
    skipPrimary = false,
  ): Promise<APISuccess | APIError> {
    const fromFallback = async (): Promise<APISuccess | APIError> => {
      const fallbackPatch: Partial<Pick<MenuDish, "tipo" | "descripcion" | "active">> & { alergenos?: string[] } = {};
      if (patch.tipo !== undefined) fallbackPatch.tipo = normalizeMenuTipo(patch.tipo, fallbackTipo);
      const fallbackDesc = String(patch.descripcion ?? patch.nombre ?? "").trim();
      if (fallbackDesc) fallbackPatch.descripcion = fallbackDesc;
      if (patch.alergenos !== undefined) fallbackPatch.alergenos = patch.alergenos;
      if (patch.active !== undefined) fallbackPatch.active = patch.active;

      if (Object.keys(fallbackPatch).length === 0) return { success: true } as APISuccess;
      return json(fallbackPatchPath, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fallbackPatch),
      });
    };

    if (skipPrimary) return fromFallback();
    try {
      return await json(primaryPath, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      return fromFallback();
    }
  }

  async function deleteComidaWithFallback(primaryPath: string, fallbackDeletePath: string, skipPrimary = false): Promise<APISuccess | APIError> {
    if (skipPrimary) return json(fallbackDeletePath, { method: "DELETE" });
    try {
      return await json(primaryPath, { method: "DELETE" });
    } catch {
      return json(fallbackDeletePath, { method: "DELETE" });
    }
  }

  async function toggleComidaWithFallback(
    primaryPath: string,
    fallbackPatchPath: string,
    active: boolean,
    skipPrimary = false,
  ): Promise<APISuccess<{ active: boolean }> | APIError> {
    const fromFallback = async (): Promise<APISuccess<{ active: boolean }> | APIError> => {
      const fallbackRes = await json<APISuccess | APIError>(fallbackPatchPath, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!fallbackRes.success) return fallbackRes;
      return { success: true, active };
    };

    if (skipPrimary) return fromFallback();
    try {
      return await json(primaryPath, { method: "POST" });
    } catch {
      return fromFallback();
    }
  }

  const comidaApi = {
    async counts(): Promise<APISuccess<{ countsByType: Record<"vinos" | "cafes" | "postres" | "platos" | "bebidas", number> }> | APIError> {
      return json("/api/admin/comida/counts", { method: "GET" });
    },
    // Whether the AI image config is fully usable (activation + key + i2i model).
    async aiImageStatus(): Promise<APISuccess<{ valid: boolean }> | APIError> {
      return json("/api/admin/comida/ai-image/status", { method: "GET" });
    },
    postres: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ postres: Postre[]; total?: number; page?: number; limit?: number }> | APIError> {
        return json(withQuery("/api/admin/postres", normalizeComidaListParams(params)), { method: "GET" });
      },
      async create(input: { descripcion: string; alergenos: string[]; active?: boolean; precio?: number }): Promise<APISuccess<{ postre: Postre }> | APIError> {
        return json("/api/admin/postres", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async patch(id: number, patch: Partial<Pick<Postre, "descripcion" | "active" | "precio">> & { alergenos?: string[] }): Promise<APISuccess | APIError> {
        return json(`/api/admin/postres/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/postres/${id}`, { method: "DELETE" });
      },
      async toggle(id: number, active: boolean): Promise<APISuccess | APIError> {
        return json(`/api/admin/postres/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active }),
        });
      },
      async get(id: number): Promise<APISuccess<{ postre: Postre; item?: FoodItem }> | APIError> {
        const res = await getComidaItem<{ postre: Postre }>("/api/admin/comida/postres", id);
        if (!res.success) return res;
        const postre = res.postre;
        const item: FoodItem = {
          num: postre.num,
          tipo: "POSTRE",
          nombre: postre.descripcion,
          precio: Number(postre.precio ?? 0),
          descripcion: postre.descripcion,
          titulo: "",
          suplemento: 0,
          alergenos: Array.isArray(postre.alergenos) ? postre.alergenos : [],
          active: !!postre.active,
          has_foto: false,
        };
        return { success: true, postre, item };
      },
    },
    vinos: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ vinos: Vino[]; total?: number; page?: number; limit?: number }> | APIError> {
        return json(withQuery("/api/admin/vinos", normalizeComidaListParams(params)), { method: "GET" });
      },
      async create(input: {
        tipo: string;
        nombre: string;
        precio: number;
        descripcion?: string;
        bodega: string;
        denominacion_origen?: string;
        graduacion?: number;
        anyo?: string;
        active?: boolean;
        imageBase64?: string;
      }): Promise<APISuccess<{ num: number }> | APIError> {
        return json("/api/admin/vinos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async patch(
        id: number,
        patch: Partial<{
          tipo: string;
          nombre: string;
          precio: number;
          descripcion: string;
          bodega: string;
          denominacion_origen: string;
          graduacion: number;
          anyo: string;
          active: boolean;
          imageBase64: string;
        }>,
      ): Promise<APISuccess | APIError> {
        return json(`/api/admin/vinos/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/vinos/${id}`, { method: "DELETE" });
      },
      async toggle(id: number, active: boolean): Promise<APISuccess | APIError> {
        return json(`/api/admin/vinos/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active }),
        });
      },
      async get(id: number): Promise<APISuccess<{ vino: Vino; item?: Vino }> | APIError> {
        const res = await getComidaItem<{ vino: Vino }>("/api/admin/comida/vinos", id);
        if (!res.success) return res;
        const vino = res.vino;
        return { success: true, vino, item: vino };
      },
      async getSingle(id: number): Promise<APISuccess<{ vino: Vino }> | APIError> {
        return json(`/api/admin/vinos/${id}`, { method: "GET" });
      },
      async uploadImage(id: number, file: File): Promise<APISuccess<{ foto_url: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "wine-image.webp");
        return json(`/api/admin/vinos/${id}/image`, { method: "POST", body: form });
      },
      async uploadImageAI(id: number, file: File): Promise<APISuccess<{ wine_num: number; message?: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "wine-ai.webp");
        return json(`/api/admin/vinos/${id}/image/ai`, { method: "POST", body: form });
      },
    },
    cafes: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> {
        return json(withQuery("/api/admin/cafes", normalizeComidaListParams(params)), { method: "GET" });
      },
      async create(input: ComidaWriteInput): Promise<APISuccess<{ num: number }> | APIError> {
        return json("/api/admin/cafes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async patch(id: number, patch: ComidaPatchInput): Promise<APISuccess | APIError> {
        return json(`/api/admin/cafes/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/cafes/${id}`, { method: "DELETE" });
      },
      async toggle(id: number, active = true): Promise<APISuccess<{ active: boolean }> | APIError> {
        return json(`/api/admin/cafes/${id}/toggle`, { method: "POST" });
      },
      async get(id: number): Promise<APISuccess<{ item: FoodItem }> | APIError> {
        return json(`/api/admin/comida/cafes/${id}`, { method: "GET" });
      },
      async uploadImageAI(id: number, file: File): Promise<APISuccess<{ item_id: number; message?: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "comida-ai.webp");
        return json(`/api/admin/comida/cafes/${id}/image/ai`, { method: "POST", body: form });
      },
      async uploadImage(id: number, file: File): Promise<APISuccess<{ foto_url: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "cafe-image.webp");
        return json(`/api/admin/comida/cafes/${id}/image`, { method: "POST", body: form });
      },
    },
    bebidas: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> {
        return json(withQuery("/api/admin/bebidas", normalizeComidaListParams(params)), { method: "GET" });
      },
      async create(input: ComidaWriteInput): Promise<APISuccess<{ num: number }> | APIError> {
        return json("/api/admin/bebidas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async patch(id: number, patch: ComidaPatchInput): Promise<APISuccess | APIError> {
        return json(`/api/admin/bebidas/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/bebidas/${id}`, { method: "DELETE" });
      },
      async toggle(id: number, active = true): Promise<APISuccess<{ active: boolean }> | APIError> {
        return json(`/api/admin/bebidas/${id}/toggle`, { method: "POST" });
      },
      async get(id: number): Promise<APISuccess<{ item: FoodItem }> | APIError> {
        return getComidaItem<{ item: FoodItem }>("/api/admin/comida/bebidas", id);
      },
      async uploadImageAI(id: number, file: File): Promise<APISuccess<{ item_id: number; message?: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "comida-ai.webp");
        return json(`/api/admin/comida/bebidas/${id}/image/ai`, { method: "POST", body: form });
      },
      async uploadImage(id: number, file: File): Promise<APISuccess<{ foto_url: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "bebida-image.webp");
        return json(`/api/admin/comida/bebidas/${id}/image`, { method: "POST", body: form });
      },
      categories: {
        async list(): Promise<APISuccess<{ categories: FoodCategory[] }> | APIError> {
          return jsonWithFallback(
            ["/api/admin/comida/bebidas/categorias"],
            { method: "GET" },
          );
        },
        async create(input: { name: string; slug?: string }): Promise<APISuccess<{ category: FoodCategory }> | APIError> {
          return jsonWithFallback(
            ["/api/admin/comida/bebidas/categorias"],
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: input.name,
                label: input.name,
                slug: input.slug,
              }),
            },
          );
        },
        async checkName(name: string): Promise<APISuccess<{ exists: boolean }> | APIError> {
          return json(`/api/admin/comida/bebidas/categorias/check?name=${encodeURIComponent(name)}`, { method: "GET" });
        },
      },
    },
    platos: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> {
        return listComidaWithFallback("/api/admin/platos", "/api/admin/menus/dia", params, false, "platos");
      },
      async create(input: ComidaWriteInput): Promise<APISuccess<{ num: number }> | APIError> {
        return createComidaWithFallback("/api/admin/platos", "/api/admin/menus/dia/dishes", input, "PRINCIPAL", false);
      },
      async patch(id: number, patch: ComidaPatchInput): Promise<APISuccess | APIError> {
        return patchComidaWithFallback(`/api/admin/platos/${id}`, `/api/admin/menus/dia/dishes/${id}`, patch, "PRINCIPAL", false);
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return deleteComidaWithFallback(`/api/admin/platos/${id}`, `/api/admin/menus/dia/dishes/${id}`, false);
      },
      async toggle(id: number, active = true): Promise<APISuccess<{ active: boolean }> | APIError> {
        return toggleComidaWithFallback(`/api/admin/platos/${id}/toggle`, `/api/admin/menus/dia/dishes/${id}`, active, false);
      },
      async get(id: number): Promise<APISuccess<{ item: FoodItem }> | APIError> {
        return getComidaItem<{ item: FoodItem }>("/api/admin/comida/platos", id);
      },
      async uploadImageAI(id: number, file: File): Promise<APISuccess<{ item_id: number; message?: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "comida-ai.webp");
        return json(`/api/admin/comida/platos/${id}/image/ai`, { method: "POST", body: form });
      },
      async uploadImage(id: number, file: File): Promise<APISuccess<{ foto_url: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "plato-image.webp");
        return json(`/api/admin/comida/platos/${id}/image`, { method: "POST", body: form });
      },
      categories: {
        async list(): Promise<APISuccess<{ categories: FoodCategory[] }> | APIError> {
          return jsonWithFallback(
            ["/api/admin/comida/platos/categorias", "/api/admin/comida/platos/categories", "/api/admin/platos/categorias"],
            { method: "GET" },
          );
        },
        async create(input: { name: string; slug?: string }): Promise<APISuccess<{ category: FoodCategory }> | APIError> {
          return jsonWithFallback(
            ["/api/admin/comida/platos/categorias", "/api/admin/comida/platos/categories", "/api/admin/platos/categorias"],
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: input.name,
                label: input.name,
                slug: input.slug,
              }),
            },
          );
        },
      },
    },
  };

  return {
    request: async <T = any>(path: string, init: RequestInit): Promise<T> => {
      return json<T>(path, init);
    },
    auth: {
      async login(identifier: string, password: string): Promise<APISuccess<{ session: BOSession }> | APIError> {
        return json("/api/admin/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier, email: identifier, password }),
        });
      },
      async logout(): Promise<APISuccess | APIError> {
        return json("/api/admin/logout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      },
      async me(): Promise<APISuccess<{ session: BOSession }> | APIError> {
        return json("/api/admin/me", { method: "GET" });
      },
      async setPassword(password: string, confirmPassword: string): Promise<APISuccess | APIError> {
        return json("/api/admin/me/password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password, confirmPassword }),
        });
      },
      async setActiveRestaurant(
        restaurantId: number,
      ): Promise<APISuccess<{ activeRestaurantId: number; role: BORole; roleImportance: number; sectionAccess: string[] }> | APIError> {
        return json("/api/admin/active-restaurant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restaurantId }),
        });
      },
      async setPreference(
        key: string,
        value: string,
      ): Promise<APISuccess<{ preferences: Record<string, string> }> | APIError> {
        return json("/api/admin/me/preferences", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
      },
    },
    dashboard: {
      async getMetrics(date: string): Promise<APISuccess<{ metrics: DashboardMetrics; invoiceMetrics: InvoiceDashboardMetrics | null }> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/dashboard/metrics?${q.toString()}`, { method: "GET" });
      },
    },
    analytics: {
      async getOverview(params: AnalyticsOverviewParams): Promise<AnalyticsOverview | APIError> {
        const q = new URLSearchParams({ from: params.from, to: params.to, granularity: params.granularity });
        if (params.compare) q.set("compare", params.compare);
        return json(`/api/admin/analytics/overview?${q.toString()}`, { method: "GET" });
      },
      async refresh(params: AnalyticsRefreshRequest): Promise<AnalyticsRefreshResponse> {
        return json("/api/admin/analytics/refresh", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(params),
        });
      },
    },
    calendar: {
      async getMonth(params: { year: number; month: number }): Promise<APISuccess<{ data: CalendarDay[] }> | APIError> {
        const q = new URLSearchParams({ year: String(params.year), month: String(params.month) });
        return json(`/api/admin/calendar?${q.toString()}`, { method: "GET" });
      },
    },
    reservas: {
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
        const q = new URLSearchParams({ date });
        return json(`/api/admin/bookings/export?${q.toString()}`, { method: "GET" });
      },
      async get(id: number): Promise<APISuccess<{ booking: Booking }> | APIError> {
        return json(`/api/admin/bookings/${id}`, { method: "GET" });
      },
      async create(input: any): Promise<APISuccess<{ booking: Booking }> | APIError> {
        return json(`/api/admin/bookings`, {
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
        name?: string;
        phone?: string;
        page?: number;
        count?: number;
      }): Promise<
        APISuccess<{ bookings: Booking[]; floors?: ConfigFloor[]; total_count: number; total: number; page: number; count: number }> | APIError
      > {
        const q = new URLSearchParams();
        if (params.name) q.set("name", params.name);
        if (params.phone) q.set("phone", params.phone);
        if (params.page !== undefined) q.set("page", String(params.page));
        if (params.count !== undefined) q.set("count", String(params.count));
        return json(`/api/admin/bookings/search?${q.toString()}`, { method: "GET" });
      },
      async cancelledByDate(date: string): Promise<
        APISuccess<{ staff: CancelledBookingItem[]; customer: CancelledBookingItem[]; whatsapp: CancelledBookingItem[]; total: number }> | APIError
      > {
        return json(`/api/admin/bookings/cancelled?date=${encodeURIComponent(date)}`, { method: "GET" });
      },
      async modifiedByDate(date: string): Promise<
        APISuccess<{ staff: ModifiedBookingItem[]; customer: ModifiedBookingItem[]; whatsapp: ModifiedBookingItem[]; total: number }> | APIError
      > {
        return json(`/api/admin/bookings/modified?date=${encodeURIComponent(date)}`, { method: "GET" });
      },
      async reactivateCancelled(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/bookings/cancelled/${id}/reactivate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      },
    },
    tables: {
      async list(params?: { date?: string; floor_number?: number }): Promise<APISuccess<{ data: TableMapArea[]; areas: TableMapArea[]; tables: TableMapItem[]; layout?: Record<string, unknown> }> | APIError> {
        const q = new URLSearchParams();
        if (params?.date) q.set("date", params.date);
        if (typeof params?.floor_number === "number") q.set("floor_number", String(params.floor_number));
        const suffix = q.toString();
        return json(`/api/admin/tables${suffix ? `?${suffix}` : ""}`, { method: "GET" });
      },
      async create(input: Partial<TableMapItem> & { entity?: "table" | "area"; area_id?: number; name?: string; date?: string; floor_number?: number }): Promise<APISuccess<{ item: any; table?: TableMapItem; entity: string }> | APIError> {
        return json("/api/admin/tables", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async update(input: Partial<TableMapItem> & { id?: number; entity?: "table" | "area" | "layout"; area_id?: number; name?: string; date?: string; floor_number?: number; metadata?: Record<string, unknown> }): Promise<APISuccess<{ item?: any; table?: TableMapItem; entity: string; layout?: Record<string, unknown> }> | APIError> {
        return json("/api/admin/tables", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async delete(id: number): Promise<APISuccess<{ id: number; entity: string }> | APIError> {
        return json(`/api/admin/tables/${id}`, { method: "DELETE" });
      },
      async saveLayout(input: { date: string; floor_number: number; metadata: Record<string, unknown> }): Promise<APISuccess<{ entity: "layout"; layout: Record<string, unknown> }> | APIError> {
        return json("/api/admin/tables", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entity: "layout", ...input }),
        });
      },
      async uploadTextureImage(id: number, file: File): Promise<APISuccess<{ id: number; imageUrl: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "table-texture.webp");
        return json(`/api/admin/tables/${id}/texture-image`, {
          method: "POST",
          body: form,
        });
      },
      async getTemplate(floorNumber: number): Promise<
        | (APISuccess<{
            entity: "template";
            floor_number: number;
            has_template: boolean;
            template: { limit_area_template_points?: Array<{ x: number; y: number }>; draw_elements_template?: Array<Record<string, unknown>>; [k: string]: unknown };
            scope: "template" | "day";
          }>)
        | APIError
      > {
        return json(`/api/admin/tables/template/${floorNumber}`, { method: "GET" });
      },
      async saveTemplate(
        floorNumber: number,
        payload: {
          data?: Record<string, unknown>;
          template?: Record<string, unknown>;
          limit_points?: Array<{ x: number; y: number }>;
          elements?: Array<Record<string, unknown>>;
        },
      ): Promise<
        | (APISuccess<{
            entity: "template";
            floor_number: number;
            template: Record<string, unknown>;
            scope: "template" | "day";
          }>)
        | APIError
      > {
        return json(`/api/admin/tables/template/${floorNumber}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      },
      async deleteTemplate(
        floorNumber: number,
      ): Promise<
        | (APISuccess<{
            entity: "template";
            floor_number: number;
            template: Record<string, unknown>;
            has_template: false;
            scope: "day";
          }>)
        | APIError
      > {
        return json(`/api/admin/tables/template/${floorNumber}`, { method: "DELETE" });
      },
    },
    arrozTypes: {
      async list(): Promise<string[]> {
        return json(`/api/admin/arroz-types`, { method: "GET" });
      },
    },
    settings: {
      async getIntegrations(): Promise<APISuccess<{ integrations: RestaurantIntegrations }> | APIError> {
        return json("/api/admin/integrations", { method: "GET" });
      },
      async setIntegrations(integrations: RestaurantIntegrations): Promise<APISuccess<{ integrations: RestaurantIntegrations }> | APIError> {
        return json("/api/admin/integrations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(integrations),
        });
      },
      async getBranding(): Promise<APISuccess<{ branding: RestaurantBranding }> | APIError> {
        return json("/api/admin/branding", { method: "GET" });
      },
      async setBranding(branding: RestaurantBranding): Promise<APISuccess<{ branding: RestaurantBranding }> | APIError> {
        return json("/api/admin/branding", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(branding),
        });
      },
      async uploadBrandingLogo(file: File): Promise<APISuccess<{ logoUrl: string }> | APIError> {
        const form = new FormData();
        form.append("image", file, file.name || "logo.webp");
        return json("/api/admin/branding/logo", {
          method: "POST",
          body: form,
        });
      },
      async getInvoiceSettings(): Promise<APISuccess<{ settings: RestaurantInvoiceSettings }> | APIError> {
        return json("/api/admin/invoices/settings", { method: "GET" });
      },
      async setInvoiceSettings(settings: RestaurantInvoiceSettings): Promise<APISuccess<{ settings: RestaurantInvoiceSettings }> | APIError> {
        return json("/api/admin/invoices/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(settings),
        });
      },
      async getWebsiteMenuTemplates(): Promise<APISuccess<RestaurantWebsiteMenuTemplatesConfig> | APIError> {
        return json("/api/admin/website/menu-templates", { method: "GET" });
      },
      async setWebsiteMenuTemplates(input: {
        default_theme_id: string;
        overrides: Partial<Record<MenuTemplateType, string>>;
      }): Promise<APISuccess<RestaurantWebsiteMenuTemplatesConfig> | APIError> {
        return json("/api/admin/website/menu-templates", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async getPageVisibility(): Promise<APISuccess<{ cafe_page_active: boolean; bebidas_page_active: boolean }> | APIError> {
        return json("/api/admin/restaurant/pages/visibility", { method: "GET" });
      },
      async setPageVisibility(input: { cafe_page_active?: boolean; bebidas_page_active?: boolean }): Promise<APISuccess<{ cafe_page_active: boolean; bebidas_page_active: boolean }> | APIError> {
        return json("/api/admin/restaurant/pages/visibility", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
    },
    members: {
      async list(): Promise<APISuccess<{ members: Member[] }> | APIError> {
        return json("/api/admin/members", { method: "GET" });
      },
      async create(input: {
        firstName: string;
        lastName: string;
        roleSlug: string;
        email?: string | null;
        dni?: string | null;
        bankAccount?: string | null;
        phone?: string | null;
        photoUrl?: string | null;
        username?: string | null;
        temporaryPassword?: string | null;
        weeklyContractHours?: number;
      }): Promise<
        APISuccess<{
          member: Member;
          user?: { id: number; email: string; username?: string | null; created: boolean; mustChangePassword?: boolean };
          role?: string;
          invitation?: { created: boolean; expiresAt?: string; delivery?: DeliveryAttempt[] };
          provisioning?: { manualCredentials: boolean; hasContact: boolean; mustChangePassword?: boolean };
        }> | APIError
      > {
        return json("/api/admin/members", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async get(id: number): Promise<APISuccess<{ member: Member }> | APIError> {
        return json(`/api/admin/members/${id}`, { method: "GET" });
      },
      async patch(
        id: number,
        patch: Partial<{
          firstName: string;
          lastName: string;
          email: string | null;
          dni: string | null;
          bankAccount: string | null;
          phone: string | null;
          photoUrl: string | null;
          weeklyContractHours: number;
        }>,
      ): Promise<APISuccess<{ member: Member }> | APIError> {
        return json(`/api/admin/members/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/members/${id}`, { method: "DELETE" });
      },
      async listCompensations(id: number): Promise<APISuccess<{ items: MemberCompensation[] }> | APIError> {
        return json(`/api/admin/members/${id}/compensations`, { method: "GET" });
      },
      async createCompensation(id: number, input: MemberCompensationInput): Promise<APISuccess<{ id: number }> | APIError> {
        return json(`/api/admin/members/${id}/compensations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      },
      async patchCompensation(id: number, compensationId: number, input: MemberCompensationInput): Promise<APISuccess<{ id: number }> | APIError> {
        return json(`/api/admin/members/${id}/compensations/${compensationId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      },
      async deleteCompensation(id: number, compensationId: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/members/${id}/compensations/${compensationId}`, { method: "DELETE" });
      },
      async setPhone(id: number, phone: string): Promise<APISuccess<{ member: Member }> | APIError> {
        return json(`/api/admin/members/${id}/phone`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone }),
        });
      },
      async uploadAvatar(id: number, file: File | Blob): Promise<APISuccess<{ member: Member; avatarUrl: string }> | APIError> {
        const form = new FormData();
        const filename = file instanceof File && file.name ? file.name : "avatar.webp";
        form.append("avatar", file, filename);
        return json(`/api/admin/members/${id}/avatar`, {
          method: "POST",
          body: form,
        });
      },
      async getStats(
        id: number,
        params: { view: "weekly" | "monthly" | "quarterly" | "yearly"; date: string },
      ): Promise<APISuccess<MemberStats> | APIError> {
        const q = new URLSearchParams({ view: params.view, date: params.date });
        return json(`/api/admin/members/${id}/stats?${q.toString()}`, { method: "GET" });
      },
      async getTimeBalance(id: number, date: string): Promise<APISuccess<MemberTimeBalance> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/members/${id}/time-balance?${q.toString()}`, { method: "GET" });
      },
      async getYearStats(
        id: number,
        year: number,
      ): Promise<APISuccess<MemberYearStats> | APIError> {
        const q = new URLSearchParams({ year: String(year) });
        return json(`/api/admin/members/${id}/stats-year?${q.toString()}`, { method: "GET" });
      },
      async getStatsRange(
        id: number,
        params: { from: string; to: string },
      ): Promise<APISuccess<{ rows: MemberStatsTableRow[] }> | APIError> {
        const q = new URLSearchParams({ from: params.from, to: params.to });
        return json(`/api/admin/members/${id}/stats-range?${q.toString()}`, { method: "GET" });
      },
      async getTableData(
        id: number,
        params: { view: "weekly" | "monthly" | "quarterly" | "yearly"; year: number },
      ): Promise<APISuccess<{ rows: MemberStatsTableRow[] }> | APIError> {
        const q = new URLSearchParams({ view: params.view, year: String(params.year) });
        return json(`/api/admin/members/${id}/table-data?${q.toString()}`, { method: "GET" });
      },
      async resendInvitation(
        id: number,
      ): Promise<
        APISuccess<{
          member: { id: number; boUserId: number; username?: string | null };
          invitation: { expiresAt: string; delivery: DeliveryAttempt[] };
        }> | APIError
      > {
        return json(`/api/admin/members/${id}/invitation/resend`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      },
      async sendPasswordReset(
        id: number,
      ): Promise<
        APISuccess<{
          reset: { expiresAt: string; delivery: DeliveryAttempt[] };
        }> | APIError
      > {
        return json(`/api/admin/members/${id}/password-reset/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      },
      // ===== WhatsApp bot connection =====
      async whatsappConnect(
        input: { phone?: string } = {},
      ): Promise<import("./types").WhatsAppConnectionResponse | APIError> {
        return json("/api/admin/members/whatsapp/connect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async whatsappConnection(): Promise<import("./types").WhatsAppConnectionResponse | APIError> {
        return json("/api/admin/members/whatsapp/connection", { method: "GET" });
      },
      async whatsappDisconnect(
        input: { delete_instance?: boolean } = {},
      ): Promise<import("./types").WhatsAppConnectionResponse | APIError> {
        return json("/api/admin/members/whatsapp/disconnect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
    },
    invitations: {
      async validate(token: string): Promise<APISuccess<{ invitation: MemberInvitationPreview }> | APIError> {
        return json("/api/admin/invitations/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
      },
      onboarding: {
        async start(
          token: string,
        ): Promise<APISuccess<{ onboardingGuid: string; member: InvitationOnboardingMember }> | APIError> {
          return json("/api/admin/invitations/onboarding/start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
          });
        },
        async get(
          guid: string,
        ): Promise<APISuccess<{ member: InvitationOnboardingMember; expiresAt: string }> | APIError> {
          return json(`/api/admin/invitations/onboarding/${encodeURIComponent(guid)}`, { method: "GET" });
        },
        async saveProfile(
          guid: string,
          input: { firstName: string; lastName: string; photoUrl?: string | null },
        ): Promise<APISuccess<{ member: Member }> | APIError> {
          return json(`/api/admin/invitations/onboarding/${encodeURIComponent(guid)}/profile`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
        async uploadAvatar(guid: string, file: File | Blob): Promise<APISuccess<{ member: Member; avatarUrl: string }> | APIError> {
          const form = new FormData();
          const filename = file instanceof File && file.name ? file.name : "avatar.webp";
          form.append("avatar", file, filename);
          return json(`/api/admin/invitations/onboarding/${encodeURIComponent(guid)}/avatar`, {
            method: "POST",
            body: form,
          });
        },
        async setPassword(guid: string, password: string, confirmPassword: string): Promise<APISuccess<{ next: string }> | APIError> {
          return json(`/api/admin/invitations/onboarding/${encodeURIComponent(guid)}/password`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password, confirmPassword }),
          });
        },
      },
    },
    passwordResets: {
      async validate(token: string): Promise<APISuccess<{ reset: PasswordResetPreview }> | APIError> {
        return json("/api/admin/password-resets/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
      },
      async confirm(token: string, password: string, confirmPassword: string): Promise<APISuccess<{ next: string }> | APIError> {
        return json("/api/admin/password-resets/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, password, confirmPassword }),
        });
      },
    },
    roles: {
      async list(): Promise<APISuccess<{ roles: RoleCatalogItem[]; users: RoleUserItem[]; currentUser: RoleCurrentUser }> | APIError> {
        return json("/api/admin/roles", { method: "GET" });
      },
      async ensureMemberUser(
        memberId: number,
      ): Promise<APISuccess<{ user: { id: number; email: string; name: string; created: boolean }; member: { id: number; boUserId: number } }> | APIError> {
        return json(`/api/admin/members/${memberId}/ensure-user`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      },
      async create(input: {
        label: string;
        slug?: string;
        importance: number;
        iconKey: string;
        permissions: string[];
      }): Promise<APISuccess<{ role: RoleCatalogItem }> | APIError> {
        return json(`/api/admin/roles`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async setUserRole(userId: number, role: BORole): Promise<APISuccess<{ user: { id: number; role: BORole; roleImportance: number } }> | APIError> {
        return json(`/api/admin/users/${userId}/role`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role }),
        });
      },
      async setUserVersion(userId: number, appVersion: string): Promise<APISuccess<{ user: { id: number; appVersion: string } }> | APIError> {
        return json(`/api/admin/users/${userId}/version`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ appVersion }),
        });
      },
    },
    fichaje: {
      async getLabourCost(params: { from: string; to: string }): Promise<APISuccess<LabourCostReport> | APIError> {
        return json(withQuery("/api/admin/fichaje/labour-cost", params), { method: "GET" });
      },
      async hourlyCosts(params: { date: string }): Promise<APISuccess<{ date: string; members: FichajeHourlyCost[] }> | APIError> {
        return json(withQuery("/api/admin/fichaje/hourly-costs", params), { method: "GET" });
      },
      async getState(): Promise<APISuccess<{ state: FichajeState }> | APIError> {
        return json("/api/admin/fichaje/state", { method: "GET" });
      },
      async start(input: { dni: string; password: string }): Promise<APISuccess<{ state: FichajeState }> | APIError> {
        return json("/api/admin/fichaje/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async stop(): Promise<APISuccess<{ state: FichajeState }> | APIError> {
        return json("/api/admin/fichaje/stop", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      },
      async adminStart(memberId: number): Promise<APISuccess<{ activeEntry: FichajeActiveEntry | null }> | APIError> {
        return json("/api/admin/fichaje/admin/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ memberId }),
        });
      },
      async adminStop(memberId: number): Promise<APISuccess<{ activeEntry: FichajeActiveEntry | null }> | APIError> {
        return json("/api/admin/fichaje/admin/stop", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ memberId }),
        });
      },
      entries: {
        async list(params: { date: string; memberId: number }): Promise<APISuccess<{ date: string; memberId: number; entries: TimeEntry[] }> | APIError> {
          const q = new URLSearchParams({ date: params.date, memberId: String(params.memberId) });
          return json(`/api/admin/fichaje/entries?${q.toString()}`, { method: "GET" });
        },
        async patch(id: number, input: { startTime?: string; endTime?: string }): Promise<APISuccess<{ entry: TimeEntry }> | APIError> {
          return json(`/api/admin/fichaje/entries/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
      },
    },
    horarios: {
      async list(date: string): Promise<APISuccess<{ date: string; schedules: FichajeSchedule[] }> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/horarios?${q.toString()}`, { method: "GET" });
      },
      async month(params: { year: number; month: number }): Promise<APISuccess<{ year: number; month: number; days: HorarioMonthPoint[] }> | APIError> {
        const q = new URLSearchParams({ year: String(params.year), month: String(params.month) });
        return json(`/api/admin/horarios/month?${q.toString()}`, { method: "GET" });
      },
      async calendar(params: { year: number; month: number }): Promise<APISuccess<HorariosCalendarResponse> | APIError> {
        const q = new URLSearchParams({ year: String(params.year), month: String(params.month) });
        return json(`/api/admin/horarios/calendar?${q.toString()}`, { method: "GET" });
      },
      async assign(input: { date: string; memberId: number; startTime: string; endTime: string }): Promise<APISuccess<{ schedule: FichajeSchedule }> | APIError> {
        return json("/api/admin/horarios", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async update(id: number, input: { startTime: string; endTime: string }): Promise<APISuccess<{ schedule: FichajeSchedule }> | APIError> {
        return json(`/api/admin/horarios/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/horarios/${id}`, { method: "DELETE" });
      },
      async getMySchedule(params?: { from?: string; to?: string }): Promise<APISuccess<{ schedules: FichajeSchedule[] }> | APIError> {
        const q = new URLSearchParams();
        if (params?.from) q.set("from", params.from);
        if (params?.to) q.set("to", params.to);
        return json(`/api/admin/horarios/my-schedule?${q.toString()}`, { method: "GET" });
      },
      async listByMemberRange(params: {
        memberId: number;
        from: string;
        to: string;
      }): Promise<APISuccess<{ memberId: number; from: string; to: string; schedules: FichajeSchedule[] }> | APIError> {
        const q = new URLSearchParams();
        q.set("memberId", String(params.memberId));
        q.set("from", params.from);
        q.set("to", params.to);
        return json(`/api/admin/horarios/member-range?${q.toString()}`, { method: "GET" });
      },
    },
    comida: comidaApi,
    menus: {
      visibility: {
        async list(): Promise<APISuccess<{ menus: MenuVisibilityItem[] }> | APIError> {
          return json("/api/admin/menu-visibility", { method: "GET" });
        },
        async set(menuKey: string, isActive: boolean): Promise<APISuccess<{ menuKey: string; isActive: boolean }> | APIError> {
          return json("/api/admin/menu-visibility", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ menuKey, isActive }),
          });
        },
      },
      dia: {
        async get(): Promise<APISuccess<{ menu: MenuTable }> | APIError> {
          return json("/api/admin/menus/dia", { method: "GET" });
        },
        async setPrice(price: string): Promise<APISuccess<{ price: string }> | APIError> {
          return json("/api/admin/menus/dia/price", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ price }),
          });
        },
        async createDish(input: {
          tipo: string;
          descripcion: string;
          alergenos: string[];
          active?: boolean;
        }): Promise<APISuccess<{ dish: MenuDish }> | APIError> {
          return json("/api/admin/menus/dia/dishes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
        async patchDish(id: number, patch: Partial<Pick<MenuDish, "tipo" | "descripcion" | "active">> & { alergenos?: string[] }): Promise<APISuccess | APIError> {
          return json(`/api/admin/menus/dia/dishes/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
          });
        },
        async deleteDish(id: number): Promise<APISuccess | APIError> {
          return json(`/api/admin/menus/dia/dishes/${id}`, { method: "DELETE" });
        },
      },
      finde: {
        async get(): Promise<APISuccess<{ menu: MenuTable }> | APIError> {
          return json("/api/admin/menus/finde", { method: "GET" });
        },
        async setPrice(price: string): Promise<APISuccess<{ price: string }> | APIError> {
          return json("/api/admin/menus/finde/price", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ price }),
          });
        },
        async createDish(input: {
          tipo: string;
          descripcion: string;
          alergenos: string[];
          active?: boolean;
        }): Promise<APISuccess<{ dish: MenuDish }> | APIError> {
          return json("/api/admin/menus/finde/dishes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
        async patchDish(id: number, patch: Partial<Pick<MenuDish, "tipo" | "descripcion" | "active">> & { alergenos?: string[] }): Promise<APISuccess | APIError> {
          return json(`/api/admin/menus/finde/dishes/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
          });
        },
        async deleteDish(id: number): Promise<APISuccess | APIError> {
          return json(`/api/admin/menus/finde/dishes/${id}`, { method: "DELETE" });
        },
      },
      postres: comidaApi.postres,
      vinos: comidaApi.vinos,
      cafes: comidaApi.cafes,
      bebidas: comidaApi.bebidas,
      platos: comidaApi.platos,
      grupos: {
        async list(status?: string): Promise<APISuccess<{ menus: GroupMenuSummary[]; count: number }> | APIError> {
          const q = status ? `?status=${encodeURIComponent(status)}` : "";
          return json(`/api/admin/group-menus${q}`, { method: "GET" });
        },
        async get(id: number): Promise<APISuccess<{ menu: GroupMenu }> | APIError> {
          return json(`/api/admin/group-menus/${id}`, { method: "GET" });
        },
        async create(input: any): Promise<APISuccess<{ menu_id: number; menu_title: string; message: string }> | APIError> {
          return json("/api/admin/group-menus", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
        async update(id: number, input: any): Promise<APISuccess<{ menu_id: number; menu_title: string; message: string }> | APIError> {
          return json(`/api/admin/group-menus/${id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
        async toggle(id: number): Promise<APISuccess<{ menu_id: number; active: boolean }> | APIError> {
          return json(`/api/admin/group-menus/${id}/toggle`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
        },
        async delete(id: number): Promise<APISuccess | APIError> {
          return json(`/api/admin/group-menus/${id}`, { method: "DELETE" });
        },
      },
      gruposV2: {
        async list(includeDrafts = true): Promise<APISuccess<{ menus: GroupMenuV2Summary[]; count: number }> | APIError> {
          const q = new URLSearchParams();
          q.set("includeDrafts", includeDrafts ? "1" : "0");
          return json(`/api/admin/group-menus-v2?${q.toString()}`, { method: "GET" });
        },
        async createDraft(input: { menu_type: string }): Promise<APISuccess<{ menu_id: number }> | APIError> {
          return json("/api/admin/group-menus-v2/drafts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
        async get(id: number): Promise<APISuccess<{ menu: GroupMenuV2 }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}`, { method: "GET" });
        },
        async getSlider(id: number): Promise<APISuccess<{ slider: MenuSlider }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/slider`, { method: "GET" });
        },
        async patchSlider(id: number, mode: SliderMode): Promise<APISuccess<{ mode: SliderMode }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/slider`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode }),
          });
        },
        async uploadSliderImage(id: number, file: File): Promise<APISuccess<{ image: MenuSliderImage }> | APIError> {
          const form = new FormData();
          form.append("image", file, file.name || "slider.webp");
          return json(`/api/admin/group-menus-v2/${id}/slider/images`, { method: "POST", body: form });
        },
        async deleteSliderImage(id: number, imageId: number): Promise<APISuccess | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/slider/images/${imageId}`, { method: "DELETE" });
        },
        async reorderSliderImages(id: number, imageIds: number[]): Promise<APISuccess | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/slider/images`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ image_ids: imageIds }),
          });
        },
        async generateSliderAIImage(id: number, file: File, generationId: string): Promise<APISuccess<{ message?: string; menu_id: number; generation_id: string }> | APIError> {
          const form = new FormData();
          form.append("image", file, file.name || "slider-ai.webp");
          form.append("generation_id", generationId);
          return json(`/api/admin/group-menus-v2/${id}/slider/images/ai`, { method: "POST", body: form });
        },
        async patchBasics(
          id: number,
          input: Partial<{
            menu_title: string;
            price: number;
            active: boolean;
            is_draft: boolean;
            menu_type: string;
            menu_subtitle: string[];
            show_dish_images: boolean;
            show_section_tabs: boolean;
            show_menu_preview_image: boolean;
            editor_preview_open: boolean;
            beverage: {
              type: string;
              price_per_person?: number | null;
              has_supplement?: boolean;
              supplement_price?: number | null;
            };
            comments: string[];
            min_party_size: number;
            main_dishes_limit: boolean;
            main_dishes_limit_number: number;
            included_coffee: boolean;
          }>,
        ): Promise<APISuccess | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/basics`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
        async patchMenuType(id: number, menuType: string): Promise<APISuccess<{ menu_id: number; menu_type: string }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/menu-type`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ menu_type: menuType }),
          });
        },
        async putSections(
          id: number,
          sections: Array<{ id?: number; title: string; display_title: string; subtitle: string; tab_label: string; kind: string; position?: number; annotations?: string[] }>,
        ): Promise<APISuccess<{ sections: GroupMenuV2Section[] }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/sections`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sections }),
          });
        },
        // Coordination id: menu_section_public_placement_v1
        // Resolves (creating when missing) the Postres carrier menu for the active restaurant.
        async resolvePostres(): Promise<APISuccess<{ menu_id: number }> | APIError> {
          return json(`/api/admin/group-menus-v2/postres/resolve`, { method: "POST" });
        },
        // Coordination id: menu_section_delete_v1 (modal -> DELETE -> DB -> public snapshot)
        async deleteSection(id: number, sectionId: number): Promise<APISuccess<{ section_id: number }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/sections/${sectionId}`, {
            method: "DELETE",
          });
        },
        // Coordination id: menu_section_public_placement_v1
        async patchSectionVisibility(
          id: number,
          sectionId: number,
          input: { public_page_active?: boolean; web_placement?: string },
        ): Promise<APISuccess<Record<string, never>> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/sections/${sectionId}/visibility`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
        async patchSectionAnnotations(
          id: number,
          sectionId: number,
          annotations: string[],
        ): Promise<APISuccess<{ section_id: number; annotations: string[] }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/sections/${sectionId}/annotations`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ annotations }),
          });
        },
        async getSectionDishes(
          id: number,
          sectionId: number,
        ): Promise<APISuccess<{ dishes: GroupMenuV2Dish[] }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/sections/${sectionId}/dishes`, {
            method: "GET",
          });
        },
        async putSectionDishes(
          id: number,
          sectionId: number,
          dishes: Array<{
            id?: number;
            catalog_dish_id?: number | null;
            title: string;
            description: string;
            description_enabled: boolean;
            allergens: string[];
            supplement_enabled: boolean;
            supplement_price: number | null;
            active?: boolean;
          }>,
        ): Promise<APISuccess<{ dishes: GroupMenuV2Dish[] }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/sections/${sectionId}/dishes`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ dishes }),
          });
        },
        async patchSectionDish(
          id: number,
          sectionId: number,
          dishId: number,
          patch: Partial<{
            catalog_dish_id: number | null;
            title: string;
            description: string;
            description_enabled: boolean;
            allergens: string[];
            supplement_enabled: boolean;
            supplement_price: number | null;
            price: number | null;
            active: boolean;
          }>,
        ): Promise<APISuccess<{ dish: GroupMenuV2Dish }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/sections/${sectionId}/dishes/${dishId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
          });
        },
        async uploadSectionDishImage(
          id: number,
          sectionId: number,
          dishId: number,
          file: File,
        ): Promise<APISuccess<{ dish: GroupMenuV2Dish }> | APIError> {
          const form = new FormData();
          form.append("image", file, file.name || "dish-image.webp");
          return json(`/api/admin/group-menus-v2/${id}/sections/${sectionId}/dishes/${dishId}/image`, {
            method: "POST",
            body: form,
          });
        },
        async uploadSectionDishImageAI(
          id: number,
          sectionId: number,
          dishId: number,
          file: File,
        ): Promise<APISuccess<{ dish_id: number; message?: string }> | APIError> {
          const form = new FormData();
          form.append("image", file, file.name || "dish-image.webp");
          return json(`/api/admin/group-menus-v2/${id}/sections/${sectionId}/dishes/${dishId}/image/ai`, {
            method: "POST",
            body: form,
          });
        },
        async uploadMenuPreviewImage(
          id: number,
          file: File,
        ): Promise<APISuccess<{ imageUrl: string }> | APIError> {
          const form = new FormData();
          form.append("image", file, file.name || "menu-preview.webp");
          return json(`/api/admin/group-menus-v2/${id}/preview-image`, {
            method: "POST",
            body: form,
          });
        },
        async uploadMenuPreviewImageAI(
          id: number,
          file: File,
        ): Promise<APISuccess<{ menu_id: number; message?: string }> | APIError> {
          const form = new FormData();
          form.append("image", file, file.name || "menu-preview.webp");
          return json(`/api/admin/group-menus-v2/${id}/preview-image/ai`, {
            method: "POST",
            body: form,
          });
        },
        async publish(id: number): Promise<APISuccess | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/publish`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
        },
        async toggleActive(id: number): Promise<APISuccess<{ active: boolean }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/toggle-active`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
        },
        async delete(id: number): Promise<APISuccess | APIError> {
          return json(`/api/admin/group-menus-v2/${id}`, { method: "DELETE" });
        },
        async uploadSpecialMenuImage(
          menuId: number,
          file: File,
        ): Promise<APISuccess<{ imageUrl: string }> | APIError> {
          const form = new FormData();
          form.append("image", file, file.name || "menu-special.webp");
          return json(`/api/admin/group-menus-v2/${menuId}/special-image`, {
            method: "POST",
            body: form,
          });
        },
        async getSameDayBooking(menuId: number): Promise<APISuccess<{ dish_ids: number[] }> | APIError> {
          return json(`/api/admin/group-menus-v2/${menuId}/same-day-booking`, { method: "GET" });
        },
        async setSameDayBookingBlocked(menuId: number, dishId: number): Promise<APISuccess<{ record: { id: number; dish_id: number; menu_id: number } }> | APIError> {
          return json(`/api/admin/group-menus-v2/${menuId}/same-day-booking/${dishId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
        },
        async setSameDayBookingAllowed(menuId: number, dishId: number): Promise<APISuccess<{ dish_id: number; menu_id: number }> | APIError> {
          return json(`/api/admin/group-menus-v2/${menuId}/same-day-booking/${dishId}`, { method: "DELETE" });
        },
      },
      dishesCatalog: {
        async search(q: string, limit = 12): Promise<APISuccess<{ items: DishCatalogItem[] }> | APIError> {
          const sp = new URLSearchParams();
          sp.set("q", q);
          sp.set("limit", String(limit));
          return json(`/api/admin/dishes-catalog/search?${sp.toString()}`, { method: "GET" });
        },
        async upsert(input: {
          id?: number;
          title: string;
          description: string;
          allergens: string[];
          default_supplement_enabled: boolean;
          default_supplement_price: number | null;
        }): Promise<APISuccess<{ dish: DishCatalogItem }> | APIError> {
          return json(`/api/admin/dishes-catalog/upsert`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
      },
      async getSelector(): Promise<APISuccess<{ menus: MenuSelectorItem[] }> | APIError> {
        return json("/api/admin/menus/selector", { method: "GET" });
      },
    },
    config: {
      async getDefaults(): Promise<APISuccess<ConfigDefaults> | APIError> {
        return json("/api/admin/config/defaults", { method: "GET" });
      },
      async setDefaults(input: Partial<{
        openingMode: "morning" | "night" | "both";
        morningHours: string[];
        nightHours: string[];
        weekdayOpen: WeekdayOpen;
        dailyLimit: number;
        mesasDeDosLimit: string;
        mesasDeTresLimit: string;
        allowFloorReservation?: boolean;
        allowSalonReservation?: boolean;
      }>): Promise<APISuccess<ConfigDefaults> | APIError> {
        return json("/api/admin/config/defaults", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async getDay(date: string): Promise<APISuccess<ConfigDayStatus> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/day?${q.toString()}`, { method: "GET" });
      },
      async setDay(date: string, isOpen: boolean): Promise<APISuccess<ConfigDayStatus> | APIError> {
        return json("/api/admin/config/day", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, isOpen }),
        });
      },
      async setDayRange(dates: string[], isOpen: boolean): Promise<APISuccess<ConfigDayRangeResult> | APIError> {
        return json("/api/admin/config/day", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dates, isOpen, rangeDates: true }),
        });
      },
      async getOpeningHours(date: string): Promise<APISuccess<ConfigOpeningHours> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/opening-hours?${q.toString()}`, { method: "GET" });
      },
      async setOpeningHours(
        date: string,
        input:
          | string[]
          | Partial<{
              openingMode: "morning" | "night" | "both";
              morningHours: string[];
              nightHours: string[];
              hours: string[];
            }>,
      ): Promise<APISuccess<ConfigOpeningHours> | APIError> {
        const body = Array.isArray(input) ? { date, hours: input } : { date, ...input };
        return json("/api/admin/config/opening-hours", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      },
      async getMesasDeDos(date: string): Promise<APISuccess<ConfigMesasDeDos> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/mesas-de-dos?${q.toString()}`, { method: "GET" });
      },
      async setMesasDeDos(date: string, limit: string): Promise<APISuccess<ConfigMesasDeDos> | APIError> {
        return json("/api/admin/config/mesas-de-dos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, limit }),
        });
      },
      async getMesasDeTres(date: string): Promise<APISuccess<ConfigMesasDeTres> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/mesas-de-tres?${q.toString()}`, { method: "GET" });
      },
      async setMesasDeTres(date: string, limit: string): Promise<APISuccess<ConfigMesasDeTres> | APIError> {
        return json("/api/admin/config/mesas-de-tres", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, limit }),
        });
      },
      async getSalonCondesa(date: string): Promise<APISuccess<ConfigSalonCondesa> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/salon-condesa?${q.toString()}`, { method: "GET" });
      },
      async setSalonCondesa(date: string, state: boolean): Promise<APISuccess<ConfigSalonCondesa> | APIError> {
        return json("/api/admin/config/salon-condesa", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, state }),
        });
      },
      async getDefaultFloors(): Promise<APISuccess<{ floors: ConfigFloor[] }> | APIError> {
        return json("/api/admin/config/floors/defaults", { method: "GET" });
      },
      async setDefaultFloors(input: { count?: number; floorNumber?: number; active?: boolean; maxAforo?: number }): Promise<APISuccess<{ floors: ConfigFloor[] }> | APIError> {
        return json("/api/admin/config/floors/defaults", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async listSalons(date?: string): Promise<APISuccess<{ salons: import("./types").ConfigSalon[] }> | APIError> {
        const q = date ? `?${new URLSearchParams({ date })}` : "";
        return json(`/api/admin/config/salons${q}`, { method: "GET" });
      },
      async setSalonDayStatus(input: { date: string; salonId: number; active: boolean }): Promise<APISuccess<{ date: string; salons: import("./types").ConfigSalon[] }> | APIError> {
        return json("/api/admin/config/salons/day-status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async createSalon(input: import("./types").ConfigSalonInput): Promise<APISuccess<{ salon: import("./types").ConfigSalon; salons: import("./types").ConfigSalon[] }> | APIError> {
        return json("/api/admin/config/salons", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async updateSalon(salonId: number, input: import("./types").ConfigSalonInput): Promise<APISuccess<{ salon: import("./types").ConfigSalon; salons: import("./types").ConfigSalon[] }> | APIError> {
        return json(`/api/admin/config/salons/${salonId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async deleteSalon(salonId: number): Promise<APISuccess<{ ok: boolean }> | APIError> {
        return json(`/api/admin/config/salons/${salonId}`, { method: "DELETE" });
      },
      async getFloors(date: string): Promise<APISuccess<{ date: string; floors: ConfigFloor[] }> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/floors?${q.toString()}`, { method: "GET" });
      },
      async setFloor(date: string, floorNumber: number, active: boolean, maxAforo?: number): Promise<APISuccess<{ date: string; floors: ConfigFloor[] }> | APIError> {
        return json("/api/admin/config/floors", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, floorNumber, active, ...(maxAforo !== undefined ? { maxAforo } : {}) }),
        });
      },
      async setFloorsForDate(date: string, count: number): Promise<APISuccess<{ date: string; floors: ConfigFloor[] }> | APIError> {
        return json("/api/admin/config/floors/date", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, count }),
        });
      },
      async getDailyLimit(date: string): Promise<APISuccess<ConfigDailyLimit> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/daily-limit?${q.toString()}`, { method: "GET" });
      },
      async setDailyLimit(date: string, limit: number): Promise<APISuccess<{ date: string; limit: number }> | APIError> {
        return json("/api/admin/config/daily-limit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, limit }),
        });
      },
      // By-hour client split configuration.
      async getLocationBooking(date: string): Promise<APISuccess<import("./types").LocationBookingConfig> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/location-booking?${q.toString()}`, { method: "GET" });
      },
      async setLocationBooking(
        date: string,
        payload: { allowFloorReservation?: boolean; allowSalonReservation?: boolean },
      ): Promise<APISuccess<import("./types").LocationBookingConfig> | APIError> {
        return json("/api/admin/config/location-booking", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, ...payload }),
        });
      },
      async getHourSplit(date: string): Promise<APISuccess<import("./types").HourSplitConfig> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/hour-split?${q.toString()}`, { method: "GET" });
      },
      async setHourSplit(date: string, enabled: boolean): Promise<APISuccess<{ date: string; enabled: boolean; source: "override" | "default" }> | APIError> {
        return json("/api/admin/config/hour-split", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, enabled }),
        });
      },
      async setHourSplitPercentages(payload: import("./types").HourSplitPercentagesPayload): Promise<APISuccess<{ date: string; percentages: Record<string, number>; hourlyCapacities?: Record<string, number> }> | APIError> {
        return json("/api/admin/config/hour-split-percentages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      },
      async getRestaurantInfo(): Promise<APISuccess<{ restaurantInfo: import("./types").RestaurantInfo }> | APIError> {
        return json("/api/admin/config/restaurant-info", { method: "GET" });
      },
      async setRestaurantInfo(input: Partial<import("./types").RestaurantInfo>): Promise<APISuccess<{ restaurantInfo: import("./types").RestaurantInfo }> | APIError> {
        return json("/api/admin/config/restaurant-info", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async listAds(): Promise<APISuccess<{ ads: import("./types").RestaurantAd[] }> | APIError> {
        return json("/api/admin/config/ads", { method: "GET" });
      },
      async createAd(input: import("./types").RestaurantAdInput): Promise<APISuccess<{ ad: import("./types").RestaurantAd }> | APIError> {
        return json("/api/admin/config/ads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      },
      async updateAd(id: number, input: import("./types").RestaurantAdInput): Promise<APISuccess<{ ad: import("./types").RestaurantAd }> | APIError> {
        return json(`/api/admin/config/ads/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      },
      async deleteAd(id: number): Promise<APISuccess | APIError> { return json(`/api/admin/config/ads/${id}`, { method: "DELETE" }); },
      async uploadAdImage(id: number, file: File): Promise<APISuccess<{ url: string }> | APIError> { const form = new FormData(); form.append("image", file, file.name || "ad.webp"); return json(`/api/admin/config/ads/${id}/image/upload`, { method: "POST", body: form }); },
      async enhanceAdImage(id: number, file: File): Promise<APISuccess<{ url: string }> | APIError> { const form = new FormData(); form.append("image", file, file.name || "ad.webp"); return json(`/api/admin/config/ads/${id}/image/enhance`, { method: "POST", body: form }); },
      async generateAdImage(id: number): Promise<APISuccess<{ url: string }> | APIError> { return json(`/api/admin/config/ads/${id}/image/generate`, { method: "POST" }); },
      async checkRestaurantWebsite(website: string): Promise<APISuccess<{ website: string }> | APIError> {
        return json("/api/admin/config/check-website", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ website }),
        });
      },
      async getEmailProviderConfig(): Promise<APISuccess<{ config: import("./types").EmailProviderConfig }> | APIError> {
        return json("/api/admin/config/email-provider", { method: "GET" });
      },
      async setEmailProviderConfig(input: Partial<import("./types").EmailProviderConfig>): Promise<APISuccess<{ config: import("./types").EmailProviderConfig }> | APIError> {
        return json("/api/admin/config/email-provider", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      // AI image provider configuration (root-only).
      async getAIImageProviders(): Promise<APISuccess<{ providers: import("./types").AIImageProvider[]; models: import("./types").AIImageModel[] }> | APIError> {
        return json("/api/admin/config/ai-image/providers", { method: "GET" });
      },
      async getAIImageConfig(): Promise<APISuccess<{ config: import("./types").AIImageConfig }> | APIError> {
        return json("/api/admin/config/ai-image", { method: "GET" });
      },
      async setAIImageConfig(input: import("./types").AIImageConfigInput): Promise<APISuccess<{ config: import("./types").AIImageConfig }> | APIError> {
        return json("/api/admin/config/ai-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      // BunnyCDN storage credentials per restaurant (root-only).
      async getBunnyStorageConfig(): Promise<APISuccess<{ config: import("./types").BunnyStorageConfig }> | APIError> {
        return json("/api/admin/config/bunny-storage", { method: "GET" });
      },
      async setBunnyStorageConfig(input: import("./types").BunnyStorageConfigInput): Promise<APISuccess<{ config: import("./types").BunnyStorageConfig }> | APIError> {
        return json("/api/admin/config/bunny-storage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      // MiniMax AI (forky chat + translations + stock) config per restaurant (root-only).
      async getMiniMaxConfig(): Promise<APISuccess<{ config: import("./types").MiniMaxConfig }> | APIError> {
        return json("/api/admin/config/minimax", { method: "GET" });
      },
      async setMiniMaxConfig(input: import("./types").MiniMaxConfigInput): Promise<APISuccess<{ config: import("./types").MiniMaxConfig }> | APIError> {
        return json("/api/admin/config/minimax", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      // WhatsApp bot settings per restaurant (root-only, IA tab).
      async getBotSettings(restaurantId: number): Promise<APISuccess<import("./types").BotSettingsResponse> | APIError> {
        return json(`/api/admin/bot/settings/${restaurantId}`, { method: "GET" });
      },
      async saveBotSettings(restaurantId: number, input: import("./types").BotTenantConfig): Promise<APISuccess<import("./types").BotSettingsResponse> | APIError> {
        return json(`/api/admin/bot/settings/${restaurantId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      // Renders the system prompt for a draft config without saving it.
      async previewBotSettings(restaurantId: number, input: import("./types").BotTenantConfig): Promise<APISuccess<import("./types").BotSettingsResponse> | APIError> {
        return json(`/api/admin/bot/settings/${restaurantId}/preview`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async getMandatoryMenus(date: string): Promise<APISuccess<import("./types").MandatoryMenuConfig> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/mandatory-menus?${q.toString()}`, { method: "GET" });
      },
      async saveMandatoryMenus(input: import("./types").MandatoryMenuSavePayload): Promise<APISuccess<import("./types").MandatoryMenuConfig> | APIError> {
        return json("/api/admin/config/mandatory-menus", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
    },

    legalPages: {
      async list(): Promise<LegalPageListResponse | APIError> {
        return json("/api/admin/legal-pages", { method: "GET" });
      },
      async get(slug: LegalPageSlug): Promise<APISuccess<{ page: LegalPage }> | APIError> {
        return json(`/api/admin/legal-pages/${slug}`, { method: "GET" });
      },
      async upsert(slug: LegalPageSlug, body: LegalPageUpsertRequest): Promise<APISuccess | APIError> {
        return json(`/api/admin/legal-pages/${slug}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      },
    },

    widget: {
      async getSettings(): Promise<APISuccess<{ settings: import("./types").WidgetSettings }> | APIError> {
        return json("/admin/widget/settings", { method: "GET" });
      },
      async updateSettings(input: Partial<import("./types").WidgetSettings>): Promise<APISuccess | APIError> {
        return json("/admin/widget/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
    },

    invoices: {
      async list(params?: {
        search?: string;
        search_by?: "name" | "email" | "invoice_number";
        status?: string;
        date_type?: string;
        date_from?: string;
        date_to?: string;
        is_reservation?: boolean;
        sort?: string;
        page?: number;
        limit?: number;
      }): Promise<APISuccess<{ invoices: import("./types").Invoice[]; total: number; page: number; limit: number }> | APIError> {
        const q = new URLSearchParams();
        if (params?.search) q.set("search", params.search);
        if (params?.search_by) q.set("search_by", params.search_by);
        if (params?.status) q.set("status", params.status);
        if (params?.date_type) q.set("date_type", params.date_type);
        if (params?.date_from) q.set("date_from", params.date_from);
        if (params?.date_to) q.set("date_to", params.date_to);
        if (params?.is_reservation !== undefined) q.set("is_reservation", String(params.is_reservation));
        if (params?.sort) q.set("sort", params.sort);
        if (params?.page) q.set("page", String(params.page));
        if (params?.limit) q.set("limit", String(params.limit));
        return json(`/api/admin/invoices?${q.toString()}`, { method: "GET" });
      },

      async get(id: number): Promise<APISuccess<{ invoice: import("./types").Invoice }> | APIError> {
        return json(`/api/admin/invoices/${id}`, { method: "GET" });
      },

      async create(input: import("./types").InvoiceInput): Promise<APISuccess<{ id: number }> | APIError> {
        return json("/api/admin/invoices", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async update(id: number, input: import("./types").InvoiceInput): Promise<APISuccess | APIError> {
        return json(`/api/admin/invoices/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/invoices/${id}`, {
          method: "DELETE",
        });
      },

      async send(id: number): Promise<APISuccess<{ pdf_url: string }> | APIError> {
        return json(`/api/admin/invoices/${id}/send`, {
          method: "POST",
        });
      },

      async sendWithCustomization(id: number, params: { subject?: string; message?: string }): Promise<APISuccess<{ pdf_url: string; sent_at: string }> | APIError> {
        return json(`/api/admin/invoices/${id}/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(params),
        });
      },

      async searchReservations(params: {
        date_from?: string;
        date_to?: string;
        name?: string;
        phone?: string;
        party_size?: number;
        time?: string;
      }): Promise<{ success: boolean; reservations: import("./types").ReservationSearchResult[] } | import("./types").APIError> {
        const q = new URLSearchParams();
        if (params?.date_from) q.set("date_from", params.date_from);
        if (params?.date_to) q.set("date_to", params.date_to);
        if (params?.name) q.set("name", params.name);
        if (params?.phone) q.set("phone", params.phone);
        if (params?.party_size) q.set("party_size", String(params.party_size));
        if (params?.time) q.set("time", params.time);
        return json(`/api/admin/invoices/search-reservation?${q.toString()}`, { method: "GET" });
      },

      async getByCustomerEmail(email: string): Promise<APISuccess<{ invoices: import("./types").Invoice[]; total: number }> | APIError> {
        const q = new URLSearchParams();
        q.set("search", email);
        q.set("search_by", "email");
        return json(`/api/admin/invoices?${q.toString()}`, { method: "GET" });
      },

      async uploadImage(id: number, file: File): Promise<{ success: boolean; url?: string } | import("./types").APIError> {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetchImpl(baseUrl + `/api/admin/invoices/${id}/upload-image`, {
          method: "POST",
          body: formData,
        });
        const data = await readJSON(res);
        emitSessionExpirationUpdate((data as any)?.moving_expiration_date ?? res.headers.get("x-moving-expiration-date"));
        if (res.status === 401) {
          emitSessionExpired();
        }
        return data;
      },

      async getHistory(id: number): Promise<import("./types").InvoiceHistoryListResponse | import("./types").APIError> {
        return json(`/api/admin/invoices/${id}/history`, { method: "GET" });
      },

      async addPayment(id: number, input: import("./types").InvoicePaymentInput): Promise<APISuccess<{ payment: import("./types").InvoicePayment }> | APIError> {
        return json(`/api/admin/invoices/${id}/payments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async deletePayment(paymentId: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/invoices/payments/${paymentId}`, {
          method: "DELETE",
        });
      },

      async getPayments(id: number): Promise<APISuccess<{ payments: import("./types").InvoicePayment[] }> | APIError> {
        return json(`/api/admin/invoices/${id}/payments`, { method: "GET" });
      },

      async getAnalytics(params?: {
        date_from?: string;
        date_to?: string;
        months?: number;
      }): Promise<APISuccess<{ analytics: import("./types").InvoiceAnalytics }> | APIError> {
        const q = new URLSearchParams();
        if (params?.date_from) q.set("date_from", params.date_from);
        if (params?.date_to) q.set("date_to", params.date_to);
        if (params?.months) q.set("months", String(params.months));
        return json(`/api/admin/invoices/analytics?${q.toString()}`, { method: "GET" });
      },

      async merge(input: import("./types").InvoiceMergeInput): Promise<import("./types").InvoiceMergeResponse | import("./types").APIError> {
        return json("/api/admin/invoices/merge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async split(input: import("./types").InvoiceSplitInput): Promise<import("./types").InvoiceSplitResponse | import("./types").APIError> {
        return json("/api/admin/invoices/split", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async getSplitInfo(id: number): Promise<import("./types").InvoiceSplitInfoResponse | import("./types").APIError> {
        return json(`/api/admin/invoices/${id}/split-info`, { method: "GET" });
      },

      async getChildInvoices(parentId: number): Promise<APISuccess<{ invoices: import("./types").Invoice[] }> | APIError> {
        return json(`/api/admin/invoices/${parentId}/child-invoices`, { method: "GET" });
      },

      async getParentInvoice(childId: number): Promise<APISuccess<{ invoice: import("./types").Invoice }> | APIError> {
        return json(`/api/admin/invoices/${childId}/parent-invoice`, { method: "GET" });
      },

      // Invoice Comments
      async getComments(invoiceId: number): Promise<APISuccess<{ comments: import("./types").InvoiceComment[] }> | APIError> {
        return json(`/api/admin/invoices/${invoiceId}/comments`, { method: "GET" });
      },

      async addComment(invoiceId: number, input: { content: string }): Promise<APISuccess<{ comment: import("./types").InvoiceComment }> | APIError> {
        return json(`/api/admin/invoices/${invoiceId}/comments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async updateComment(invoiceId: number, commentId: number, input: { content: string }): Promise<APISuccess<{ comment: import("./types").InvoiceComment }> | APIError> {
        return json(`/api/admin/invoices/${invoiceId}/comments/${commentId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async deleteComment(invoiceId: number, commentId: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/invoices/${invoiceId}/comments/${commentId}`, {
          method: "DELETE",
        });
      },

    },

    invoiceTemplates: {
      async list(): Promise<APISuccess<{ templates: InvoiceTemplate[]; total: number }> | APIError> {
        return json(`/api/admin/invoice-templates`, { method: "GET" });
      },

      async get(id: number): Promise<APISuccess<{ template: InvoiceTemplate }> | APIError> {
        return json(`/api/admin/invoice-templates/${id}`, { method: "GET" });
      },

      async create(input: InvoiceTemplateInput): Promise<APISuccess<{ id: number }> | APIError> {
        return json("/api/admin/invoice-templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async update(id: number, input: InvoiceTemplateInput): Promise<APISuccess | APIError> {
        return json(`/api/admin/invoice-templates/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/invoice-templates/${id}`, {
          method: "DELETE",
        });
      },

      async toggleActive(id: number): Promise<APISuccess<{ is_active: boolean }> | APIError> {
        return json(`/api/admin/invoice-templates/${id}/toggle-active`, {
          method: "POST",
        });
      },
    },

    // Tax Reports API (IVA Summary)
    taxReports: {
      async getIVAReport(params: {
        date_from: string;
        date_to: string;
        include_credit_notes?: boolean;
        quarter?: string;
      }): Promise<APISuccess<{ report: import("./types").TaxReport }> | APIError> {
        const q = new URLSearchParams();
        q.set("date_from", params.date_from);
        q.set("date_to", params.date_to);
        if (params.include_credit_notes !== undefined) q.set("include_credit_notes", String(params.include_credit_notes));
        if (params.quarter) q.set("quarter", params.quarter);
        return json(`/api/admin/tax-reports/iva?${q.toString()}`, { method: "GET" });
      },

      async getQuarterlyBreakdown(year: number): Promise<APISuccess<{ quarters: import("./types").TaxReportQuarterlyBreakdown[] }> | APIError> {
        const q = new URLSearchParams();
        q.set("year", String(year));
        return json(`/api/admin/tax-reports/quarterly?${q.toString()}`, { method: "GET" });
      },

      async exportReport(params: {
        date_from: string;
        date_to: string;
        include_credit_notes?: boolean;
        format: "pdf" | "excel" | "csv";
        report_type?: "iva" | "irpf" | "summary";
        quarter?: string;
      }): Promise<APISuccess<{ download_url: string; filename: string }> | APIError> {
        const q = new URLSearchParams();
        q.set("date_from", params.date_from);
        q.set("date_to", params.date_to);
        q.set("format", params.format);
        if (params.include_credit_notes !== undefined) q.set("include_credit_notes", String(params.include_credit_notes));
        if (params.report_type) q.set("report_type", params.report_type);
        if (params.quarter) q.set("quarter", params.quarter);
        return json(`/api/admin/tax-reports/export?${q.toString()}`, { method: "GET" });
      },

      // Customer Statement API
      async getCustomerStatement(params: {
        customer_name: string;
        date_from: string;
        date_to: string;
      }): Promise<APISuccess<{ statement: import("./types").CustomerStatement }> | APIError> {
        const q = new URLSearchParams();
        q.set("customer_name", params.customer_name);
        q.set("date_from", params.date_from);
        q.set("date_to", params.date_to);
        return json(`/api/admin/customer-statement?${q.toString()}`, { method: "GET" });
      },

      async exportCustomerStatement(params: {
        customer_name: string;
        date_from: string;
        date_to: string;
        format: "pdf" | "csv";
      }): Promise<APISuccess<{ download_url: string; filename: string }> | APIError> {
        const q = new URLSearchParams();
        q.set("customer_name", params.customer_name);
        q.set("date_from", params.date_from);
        q.set("date_to", params.date_to);
        q.set("format", params.format);
        return json(`/api/admin/customer-statement/export?${q.toString()}`, { method: "GET" });
      },

      async listCustomersWithInvoices(): Promise<APISuccess<{ customers: { name: string; email?: string; dni_cif?: string }[] }> | APIError> {
        return json("/api/admin/customers-with-invoices", { method: "GET" });
      },
    },

    // Credit Notes API
    creditNotes: {
      async list(params?: {
        search?: string;
        date_from?: string;
        date_to?: string;
        status?: string;
        invoice_id?: number;
        page?: number;
        limit?: number;
      }): Promise<APISuccess<{ credit_notes: import("./types").CreditNote[]; total: number; page: number; limit: number }> | APIError> {
        const q = new URLSearchParams();
        if (params?.search) q.set("search", params.search);
        if (params?.date_from) q.set("date_from", params.date_from);
        if (params?.date_to) q.set("date_to", params.date_to);
        if (params?.status) q.set("status", params.status);
        if (params?.invoice_id) q.set("invoice_id", String(params.invoice_id));
        if (params?.page) q.set("page", String(params.page));
        if (params?.limit) q.set("limit", String(params.limit));
        return json(`/api/admin/credit-notes?${q.toString()}`, { method: "GET" });
      },

      async get(id: number): Promise<APISuccess<{ credit_note: import("./types").CreditNote }> | APIError> {
        return json(`/api/admin/credit-notes/${id}`, { method: "GET" });
      },

      async create(input: import("./types").CreditNoteInput): Promise<APISuccess<{ id: number }> | APIError> {
        return json("/api/admin/credit-notes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async update(id: number, input: Partial<import("./types").CreditNoteInput>): Promise<APISuccess | APIError> {
        return json(`/api/admin/credit-notes/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/credit-notes/${id}`, {
          method: "DELETE",
        });
      },

      async validate(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/credit-notes/${id}/validate`, {
          method: "POST",
        });
      },

      async apply(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/credit-notes/${id}/apply`, {
          method: "POST",
        });
      },

      async getPDF(id: number): Promise<APISuccess<{ pdf_url: string }> | APIError> {
        return json(`/api/admin/credit-notes/${id}/pdf`, { method: "GET" });
      },
    },

    // Reminder Templates API
    reminderTemplates: {
      async list(): Promise<APISuccess<{ templates: ReminderTemplate[]; total: number }> | APIError> {
        return json(`/api/admin/reminder-templates`, { method: "GET" });
      },

      async get(id: number): Promise<APISuccess<{ template: ReminderTemplate }> | APIError> {
        return json(`/api/admin/reminder-templates/${id}`, { method: "GET" });
      },

      async create(input: ReminderTemplateInput): Promise<APISuccess<{ id: number }> | APIError> {
        return json("/api/admin/reminder-templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async update(id: number, input: ReminderTemplateInput): Promise<APISuccess | APIError> {
        return json(`/api/admin/reminder-templates/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/reminder-templates/${id}`, {
          method: "DELETE",
        });
      },

      async setDefault(id: number): Promise<APISuccess<{ is_default: boolean }> | APIError> {
        return json(`/api/admin/reminder-templates/${id}/set-default`, {
          method: "POST",
        });
      },
    },

    // Invoice Reminders API
    reminders: {
      async send(invoiceId: number, input: SendReminderInput): Promise<APISuccess<{ reminder: InvoiceReminder }> | APIError> {
        return json(`/api/admin/invoices/${invoiceId}/reminders/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async listByInvoice(invoiceId: number): Promise<APISuccess<{ reminders: InvoiceReminder[]; total: number }> | APIError> {
        return json(`/api/admin/invoices/${invoiceId}/reminders`, { method: "GET" });
      },

      async getHistory(invoiceId: number): Promise<APISuccess<{ reminders: InvoiceReminder[]; total: number }> | APIError> {
        return json(`/api/admin/invoices/${invoiceId}/reminders/history`, { method: "GET" });
      },
    },

    // Reminder Settings API
    reminderSettings: {
      async get(): Promise<APISuccess<{ settings: ReminderSettings }> | APIError> {
        return json(`/api/admin/reminder-settings`, { method: "GET" });
      },

      async update(settings: ReminderSettings): Promise<APISuccess<{ settings: ReminderSettings }> | APIError> {
        return json(`/api/admin/reminder-settings`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(settings),
        });
      },
    },

    // Scheduled Reminders API
    scheduledReminders: {
      async list(params?: {
        status?: string;
        frequency?: string;
        date_from?: string;
        date_to?: string;
        invoice_id?: number;
        page?: number;
        limit?: number;
      }): Promise<APISuccess<{ reminders: any[]; total: number; page: number; limit: number }> | APIError> {
        const q = new URLSearchParams();
        if (params?.status) q.set("status", params.status);
        if (params?.frequency) q.set("frequency", params.frequency);
        if (params?.date_from) q.set("date_from", params.date_from);
        if (params?.date_to) q.set("date_to", params.date_to);
        if (params?.invoice_id) q.set("invoice_id", String(params.invoice_id));
        if (params?.page) q.set("page", String(params.page));
        if (params?.limit) q.set("limit", String(params.limit));
        return json(`/api/admin/scheduled-reminders?${q.toString()}`, { method: "GET" });
      },

      async get(id: number): Promise<APISuccess<{ reminder: any }> | APIError> {
        return json(`/api/admin/scheduled-reminders/${id}`, { method: "GET" });
      },

      async create(input: any): Promise<APISuccess<{ id: number }> | APIError> {
        return json("/api/admin/scheduled-reminders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async update(id: number, input: any): Promise<APISuccess | APIError> {
        return json(`/api/admin/scheduled-reminders/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async cancel(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/scheduled-reminders/${id}/cancel`, {
          method: "POST",
        });
      },

      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/scheduled-reminders/${id}`, {
          method: "DELETE",
        });
      },

      async sendNow(id: number): Promise<APISuccess<{ reminder: any }> | APIError> {
        return json(`/api/admin/scheduled-reminders/${id}/send-now`, {
          method: "POST",
        });
      },
    },

    // Auto-Reminder Rules API
    autoReminderRules: {
      async list(): Promise<APISuccess<{ rules: any[]; total: number }> | APIError> {
        return json(`/api/admin/auto-reminder-rules`, { method: "GET" });
      },

      async get(id: number): Promise<APISuccess<{ rule: any }> | APIError> {
        return json(`/api/admin/auto-reminder-rules/${id}`, { method: "GET" });
      },

      async create(input: any): Promise<APISuccess<{ id: number }> | APIError> {
        return json("/api/admin/auto-reminder-rules", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async update(id: number, input: any): Promise<APISuccess | APIError> {
        return json(`/api/admin/auto-reminder-rules/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/auto-reminder-rules/${id}`, {
          method: "DELETE",
        });
      },

      async toggle(id: number, is_active: boolean): Promise<APISuccess | APIError> {
        return json(`/api/admin/auto-reminder-rules/${id}/toggle`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ is_active }),
        });
      },
    },

    // Recurring Invoices API
    recurringInvoices: {
      async list(params?: {
        is_active?: boolean;
        search?: string;
        page?: number;
        limit?: number;
      }): Promise<APISuccess<{ recurringInvoices: any[]; total: number; page: number; limit: number }> | APIError> {
        const q = new URLSearchParams();
        if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
        if (params?.search) q.set("search", params.search);
        if (params?.page) q.set("page", String(params.page));
        if (params?.limit) q.set("limit", String(params.limit));
        return json(`/api/admin/recurring-invoices?${q.toString()}`, { method: "GET" });
      },

      async get(id: number): Promise<APISuccess<{ recurringInvoice: any }> | APIError> {
        return json(`/api/admin/recurring-invoices/${id}`, { method: "GET" });
      },

      async create(input: any): Promise<APISuccess<{ id: number }> | APIError> {
        return json("/api/admin/recurring-invoices", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async update(id: number, input: any): Promise<APISuccess | APIError> {
        return json(`/api/admin/recurring-invoices/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/recurring-invoices/${id}`, {
          method: "DELETE",
        });
      },

      async toggleActive(id: number): Promise<APISuccess<{ is_active: boolean }> | APIError> {
        return json(`/api/admin/recurring-invoices/${id}/toggle-active`, {
          method: "POST",
        });
      },

      async generateInvoice(id: number): Promise<APISuccess<{ invoice_id: number }> | APIError> {
        return json(`/api/admin/recurring-invoices/${id}/generate`, {
          method: "POST",
        });
      },

      async getLogs(id: number): Promise<APISuccess<{ logs: any[]; total: number }> | APIError> {
        return json(`/api/admin/recurring-invoices/${id}/logs`, { method: "GET" });
      },

      async pause(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/recurring-invoices/${id}/pause`, {
          method: "POST",
        });
      },

      async resume(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/recurring-invoices/${id}/resume`, {
          method: "POST",
        });
      },
    },

    // Background Job API (for managing scheduled jobs)
    backgroundJobs: {
      async processRecurringInvoices(): Promise<APISuccess<{ processed: number; generated: number; errors: number }> | APIError> {
        return json("/api/admin/jobs/process-recurring-invoices", {
          method: "POST",
        });
      },

      async getJobStatus(jobType: string): Promise<APISuccess<{ last_run: string; next_run: string; status: string; last_result?: any }> | APIError> {
        const q = new URLSearchParams({ job_type: jobType });
        return json(`/api/admin/jobs/status?${q.toString()}`, { method: "GET" });
      },

    },

    pos: {
      ...createPOSModule(json),
      bootstrap(): Promise<POSBootstrap | APIError> { return json("/api/admin/pos/bootstrap", { method: "GET" }); },
      settings: {
        get(): Promise<APISuccess<{ settings: POSSettings }> | APIError> { return json("/api/admin/pos/settings", { method: "GET" }); },
        update(input: POSSettings): Promise<APISuccess | APIError> { return json("/api/admin/pos/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); },
      },
      visits: {
        open(input: { channel: "DINE_IN" | "TAKEAWAY" | "DELIVERY"; tableId?: number; bookingId?: number; covers: number; idempotencyKey: string }): Promise<APISuccess<{ visit: unknown; ticket: POSTicket }> | APIError> { return json("/api/admin/pos/visits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); },
        get(id: number): Promise<APISuccess<{ visit: unknown }> | APIError> { return json(`/api/admin/pos/visits/${id}`, { method: "GET" }); },
      },
      tickets: {
        addLine(id: number, input: { productId: number; quantity: number; notes?: string; idempotencyKey: string }): Promise<APISuccess<{ ticket: POSTicket }> | APIError> { return json(`/api/admin/pos/tickets/${id}/lines`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); },
        checkout(id: number, input: { idempotencyKey: string; expectedVersion: number; payments: Array<{ method: string; amountCents: number; idempotencyKey: string }>; closeVisit: boolean }): Promise<APISuccess<{ ticket: POSTicket; stockStatus: string; visitClosed: boolean }> | APIError> { return json(`/api/admin/pos/tickets/${id}/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); },
        hourly(params: { date: string }): Promise<APISuccess<FichajePosRevenue> | APIError> { return json(withQuery("/api/admin/pos/tickets/hourly", params), { method: "GET" }); },
        series(params: { date: string }): Promise<APISuccess<{ date: string; series: FichajePosSeriesPoint[] }> | APIError> { return json(withQuery("/api/admin/pos/tickets/series", params), { method: "GET" }); },
      },
    },

    // Public Invoice API (for customer-facing invoice lookup)
    publicInvoices: {
      async get(id: number, token: string): Promise<import("./types").PublicInvoiceResponse | import("./types").APIError> {
        const q = new URLSearchParams();
        q.set("token", token);
        return json(`/api/public/invoices/${id}?${q.toString()}`, { method: "GET" });
      },
    },

    // Public Booking API (for customer-facing booking pages)
    publicBookings: {
      async get(id: number): Promise<import("./types").PublicBookingResponse | import("./types").APIError> {
        return json(`/api/public/booking?id=${id}`, { method: "GET" });
      },
      async confirm(id: number): Promise<import("./types").PublicBookingResponse | import("./types").APIError> {
        return json("/api/public/booking/confirm", {
          method: "POST",
          body: JSON.stringify({ id }),
          headers: { "Content-Type": "application/json" },
        });
      },
      async cancel(id: number, cancelledBy: string = "customer"): Promise<import("./types").PublicBookingResponse | import("./types").APIError> {
        return json("/api/public/booking/cancel", {
          method: "POST",
          body: JSON.stringify({ id, cancelledBy }),
          headers: { "Content-Type": "application/json" },
        });
      },
      async rice(id: number, riceType: string, servings: number): Promise<import("./types").PublicBookingResponse | import("./types").APIError> {
        return json("/api/public/booking/rice", {
          method: "POST",
          body: JSON.stringify({ id, riceType, servings }),
          headers: { "Content-Type": "application/json" },
        });
      },
      async policies(): Promise<import("./types").PublicBookingPoliciesResponse | import("./types").APIError> {
        return json("/api/public/booking-policies", { method: "GET" });
      },
    },
  };
}
