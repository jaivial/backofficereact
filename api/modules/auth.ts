/**
 * Authentication API Module
 * Handles login, logout, session management, and password operations
 */

import type { APIError, APISuccess, BOSession } from "../types";
import type { BORole } from "../../lib/rbac";
import type { JsonRequestFn } from "../utils/request";

export type AuthModule = {
  login(identifier: string, password: string): Promise<APISuccess<{ session: BOSession }> | APIError>;
  logout(): Promise<APISuccess | APIError>;
  me(): Promise<APISuccess<{ session: BOSession }> | APIError>;
  setPassword(password: string, confirmPassword: string): Promise<APISuccess | APIError>;
  setActiveRestaurant(
    restaurantId: number
  ): Promise<
    APISuccess<{ activeRestaurantId: number; role: BORole; roleImportance: number; sectionAccess: string[] }> | APIError
  >;
};

export function createAuthModule(json: JsonRequestFn): AuthModule {
  return {
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
      restaurantId: number
    ): Promise<
      APISuccess<{ activeRestaurantId: number; role: BORole; roleImportance: number; sectionAccess: string[] }> | APIError
    > {
      return json("/api/admin/active-restaurant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
    },
  };
}
