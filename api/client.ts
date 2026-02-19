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
  Vino,
  InvoiceTemplate,
  InvoiceTemplateInput,
  ReminderTemplate,
  ReminderTemplateInput,
  ReminderSettings,
  InvoiceReminder,
  SendReminderInput,
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
    page?: number;
    limit?: number;
    categoria?: string;
    category?: string;
  };

  const comidaApi = {
    postres: {
      async list(params?: { active?: number; search?: string; page?: number; limit?: number }): Promise<APISuccess<{ postres: Postre[] }> | APIError> {
        return json(withQuery("/api/admin/postres", params), { method: "GET" });
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
        return json(withQuery("/api/admin/cafes", params), { method: "GET" });
      },
      async create(input: {
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
      }): Promise<APISuccess<{ num: number }> | APIError> {
        return json("/api/admin/cafes", {
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
          titulo: string;
          suplemento: number;
          alergenos: string[];
          active: boolean;
          imageBase64: string;
          categoria: string;
          category: string;
        }>,
      ): Promise<APISuccess | APIError> {
        return json(`/api/admin/cafes/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/cafes/${id}`, { method: "DELETE" });
      },
      async toggle(id: number): Promise<APISuccess<{ active: boolean }> | APIError> {
        return json(`/api/admin/cafes/${id}/toggle`, { method: "POST" });
      },
    },
    bebidas: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> {
        return json(withQuery("/api/admin/bebidas", params), { method: "GET" });
      },
      async create(input: {
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
      }): Promise<APISuccess<{ num: number }> | APIError> {
        return json("/api/admin/bebidas", {
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
          titulo: string;
          suplemento: number;
          alergenos: string[];
          active: boolean;
          imageBase64: string;
          categoria: string;
          category: string;
        }>,
      ): Promise<APISuccess | APIError> {
        return json(`/api/admin/bebidas/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/bebidas/${id}`, { method: "DELETE" });
      },
      async toggle(id: number): Promise<APISuccess<{ active: boolean }> | APIError> {
        return json(`/api/admin/bebidas/${id}/toggle`, { method: "POST" });
      },
    },
    platos: {
      async list(params?: ComidaListParams): Promise<APISuccess<{ items: FoodItem[]; total?: number; page?: number; limit?: number }> | APIError> {
        return json(withQuery("/api/admin/platos", params), { method: "GET" });
      },
      async create(input: {
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
      }): Promise<APISuccess<{ num: number }> | APIError> {
        return json("/api/admin/platos", {
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
          titulo: string;
          suplemento: number;
          alergenos: string[];
          active: boolean;
          imageBase64: string;
          categoria: string;
          category: string;
          category_id: number | null;
        }>,
      ): Promise<APISuccess | APIError> {
        return json(`/api/admin/platos/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
      },
      async delete(id: number): Promise<APISuccess | APIError> {
        return json(`/api/admin/platos/${id}`, { method: "DELETE" });
      },
      async toggle(id: number): Promise<APISuccess<{ active: boolean }> | APIError> {
        return json(`/api/admin/platos/${id}/toggle`, { method: "POST" });
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
