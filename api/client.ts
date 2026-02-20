import type {
  APIError,
  APISuccess,
  Booking,
  BOSession,
  ConfigDefaults,
  ConfigDailyLimit,
  ConfigDayStatus,
  ConfigMesasDeDos,
  ConfigMesasDeTres,
  ConfigFloor,
  ConfigOpeningHours,
  ConfigSalonCondesa,
  WeekdayOpen,
  DashboardMetrics,
  CalendarDay,
  DishCatalogItem,
  GroupMenu,
  GroupMenuV2,
  GroupMenuV2Dish,
  GroupMenuV2Section,
  GroupMenuV2Summary,
  GroupMenuSummary,
  HorarioMonthPoint,
  FichajeActiveEntry,
  FichajeSchedule,
  FichajeState,
  TimeEntry,
  Member,
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
  UazapiServer,
  UazapiServerCreateInput,
  UazapiServerPatchInput,
  Vino,
  InvoiceTemplate,
  InvoiceTemplateInput,
  ReminderTemplate,
  ReminderTemplateInput,
  ReminderSettings,
  InvoiceReminder,
  SendReminderInput,
  DomainQuote,
  DomainRegisterRequest,
  DomainRegisterResponse,
  DomainSearchQuery,
  DomainSearchResult,
  DomainVerificationStatus,
  PremiumTable,
  PremiumTableArea,
  PremiumTableBulkPatchInput,
  PremiumTableLayoutResponse,
  PremiumTablePatchInput,
  TableStatusUpdateEvent,
  WebsiteConfig,
  WebsiteDraftRequest,
  WebsiteDraftResponse,
  WebsiteTemplate,
  WhatsAppMessageTemplate,
  WhatsAppSendRequest,
  WhatsAppSendResponse,
} from "./types";
import type { BORole } from "../lib/rbac";

type ClientOpts = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  cookieHeader?: string;
};

type RequestCompatInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | string | null;
};

