import type {
  APIError,
  APISuccess,
  Booking,
  BOSession,
  ConfigDailyLimit,
  ConfigDayStatus,
  ConfigMesasDeDos,
  ConfigOpeningHours,
  ConfigSalonCondesa,
  DashboardMetrics,
  GroupMenu,
  GroupMenuSummary,
  MenuDish,
  MenuTable,
  MenuVisibilityItem,
  Postre,
  RestaurantBranding,
  RestaurantIntegrations,
  Vino,
} from "./types";

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
      async setActiveRestaurant(restaurantId: number): Promise<APISuccess<{ activeRestaurantId: number }> | APIError> {
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
    reservas: {
      async list(params: {
        date: string;
        status?: string;
        q?: string;
        limit?: number;
        offset?: number;
      }): Promise<APISuccess<{ bookings: Booking[]; total: number }> | APIError> {
        const q = new URLSearchParams();
        q.set("date", params.date);
        if (params.status) q.set("status", params.status);
        if (params.q) q.set("q", params.q);
        if (params.limit !== undefined) q.set("limit", String(params.limit));
        if (params.offset !== undefined) q.set("offset", String(params.offset));
        return json(`/api/admin/bookings?${q.toString()}`, { method: "GET" });
      },
      async cancel(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/bookings/${id}/cancel`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
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
    },
    config: {
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
      async setOpeningHours(date: string, hours: string[]): Promise<APISuccess<ConfigOpeningHours> | APIError> {
        return json("/api/admin/config/opening-hours", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, hours }),
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
