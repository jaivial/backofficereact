/**
 * POS visit factory for E2E tests.
 *
 * create  → POST /api/admin/pos/visits   (body: channel, tableId, covers, idempotencyKey)
 * cleanup → POST /api/admin/pos/visits/{id}/cancel
 *
 * DINE_IN requires a valid tableId + covers > 0. TAKEAWAY/DELIVERY/BAR carry
 * no covers and no table. The factory defaults to TAKEAWAY so it works without
 * a pre-existing restaurant table; pass channel DINE_IN + tableId for table tests.
 */
import type { TestApiClient } from "../helpers/api-client";

export type POSChannel = "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "BAR";

export interface POSVisitInput {
  channel?: POSChannel;
  tableId?: number;
  bookingId?: number;
  covers?: number;
  idempotencyKey?: string;
}

export interface POSVisit {
  id: number;
  [key: string]: unknown;
}

let visitCounter = 0;

export async function createPOSVisit(
  api: TestApiClient,
  overrides: POSVisitInput = {},
): Promise<POSVisit> {
  const key = overrides.idempotencyKey ?? `e2e-visit-${Date.now()}-${++visitCounter}`;
  const res = await api.post<{ success: boolean; id?: number; visit?: { id: number }; message?: string }>(
    "/api/admin/pos/visits",
    {
      channel: "TAKEAWAY",
      idempotencyKey: key,
      ...overrides,
    },
  );
  if (!res.success) {
    throw new Error(`createPOSVisit failed: ${res.message ?? "unknown error"}`);
  }
  const id = res.id ?? res.visit?.id;
  if (typeof id !== "number") {
    throw new Error(`createPOSVisit failed: no visit id in response`);
  }
  return { id };
}

export async function cancelPOSVisit(api: TestApiClient, id: number): Promise<void> {
  await api.post(`/api/admin/pos/visits/${id}/cancel`, {});
}

export interface POSVisitFactory {
  create(overrides?: POSVisitInput): Promise<POSVisit>;
}

export function makePOSVisitFactory(
  api: TestApiClient,
): { factory: POSVisitFactory; cleanup: () => Promise<void> } {
  const created: number[] = [];
  return {
    factory: {
      async create(overrides?: POSVisitInput) {
        const v = await createPOSVisit(api, overrides);
        created.push(v.id);
        return v;
      },
    },
    cleanup: async () => {
      await Promise.all(created.map((id) => cancelPOSVisit(api, id).catch(() => undefined)));
    },
  };
}
