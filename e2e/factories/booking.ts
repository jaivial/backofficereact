/**
 * Booking data factory for E2E tests.
 *
 * createTestBooking → POST /api/admin/bookings  (admin create, allows overbooking)
 * cancelBooking     → POST /api/admin/bookings/{id}/cancel
 *
 * The session fixture exposes a `bookingFactory` that tracks every created
 * booking and cancels them all in afterEach, so a test never leaves orphan rows
 * even if it asserts/throws mid-flow.
 */
import type { TestApiClient } from "../helpers/api-client";
import { isoDate } from "../helpers/api";

export interface BookingInput {
  reservation_date?: string;
  reservation_time?: string;
  party_size?: number;
  customer_name?: string;
  contact_phone?: string;
  contact_email?: string;
  special_menu?: boolean;
}

export interface Booking {
  id: number;
  [key: string]: unknown;
}

/** Tomorrow's ISO date (YYYY-MM-DD) — a safe default that avoids past-date guards. */
function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoDate(d);
}

/** Unique-ish customer name so test bookings are easy to spot/clean. */
function e2eName(): string {
  return `E2E ${Date.now()}`;
}

/**
 * Create a booking via the admin API. Sensible defaults; pass `overrides` for
 * test-specific data.
 */
export async function createTestBooking(
  api: TestApiClient,
  overrides: BookingInput = {},
): Promise<Booking> {
  const res = await api.post<{ success: boolean; booking?: Booking; message?: string }>(
    "/api/admin/bookings",
    {
      reservation_date: tomorrowISO(),
      reservation_time: "20:00",
      party_size: 2,
      customer_name: e2eName(),
      contact_phone: "600000000",
      special_menu: false,
      ...overrides,
    },
  );
  if (!res.success || !res.booking) {
    throw new Error(`createTestBooking failed: ${res.message ?? "no booking in response"}`);
  }
  return res.booking;
}

/**
 * Cancel a booking (moves to cancelled_bookings, deletes from bookings).
 * Safe to call in cleanup — errors are swallowed by the factory.
 */
export async function cancelBooking(api: TestApiClient, id: number): Promise<void> {
  await api.post(`/api/admin/bookings/${id}/cancel`, {});
}

/**
 * Fixture-friendly factory: tracks created ids and cancels them all when the
 * test ends. Returned by the `bookingFactory` session fixture.
 */
export interface BookingFactory {
  create(overrides?: BookingInput): Promise<Booking>;
}

export function makeBookingFactory(api: TestApiClient): { factory: BookingFactory; cleanup: () => Promise<void> } {
  const created: number[] = [];
  return {
    factory: {
      async create(overrides?: BookingInput) {
        const b = await createTestBooking(api, overrides);
        created.push(b.id);
        return b;
      },
    },
    cleanup: async () => {
      await Promise.all(created.map((id) => cancelBooking(api, id).catch(() => undefined)));
    },
  };
}
