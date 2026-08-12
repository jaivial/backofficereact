/**
 * Horario (schedule) data factory for E2E tests.
 *
 * create  → POST /api/admin/horarios   (upsert keyed on restaurant+member+date)
 * cleanup → overwrite each created schedule back to its pre-test values.
 *
 * There is no DELETE for horarios; the upsert is idempotent. The factory
 * snapshots the original schedule before the test and restores it on cleanup.
 */
import type { TestApiClient } from "../helpers/api-client";
import { isoDate } from "../helpers/api";

export interface ScheduleInput {
  date?: string;
  memberId: number;
  startTime?: string;
  endTime?: string;
}

export interface Schedule {
  id: number;
  memberId: number;
  date: string;
  startTime: string;
  endTime: string;
  [key: string]: unknown;
}

interface OriginalSchedule {
  memberId: number;
  date: string;
  startTime?: string;
  endTime?: string;
}

export async function upsertSchedule(
  api: TestApiClient,
  input: ScheduleInput,
): Promise<Schedule> {
  const res = await api.post<{ success: boolean; schedule?: Schedule; message?: string }>(
    "/api/admin/horarios",
    {
      date: input.date ?? isoDate(new Date()),
      memberId: input.memberId,
      startTime: input.startTime ?? "10:00",
      endTime: input.endTime ?? "14:00",
    },
  );
  if (!res.success || !res.schedule) {
    throw new Error(`upsertSchedule failed: ${res.message ?? "no schedule in response"}`);
  }
  return res.schedule;
}

/** Read the existing schedule for (member, date) to snapshot it before a test. */
async function readSchedule(
  api: TestApiClient,
  memberId: number,
  date: string,
): Promise<OriginalSchedule | null> {
  const res = await api.get<{ success: boolean; schedules?: Array<{ memberId: number; date: string; startTime: string; endTime: string }> }>(
    `/api/admin/horarios?date=${date}`,
  );
  const match = (res.schedules ?? []).find((s) => s.memberId === memberId);
  if (!match) return null;
  return { memberId, date, startTime: match.startTime, endTime: match.endTime };
}

export interface ScheduleFactory {
  create(input: ScheduleInput): Promise<Schedule>;
}

export function makeScheduleFactory(api: TestApiClient): { factory: ScheduleFactory; cleanup: () => Promise<void> } {
  const written: OriginalSchedule[] = [];
  return {
    factory: {
      async create(input: ScheduleInput) {
        const date = input.date ?? isoDate(new Date());
        // Snapshot original so cleanup can restore it.
        const original = await readSchedule(api, input.memberId, date);
        if (original) written.push(original);
        const sched = await upsertSchedule(api, input);
        if (!original) written.push({ memberId: input.memberId, date, startTime: sched.startTime, endTime: sched.endTime });
        return sched;
      },
    },
    cleanup: async () => {
      // Restore each schedule to its pre-test values (idempotent upsert).
      await Promise.all(
        written.map((orig) =>
          upsertSchedule(api, {
            memberId: orig.memberId,
            date: orig.date,
            startTime: orig.startTime ?? "00:00",
            endTime: orig.endTime ?? "00:00",
          }).catch(() => undefined),
        ),
      );
    },
  };
}
