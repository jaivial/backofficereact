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
  FichajeSchedule,
  FichajeState,
  Member,
  MemberStats,
  MemberTimeBalance,
  MenuDish,
  MenuTable,
  MenuVisibilityItem,
  Postre,
  RoleCatalogItem,
  RoleCurrentUser,
  RoleUserItem,
  RestaurantBranding,
  RestaurantIntegrations,
  Vino,
} from "./types";
import type { BORole } from "../lib/rbac";

type ClientOpts = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  cookieHeader?: string;
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

export function createClient(opts: ClientOpts) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = opts.baseUrl.replace(/\/+$/, "");

  async function apiFetch(path: string, init: RequestInit): Promise<Response> {
    const url = baseUrl + path;
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

  return {
    auth: {
      async login(email: string, password: string): Promise<APISuccess<{ session: BOSession }> | APIError> {
        return json("/api/admin/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
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
        APISuccess<{ bookings: Booking[]; total_count: number; total: number; page: number; count: number }> | APIError
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
    },
    members: {
      async list(): Promise<APISuccess<{ members: Member[] }> | APIError> {
        return json("/api/admin/members", { method: "GET" });
      },
      async create(input: {
        firstName: string;
        lastName: string;
        email?: string | null;
        dni?: string | null;
        bankAccount?: string | null;
        phone?: string | null;
        photoUrl?: string | null;
        weeklyContractHours?: number;
      }): Promise<APISuccess<{ member: Member }> | APIError> {
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
        params: { view: "weekly" | "monthly" | "quarterly"; date: string },
      ): Promise<APISuccess<MemberStats> | APIError> {
        const q = new URLSearchParams({ view: params.view, date: params.date });
        return json(`/api/admin/members/${id}/stats?${q.toString()}`, { method: "GET" });
      },
      async getTimeBalance(id: number, date: string): Promise<APISuccess<MemberTimeBalance> | APIError> {
        const q = new URLSearchParams({ date });
        return json(`/api/admin/members/${id}/time-balance?${q.toString()}`, { method: "GET" });
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
    },
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
      postres: {
        async list(): Promise<APISuccess<{ postres: Postre[] }> | APIError> {
          return json("/api/admin/postres", { method: "GET" });
        },
        async create(input: { descripcion: string; alergenos: string[]; active?: boolean }): Promise<APISuccess<{ postre: Postre }> | APIError> {
          return json("/api/admin/postres", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
        },
        async patch(id: number, patch: Partial<Pick<Postre, "descripcion" | "active">> & { alergenos?: string[] }): Promise<APISuccess | APIError> {
          return json(`/api/admin/postres/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
          });
        },
        async delete(id: number): Promise<APISuccess | APIError> {
          return json(`/api/admin/postres/${id}`, { method: "DELETE" });
        },
      },
      vinos: {
        async list(params?: { tipo?: string; active?: number }): Promise<APISuccess<{ vinos: Vino[] }> | APIError> {
          const q = new URLSearchParams();
          if (params?.tipo) q.set("tipo", params.tipo);
          if (params?.active !== undefined) q.set("active", String(params.active));
          const qs = q.toString();
          return json(`/api/admin/vinos${qs ? `?${qs}` : ""}`, { method: "GET" });
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
      },
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
  };
}
