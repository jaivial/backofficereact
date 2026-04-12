/**
 * Members API Module
 * Handles staff member operations, stats, and invitations
 */

import type {
  APIError,
  APISuccess,
  Member,
  DeliveryAttempt,
  MemberInvitationPreview,
  InvitationOnboardingMember,
  PasswordResetPreview,
  MemberStats,
  MemberStatsTableRow,
  MemberTimeBalance,
  MemberYearStats,
} from "../types";
import type { JsonRequestFn } from "../utils/request";

export type MembersModule = {
  list(): Promise<APISuccess<{ members: Member[] }> | APIError>;
  create(input: {
    email: string;
    name: string;
    role: string;
    hourly_rate?: number;
    phone?: string;
  }): Promise<APISuccess<{ member: Member }> | APIError>;
  get(id: number): Promise<APISuccess<{ member: Member }> | APIError>;
  patch(
    id: number,
    input: Partial<{
      name: string;
      email: string;
      phone: string;
      role: string;
      hourly_rate: number;
      active: boolean;
    }>
  ): Promise<APISuccess | APIError>;
  uploadAvatar(id: number, file: File | Blob): Promise<APISuccess<{ member: Member; avatarUrl: string }> | APIError>;
  getStats(id: number, params: { from: string; to: string }): Promise<APISuccess<MemberStats> | APIError>;
  getTimeBalance(id: number, date: string): Promise<APISuccess<MemberTimeBalance> | APIError>;
  getYearStats(id: number, year: number): Promise<APISuccess<MemberYearStats> | APIError>;
  getStatsRange(params: { from: string; to: string }): Promise<APISuccess<{ rows: MemberStatsTableRow[] }> | APIError>;
  getTableData(params: { from: string; to: string }): Promise<APISuccess<{ rows: any[] }> | APIError>;
  invitations: {
    get(
      guid: string
    ): Promise<APISuccess<{ invitation: MemberInvitationPreview; member: InvitationOnboardingMember }> | APIError>;
    uploadAvatar(guid: string, file: File | Blob): Promise<APISuccess<{ member: Member; avatarUrl: string }> | APIError>;
  };
  passwordReset: {
    get(guid: string): Promise<APISuccess<{ reset: PasswordResetPreview }> | APIError>;
  };
  deliveryAttempts: {
    list(email: string): Promise<APISuccess<{ attempts: DeliveryAttempt[] }> | APIError>;
  };
};

export function createMembersModule(json: JsonRequestFn): MembersModule {
  return {
    async list(): Promise<APISuccess<{ members: Member[] }> | APIError> {
      return json("/api/admin/members", { method: "GET" });
    },

    async create(input: {
      email: string;
      name: string;
      role: string;
      hourly_rate?: number;
      phone?: string;
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
      input: Partial<{
        name: string;
        email: string;
        phone: string;
        role: string;
        hourly_rate: number;
        active: boolean;
      }>
    ): Promise<APISuccess | APIError> {
      return json(`/api/admin/members/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    },

    async uploadAvatar(id: number, file: File | Blob): Promise<APISuccess<{ member: Member; avatarUrl: string }> | APIError> {
      const form = new FormData();
      form.append("avatar", file, (file as File).name || "avatar.webp");
      return json(`/api/admin/members/${id}/avatar`, { method: "POST", body: form });
    },

    async getStats(id: number, params: { from: string; to: string }): Promise<APISuccess<MemberStats> | APIError> {
      const q = new URLSearchParams({ from: params.from, to: params.to });
      return json(`/api/admin/members/${id}/stats?${q.toString()}`, { method: "GET" });
    },

    async getTimeBalance(id: number, date: string): Promise<APISuccess<MemberTimeBalance> | APIError> {
      return json(`/api/admin/members/${id}/time-balance?date=${encodeURIComponent(date)}`, { method: "GET" });
    },

    async getYearStats(id: number, year: number): Promise<APISuccess<MemberYearStats> | APIError> {
      return json(`/api/admin/members/${id}/year-stats?year=${year}`, { method: "GET" });
    },

    async getStatsRange(params: { from: string; to: string }): Promise<APISuccess<{ rows: MemberStatsTableRow[] }> | APIError> {
      const q = new URLSearchParams({ from: params.from, to: params.to });
      return json(`/api/admin/members/stats-range?${q.toString()}`, { method: "GET" });
    },

    async getTableData(params: { from: string; to: string }): Promise<APISuccess<{ rows: any[] }> | APIError> {
      const q = new URLSearchParams({ from: params.from, to: params.to });
      return json(`/api/admin/members/table-data?${q.toString()}`, { method: "GET" });
    },

    invitations: {
      async get(
        guid: string
      ): Promise<APISuccess<{ invitation: MemberInvitationPreview; member: InvitationOnboardingMember }> | APIError> {
        return json(`/api/admin/members/invitations/${guid}`, { method: "GET" });
      },

      async uploadAvatar(
        guid: string,
        file: File | Blob
      ): Promise<APISuccess<{ member: Member; avatarUrl: string }> | APIError> {
        const form = new FormData();
        form.append("avatar", file, (file as File).name || "avatar.webp");
        return json(`/api/admin/members/invitations/${guid}/avatar`, { method: "POST", body: form });
      },
    },

    passwordReset: {
      async get(guid: string): Promise<APISuccess<{ reset: PasswordResetPreview }> | APIError> {
        return json(`/api/admin/members/password-reset/${guid}`, { method: "GET" });
      },
    },

    deliveryAttempts: {
      async list(email: string): Promise<APISuccess<{ attempts: DeliveryAttempt[] }> | APIError> {
        return json(`/api/admin/members/delivery-attempts?email=${encodeURIComponent(email)}`, { method: "GET" });
      },
    },
  };
}
