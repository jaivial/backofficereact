/**
 * Typed API client for E2E test data setup.
 * Makes direct API calls via the page context to set up test data.
 */
import type { Page } from "@playwright/test";
import { e2eEnv } from "../config";

export interface ApiResponse {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface FichajeStateResponse extends ApiResponse {
  state: { now: string; schedules?: unknown[] };
}

export interface MembersResponse extends ApiResponse {
  members: Array<{ id: number; name: string; [key: string]: unknown }>;
}

export interface MemberResponse extends ApiResponse {
  member?: { id: number; name: string; [key: string]: unknown };
}

export interface BookingsResponse extends ApiResponse {
  bookings?: Array<{ id: number; [key: string]: unknown }>;
}

export interface MenusResponse extends ApiResponse {
  menus?: Array<{ id: number; name: string; [key: string]: unknown }>;
  menu?: { menu_title?: string; sections?: unknown[]; [key: string]: unknown };
}

const BASE_URL = e2eEnv.baseURL;

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export class TestApiClient {
  constructor(private page: Page) {}

  private abs(path: string): string {
    return absoluteUrl(path);
  }

  /**
   * Make a GET request via the page's request context (shares browser cookies,
   * no CORS restrictions — works even before the page has navigated).
   */
  async get<T = ApiResponse>(path: string): Promise<T> {
    const res = await this.page.request.get(this.abs(path));
    return res.json() as Promise<T>;
  }

  /**
   * Make a POST request via the page's fetch.
   */
  async post<T = ApiResponse>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const res = await this.page.request.post(this.abs(path), { data: body });
    return res.json() as Promise<T>;
  }

  /**
   * Make a PUT request via the page's fetch.
   */
  async put<T = ApiResponse>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const res = await this.page.request.put(this.abs(path), { data: body });
    return res.json() as Promise<T>;
  }

  /**
   * Make a PATCH request via the page's fetch.
   */
  async patch<T = ApiResponse>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const res = await this.page.request.patch(this.abs(path), { data: body });
    return res.json() as Promise<T>;
  }

  /**
   * Make a DELETE request via the page's fetch.
   */
  async delete<T = ApiResponse>(path: string): Promise<T> {
    const res = await this.page.request.delete(this.abs(path));
    return res.json() as Promise<T>;
  }

  // --- Domain-specific helpers ---

  /**
   * Get today's bookings.
   */
  async getBookings(date: string): Promise<BookingsResponse> {
    return this.get(`/api/admin/bookings?date=${date}`) as Promise<BookingsResponse>;
  }

  /**
   * Create a test booking.
   */
  async createBooking(data: {
    reservation_date: string;
    reservation_time: string;
    party_size: number;
    customer_name: string;
    contact_phone: string;
    contact_email?: string;
  }) {
    return this.post("/api/admin/bookings", {
      special_menu: false,
      ...data,
    });
  }

  /**
   * Get the calendar for a month.
   */
  async getCalendar(year: number, month: number) {
    return this.get(`/api/admin/calendar?year=${year}&month=${month}`);
  }

  /**
   * Get food items by type.
   */
  async getComida(tipo: string, page = 1) {
    return this.get(`/api/admin/comida/${tipo}?page=${page}&pageSize=25`);
  }

  /**
   * Get group menus V2.
   */
  async getGroupMenus(): Promise<MenusResponse> {
    return this.get("/api/admin/group-menus-v2?includeDrafts=1") as Promise<MenusResponse>;
  }

  /**
   * Get members list.
   */
  async getMembers(): Promise<MembersResponse> {
    return this.get("/api/admin/members") as Promise<MembersResponse>;
  }

  /**
   * Get fichaje state.
   */
  async getFichajeState(): Promise<FichajeStateResponse> {
    return this.get("/api/admin/fichaje/state") as Promise<FichajeStateResponse>;
  }

  /**
   * Get horarios for a date.
   */
  async getHorarios(date: string) {
    return this.get(`/api/admin/horarios?date=${date}`);
  }

  /**
   * Get config defaults.
   */
  async getConfigDefaults() {
    return this.get("/api/admin/config/defaults");
  }

  /**
   * Get dashboard metrics.
   */
  async getDashboardMetrics() {
    return this.get("/api/admin/dashboard/metrics");
  }
}
