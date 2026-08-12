/**
 * Member compensation factory for E2E tests.
 *
 * Compensations have a clean create + DELETE pair (unlike members themselves).
 *
 * create  → POST /api/admin/members/{memberId}/compensations
 * cleanup → DELETE /api/admin/members/{memberId}/compensations/{compensationId}
 *
 * Effective periods cannot overlap for one member, so each test must use a
 * distinct `effectiveFrom` (or let the factory pick a unique future date).
 */
import type { TestApiClient } from "../helpers/api-client";
import { isoDate } from "../helpers/api";

export type PayType = "MONTHLY" | "HOURLY";

export interface CompensationInput {
  memberId: number;
  payType?: PayType;
  grossAmount?: number;
  monthlyHours?: number;
  employerCostPct?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
}

export interface Compensation {
  id: number;
  memberId: number;
  [key: string]: unknown;
}

/**
 * A unique-ish future date so overlapping-period validation doesn't reject the
 * compensation. Each call advances the day counter.
 */
let dayOffset = 1;
function uniqueFutureDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 365 + dayOffset++);
  return isoDate(d);
}

export async function createCompensation(
  api: TestApiClient,
  input: CompensationInput,
): Promise<Compensation> {
  const res = await api.post<{ success: boolean; id?: number; item?: { id: number }; message?: string }>(
    `/api/admin/members/${input.memberId}/compensations`,
    {
      payType: "MONTHLY",
      grossAmount: 1500,
      monthlyHours: 40,
      employerCostPct: 30,
      effectiveFrom: input.effectiveFrom ?? uniqueFutureDate(),
      ...input,
    },
  );
  if (!res.success) {
    throw new Error(`createCompensation failed: ${res.message ?? "unknown error"}`);
  }
  const id = res.id ?? res.item?.id;
  if (typeof id !== "number") {
    throw new Error("createCompensation failed: no id in response");
  }
  return { id, memberId: input.memberId };
}

export async function deleteCompensation(
  api: TestApiClient,
  memberId: number,
  compensationId: number,
): Promise<void> {
  await api.delete(`/api/admin/members/${memberId}/compensations/${compensationId}`);
}

export interface CompensationFactory {
  create(input: CompensationInput): Promise<Compensation>;
}

/**
 * The compensation factory needs a memberId resolved at fixture time. Provide it
 * via the closure parameter (typically from the `session` fixture's first member).
 */
export function makeCompensationFactory(
  api: TestApiClient,
): { factory: CompensationFactory; cleanup: () => Promise<void> } {
  const created: Array<{ memberId: number; id: number }> = [];
  return {
    factory: {
      async create(input: CompensationInput) {
        const comp = await createCompensation(api, input);
        created.push({ memberId: comp.memberId, id: comp.id });
        return comp;
      },
    },
    cleanup: async () => {
      await Promise.all(
        created.map(({ memberId, id }) =>
          deleteCompensation(api, memberId, id).catch(() => undefined),
        ),
      );
    },
  };
}