type WhatsAppConnectionPayload = {
  status?: string;
  connected?: boolean;
  qr?: string | null;
  pair_code?: string | null;
  pairCode?: string | null;
  connection?: Record<string, unknown> | null;
  message?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

async function readJSON(res: Response): Promise<any> {
  const txt = await res.text();
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}

export function createClient(opts: ClientOpts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = (opts.baseUrl ?? "").replace(/\/+$/, "");

  async function apiFetch(path: string, init: RequestInit): Promise<Response> {
    const normalizedPath = !isBrowser() && path.startsWith("/api/admin/") ? path.replace(/^\/api\/admin/, "/admin") : path;
    const url = baseUrl + normalizedPath;
    const headers = new Headers(init.headers ?? {});

    if (!isBrowser()) {
      if (opts.cookieHeader) headers.set("cookie", opts.cookieHeader);
    }
    // Browser: always include cookies (same-origin via /api proxy).
    const withCreds = isBrowser() ? { credentials: "include" as RequestCredentials } : {};

    return fetchImpl(url, {
      ...init,
      ...withCreds,
      headers,
    });
  }

  async function json<T>(path: string, init: RequestInit): Promise<T> {
    const res = await apiFetch(path, init);
    const data = await readJSON(res);
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

  function normalizeCompatPath(path: string): string {
    if (path.startsWith("/admin/") || path === "/admin") return `/api${path}`;
    if (path.startsWith("/premium/") || path === "/premium") return `/api${path}`;
    return path;
  }

  async function requestJSON<T>(path: string, init: RequestCompatInit = {}): Promise<T> {
    const normalizedPath = normalizeCompatPath(path);
    const headers = new Headers(init.headers ?? {});
    const { body, ...restInit } = init;
    const nextInit: RequestInit = { ...restInit };
    const isFormDataBody = typeof FormData !== "undefined" && body instanceof FormData;
    const isStringBody = typeof body === "string";
    const isObjectBody = isPlainObject(body);

    if (!isFormDataBody && (isStringBody || isObjectBody) && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (isObjectBody) {
      nextInit.body = JSON.stringify(body);
    } else if (body !== undefined) {
      nextInit.body = body as BodyInit;
    }
    nextInit.headers = headers;
    return json<T>(normalizedPath, nextInit);
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
    return hints.some((hint) => haystack.includes(hint));
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

  async function getComidaWithFallback(
    primaryPath: string,
    fallbackDishPath: string,
    skipPrimary = false,
  ): Promise<APISuccess<{ item: FoodItem }> | APIError> {
    const fromFallback = async (): Promise<APISuccess<{ item: FoodItem }> | APIError> => {
      const fallbackRes = await json<APISuccess<{ dish?: MenuDish; item?: MenuDish }> | APIError>(fallbackDishPath, { method: "GET" });
      if (!fallbackRes.success) return fallbackRes;
      const dish = fallbackRes.dish ?? fallbackRes.item;
      if (!dish) {
        return { success: false, message: "No se pudo cargar el elemento" };
      }
      return {
        success: true,
        item: mapMenuDishToFoodItem(dish),
      };
    };

    if (skipPrimary) return fromFallback();
    try {
      const primaryRes = await json<
        APISuccess<{ item?: FoodItem; food?: FoodItem; cafe?: FoodItem; bebida?: FoodItem; plato?: FoodItem }> | APIError
      >(primaryPath, { method: "GET" });
      if (!primaryRes.success) return primaryRes;
      const item = primaryRes.item ?? primaryRes.food ?? primaryRes.cafe ?? primaryRes.bebida ?? primaryRes.plato;
      if (item) {
        return { success: true, item };
      }
      return fromFallback();
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
    postres: {
      async list(params?: { active?: number; search?: string; page?: number; limit?: number }): Promise<APISuccess<{ postres: Postre[] }> | APIError> {
        return json(withQuery("/api/admin/postres", params), { method: "GET" });
      },
      async get(id: number): Promise<APISuccess<{ postre?: Postre; item?: Postre }> | APIError> {
        return json(`/api/admin/postres/${id}`, { method: "GET" });
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
    },
    vinos: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ vinos: Vino[]; total?: number; page?: number; limit?: number }> | APIError> {
        return json(withQuery("/api/admin/vinos", params), { method: "GET" });
      },
      async get(id: number): Promise<APISuccess<{ vino?: Vino; item?: Vino }> | APIError> {
        return json(`/api/admin/vinos/${id}`, { method: "GET" });
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
    },
    cafes: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> {
        return listComidaWithFallback("/api/admin/cafes", "/api/admin/menus/finde", params, true, "cafes");
      },
      async get(id: number): Promise<APISuccess<{ item: FoodItem }> | APIError> {
        return getComidaWithFallback(`/api/admin/cafes/${id}`, `/api/admin/menus/finde/dishes/${id}`, true);
      },
      async create(input: ComidaWriteInput): Promise<APISuccess<{ num: number }> | APIError> {
        return createComidaWithFallback("/api/admin/cafes", "/api/admin/menus/finde/dishes", input, "ENTRANTE", true);
      },
      async patch(id: number, patch: ComidaPatchInput): Promise<APISuccess | APIError> {
        return patchComidaWithFallback(
          `/api/admin/cafes/${id}`,
          `/api/admin/menus/finde/dishes/${id}`,
          patch,
          "ENTRANTE",
          true,
        );
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return deleteComidaWithFallback(`/api/admin/cafes/${id}`, `/api/admin/menus/finde/dishes/${id}`, true);
      },
      async toggle(id: number, active = true): Promise<APISuccess<{ active: boolean }> | APIError> {
        return toggleComidaWithFallback(
          `/api/admin/cafes/${id}/toggle`,
          `/api/admin/menus/finde/dishes/${id}`,
          active,
          true,
        );
      },
    },
    bebidas: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> {
        return listComidaWithFallback("/api/admin/bebidas", "/api/admin/menus/finde", params, true, "bebidas");
      },
      async get(id: number): Promise<APISuccess<{ item: FoodItem }> | APIError> {
        return getComidaWithFallback(`/api/admin/bebidas/${id}`, `/api/admin/menus/finde/dishes/${id}`, true);
      },
      async create(input: ComidaWriteInput): Promise<APISuccess<{ num: number }> | APIError> {
        return createComidaWithFallback("/api/admin/bebidas", "/api/admin/menus/finde/dishes", input, "ENTRANTE", true);
      },
      async patch(id: number, patch: ComidaPatchInput): Promise<APISuccess | APIError> {
        return patchComidaWithFallback(
          `/api/admin/bebidas/${id}`,
          `/api/admin/menus/finde/dishes/${id}`,
          patch,
          "ENTRANTE",
          true,
        );
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return deleteComidaWithFallback(`/api/admin/bebidas/${id}`, `/api/admin/menus/finde/dishes/${id}`, true);
      },
      async toggle(id: number, active = true): Promise<APISuccess<{ active: boolean }> | APIError> {
        return toggleComidaWithFallback(
          `/api/admin/bebidas/${id}/toggle`,
          `/api/admin/menus/finde/dishes/${id}`,
          active,
          true,
        );
      },
    },
    platos: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> {
        return listComidaWithFallback("/api/admin/platos", "/api/admin/menus/dia", params, true, "platos");
      },
      async get(id: number): Promise<APISuccess<{ item: FoodItem }> | APIError> {
        return getComidaWithFallback(`/api/admin/platos/${id}`, `/api/admin/menus/dia/dishes/${id}`, true);
      },
      async create(input: ComidaWriteInput): Promise<APISuccess<{ num: number }> | APIError> {
        return createComidaWithFallback("/api/admin/platos", "/api/admin/menus/dia/dishes", input, "PRINCIPAL", true);
      },
      async patch(id: number, patch: ComidaPatchInput): Promise<APISuccess | APIError> {
        return patchComidaWithFallback(`/api/admin/platos/${id}`, `/api/admin/menus/dia/dishes/${id}`, patch, "PRINCIPAL", true);
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return deleteComidaWithFallback(`/api/admin/platos/${id}`, `/api/admin/menus/dia/dishes/${id}`, true);
      },
      async toggle(id: number, active = true): Promise<APISuccess<{ active: boolean }> | APIError> {
        return toggleComidaWithFallback(`/api/admin/platos/${id}/toggle`, `/api/admin/menus/dia/dishes/${id}`, active, true);
      },
      categories: {
        async list(): Promise<APISuccess<{ categories: FoodCategory[] }> | APIError> {
          return jsonWithFallback(
            ["/api/admin/platos/categories", "/api/admin/platos/categorias", "/api/admin/platos/tipos"],
            { method: "GET" },
          );
        },
        async create(input: { name: string; slug?: string }): Promise<APISuccess<{ category: FoodCategory }> | APIError> {
          return jsonWithFallback(
            ["/api/admin/platos/categories", "/api/admin/platos/categorias", "/api/admin/platos/tipos"],
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
    async request<T>(path: string, init: RequestCompatInit = {}): Promise<T> {
      return requestJSON<T>(path, init);
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
    },
    dashboard: {
      async getMetrics(date: string): Promise<APISuccess<{ metrics: DashboardMetrics }> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/dashboard/metrics?${q.toString()}`, { method: "GET" });
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
      async getUazapiServers(): Promise<APISuccess<{ servers: UazapiServer[] }> | APIError> {
        return json("/api/admin/integrations/uazapi/servers", { method: "GET" });
      },
      async createUazapiServer(input: UazapiServerCreateInput): Promise<APISuccess<{ server: UazapiServer }> | APIError> {
        return json("/api/admin/integrations/uazapi/servers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async patchUazapiServer(id: number, patch: UazapiServerPatchInput): Promise<APISuccess<{ server: UazapiServer }> | APIError> {
        return json(`/api/admin/integrations/uazapi/servers/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
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
      async whatsappSend(input: WhatsAppSendRequest & { memberId?: number }): Promise<APISuccess<WhatsAppSendResponse> | APIError> {
        const payload: Record<string, unknown> = { ...input };
        if (typeof payload.memberId === "number" && typeof payload.member_id !== "number") {
          payload.member_id = payload.memberId;
        }
        delete payload.memberId;
        return json("/api/admin/members/whatsapp/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      },
      async whatsappSubscribe(): Promise<APISuccess<{ message: string }> | APIError> {
        return json("/api/admin/members/whatsapp/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      },
      async whatsappConnect(): Promise<APISuccess<WhatsAppConnectionPayload> | APIError> {
        return json("/api/admin/members/whatsapp/connect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      },
      async whatsappConnection(): Promise<APISuccess<WhatsAppConnectionPayload> | APIError> {
        return json("/api/admin/members/whatsapp/connection", { method: "GET" });
      },
      async whatsappDisconnect(): Promise<APISuccess<WhatsAppConnectionPayload> | APIError> {
        return json("/api/admin/members/whatsapp/disconnect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      },
    },
    premium: {
      website: {
        async get(): Promise<APISuccess<{ data: WebsiteConfig | null; templates?: WebsiteTemplate[]; draft?: WebsiteDraftResponse | null }> | APIError> {
          return jsonWithFallback(
            ["/api/premium/website", "/api/admin/website"],
            { method: "GET" },
          );
        },
        async getConfig(): Promise<APISuccess<{ config: WebsiteConfig | null }> | APIError> {
          const res = await jsonWithFallback<APISuccess<{ data?: WebsiteConfig | null; config?: WebsiteConfig | null }> | APIError>(
            ["/api/premium/website", "/api/admin/website"],
            { method: "GET" },
          );
          if (!res.success) return res;
          return {
            success: true,
            config: res.data ?? res.config ?? null,
          };
        },
        async save(
          input: Partial<WebsiteConfig>,
        ): Promise<APISuccess<{ data: WebsiteConfig | null }> | APIError> {
          try {
            return await json("/api/premium/website", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            });
          } catch {
            return json("/api/admin/website", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            });
          }
        },
        async updateConfig(input: Partial<WebsiteConfig>): Promise<APISuccess<{ config: WebsiteConfig | null }> | APIError> {
          let res: APISuccess<{ data: WebsiteConfig | null }> | APIError;
          try {
            res = await json("/api/premium/website", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            });
          } catch {
            res = await json("/api/admin/website", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            });
          }
          if (!res.success) return res;
          return {
            success: true,
            config: res.data ?? null,
          };
        },
        async generateDraft(input: WebsiteDraftRequest): Promise<APISuccess<{ draft: WebsiteDraftResponse }> | APIError> {
          return jsonWithFallback(
            ["/api/premium/website/ai-draft", "/api/admin/website/ai-generate"],
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            },
          );
        },
        async generate(input: WebsiteDraftRequest): Promise<APISuccess<{ html: string; draft?: WebsiteDraftResponse }> | APIError> {
          const res = await jsonWithFallback<
            APISuccess<{ draft?: WebsiteDraftResponse; html?: string; custom_html?: string }> | APIError
          >(
            ["/api/premium/website/ai-draft", "/api/admin/website/ai-generate"],
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            },
          );
          if (!res.success) return res;
          const draft = res.draft;
          const html = String(draft?.html_content ?? res.html ?? res.custom_html ?? "").trim();
          return {
            success: true,
            html,
            draft,
          };
        },
        async listTemplates(): Promise<APISuccess<{ templates: WebsiteTemplate[] }> | APIError> {
          try {
            return await jsonWithFallback(
              ["/api/premium/website/templates", "/api/admin/website/templates"],
              { method: "GET" },
            );
          } catch {
            const res = await jsonWithFallback<APISuccess<{ templates?: WebsiteTemplate[] }> | APIError>(
              ["/api/premium/website", "/api/admin/website"],
              { method: "GET" },
            );
            if (!res.success) return res;
            return {
              success: true,
              templates: res.templates ?? [],
            };
          }
        },
      },
      domains: {
        async search(
          query: DomainSearchQuery,
        ): Promise<APISuccess<{ domain: DomainSearchResult; results?: DomainSearchResult[]; data?: DomainSearchResult }> | APIError> {
          try {
            const res = await json<APISuccess<{ results?: DomainSearchResult[]; data?: DomainSearchResult; domain?: DomainSearchResult }> | APIError>(
              "/api/premium/domains/search",
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(query),
              },
            );
            if (!res.success) return res;
            const domain = res.domain ?? res.data ?? res.results?.[0];
            if (!domain) {
              return {
                success: true,
                domain: {
                  domain: query.query,
                  available: false,
                  provider_price: 0,
                  marked_price: 0,
                  currency: "EUR",
                },
                results: res.results,
                data: res.data,
              };
            }
            return {
              success: true,
              domain,
              results: res.results,
              data: res.data,
            };
          } catch {
            const q = new URLSearchParams();
            q.set("query", query.query);
            const legacy = await json<APISuccess<{ data?: DomainSearchResult; domain?: DomainSearchResult }> | APIError>(
              `/api/admin/domains/search?${q.toString()}`,
              { method: "GET" },
            );
            if (!legacy.success) return legacy;
            const domain = legacy.domain ?? legacy.data;
            if (!domain) {
              return {
                success: true,
                domain: {
                  domain: query.query,
                  available: false,
                  provider_price: 0,
                  marked_price: 0,
                  currency: "EUR",
                },
              };
            }
            return {
              success: true,
              domain,
              data: legacy.data,
            };
          }
        },
        async quote(query: DomainSearchQuery | { domain: string }): Promise<APISuccess<{ quote: DomainQuote }> | APIError> {
          const normalizedQuery = "domain" in query ? { query: query.domain } : query;
          try {
            const res = await jsonWithFallback<APISuccess<{ quote: DomainQuote }> | APIError>(
              ["/api/premium/domains/quote", "/api/admin/domains/quote"],
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(normalizedQuery),
              },
            );
            if (!res.success) return res;
            return {
              success: true,
              quote: {
                ...res.quote,
                available: res.quote.available ?? true,
              },
            };
          } catch {
            const q = new URLSearchParams();
            q.set("query", normalizedQuery.query);
            const lookup = await json<APISuccess<{ data?: DomainSearchResult; domain?: DomainSearchResult }> | APIError>(
              `/api/admin/domains/search?${q.toString()}`,
              { method: "GET" },
            );
            if (!lookup.success) return lookup;
            const domain = lookup.domain ?? lookup.data;
            if (!domain) {
              return {
                success: false,
                message: "No se pudo calcular la cotizacion del dominio",
              };
            }
            return {
              success: true,
              quote: {
                domain: domain.domain,
                provider_price: domain.provider_price,
                marked_price: domain.marked_price,
                currency: domain.currency,
                available: domain.available,
              },
            };
          }
        },
        async register(
          input: DomainRegisterRequest,
        ): Promise<APISuccess<{ registration: DomainRegisterResponse; domain: string; status: DomainVerificationStatus }> | APIError> {
          const res = await jsonWithFallback<
            APISuccess<{ registration?: DomainRegisterResponse; domain?: string; status?: DomainVerificationStatus; message?: string }> | APIError
          >(
            ["/api/premium/domains/register", "/api/admin/domains/register"],
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            },
          );
          if (!res.success) return res;
          const registration: DomainRegisterResponse = res.registration ?? {
            domain: String(res.domain ?? input.domain),
            status: res.status ?? "pending",
            message: res.message,
          };
          return {
            success: true,
            registration,
            domain: registration.domain,
            status: registration.status,
          };
        },
        async verify(input: { domain: string }): Promise<APISuccess<{ status: DomainVerificationStatus }> | APIError> {
          return jsonWithFallback(
            ["/api/premium/domains/verify", "/api/admin/domains/verify"],
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            },
          );
        },
      },
      tables: {
        async list(): Promise<
          APISuccess<{ data?: PremiumTableArea[]; layout?: PremiumTableLayoutResponse; events?: TableStatusUpdateEvent[]; tables?: PremiumTable[] }> | APIError
        > {
          const res = await jsonWithFallback<APISuccess<{ data?: PremiumTableArea[]; layout?: PremiumTableLayoutResponse; events?: TableStatusUpdateEvent[]; tables?: PremiumTable[] }> | APIError>(
            ["/api/premium/tables", "/api/admin/tables"],
            { method: "GET" },
          );
          if (!res.success) return res;
          const areas = Array.isArray(res.data) ? res.data : (Array.isArray(res.layout?.areas) ? res.layout.areas : []);
          const flattenedFromAreas = areas.flatMap((area) => (Array.isArray(area.tables) ? area.tables : []));
          const tables = Array.isArray(res.tables) ? res.tables : flattenedFromAreas;
          return {
            ...res,
            data: areas.length ? areas : res.data,
            tables,
          };
        },
        async patch(id: number, patch: PremiumTablePatchInput): Promise<APISuccess<{ table: PremiumTable }> | APIError> {
          try {
            return await json(`/api/premium/tables/${id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(patch),
            });
          } catch {
            return json("/api/admin/tables", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ id, ...patch }),
            });
          }
        },
        async bulkPatch(input: PremiumTableBulkPatchInput): Promise<APISuccess<{ tables?: PremiumTable[] }> | APIError> {
          return jsonWithFallback(
            ["/api/premium/tables/bulk", "/api/admin/tables/bulk"],
            {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            },
          );
        },
        getWebSocketUrl(): string {
          if (typeof window === "undefined") return "/api/admin/tables/ws";
          const protocol = window.location.protocol === "https:" ? "wss" : "ws";
          return `${protocol}://${window.location.host}/api/admin/tables/ws`;
        },
        async getWebSocketInfo(): Promise<APISuccess<{ ws_url: string; token?: string; expires_at?: string }> | APIError> {
          return jsonWithFallback(
            ["/api/premium/tables/ws", "/api/admin/tables/ws"],
            { method: "GET" },
          );
        },
      },
      whatsapp: {
        async listTemplates(): Promise<APISuccess<{ templates: WhatsAppMessageTemplate[] }> | APIError> {
          return jsonWithFallback(
            ["/api/premium/whatsapp/templates", "/api/admin/whatsapp/templates"],
            { method: "GET" },
          );
        },
        async send(input: WhatsAppSendRequest & { memberId?: number }): Promise<APISuccess<WhatsAppSendResponse> | APIError> {
          const payload: Record<string, unknown> = { ...input };
          if (typeof payload.memberId === "number" && typeof payload.member_id !== "number") {
            payload.member_id = payload.memberId;
          }
          delete payload.memberId;
          try {
            return await json("/api/premium/whatsapp/send", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
          } catch {
            return json("/api/admin/members/whatsapp/send", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
          }
        },
        async subscribe(): Promise<APISuccess<{ message: string }> | APIError> {
          return jsonWithFallback(
            ["/api/premium/whatsapp/subscribe", "/api/admin/members/whatsapp/subscribe"],
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({}),
            },
          );
        },
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
    },
    fichaje: {
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
        async patchBasics(
          id: number,
          input: Partial<{
            menu_title: string;
            price: number;
            active: boolean;
            is_draft: boolean;
            menu_type: string;
            menu_subtitle: string[];
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
          sections: Array<{ id?: number; title: string; kind: string; position?: number }>,
        ): Promise<APISuccess<{ sections: GroupMenuV2Section[] }> | APIError> {
          return json(`/api/admin/group-menus-v2/${id}/sections`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sections }),
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
          form.append("image", file, file.name || "menu-special.jpg");
          return json(`/api/admin/group-menus-v2/${menuId}/special-image`, {
            method: "POST",
            body: form,
          });
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
      async setDefaultFloors(input: { count?: number; floorNumber?: number; active?: boolean }): Promise<APISuccess<{ floors: ConfigFloor[] }> | APIError> {
        return json("/api/admin/config/floors/defaults", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },
      async getFloors(date: string): Promise<APISuccess<{ date: string; floors: ConfigFloor[] }> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/config/floors?${q.toString()}`, { method: "GET" });
      },
      async setFloor(date: string, floorNumber: number, active: boolean): Promise<APISuccess<{ date: string; floors: ConfigFloor[] }> | APIError> {
        return json("/api/admin/config/floors", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, floorNumber, active }),
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
        return readJSON(res);
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

      // Invoice Renumbering
      async previewRenumber(input: import("./types").InvoiceRenumberInput): Promise<APISuccess<{ preview: import("./types").InvoiceRenumberPreview[] }> | APIError> {
        return json("/api/admin/invoices/renumber/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async applyRenumber(input: import("./types").InvoiceRenumberInput): Promise<import("./types").InvoiceRenumberResult | import("./types").APIError> {
        return json("/api/admin/invoices/renumber/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
      },

      async getRenumberHistory(): Promise<import("./types").InvoiceRenumberAuditListResponse | import("./types").APIError> {
        return json("/api/admin/invoices/renumber/history", { method: "GET" });
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

    // Public Invoice API (for customer-facing invoice lookup)
    publicInvoices: {
      async get(id: number, token: string): Promise<import("./types").PublicInvoiceResponse | import("./types").APIError> {
        const q = new URLSearchParams();
        q.set("token", token);
        return json(`/api/public/invoices/${id}?${q.toString()}`, { method: "GET" });
      },
    },
  };
}
