import { describe, expect, it } from "vitest";

import { createClient } from "./client";

function mockFetch(responses: Record<string, unknown>) {
  const calls: { url: string; method: string }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    const key = Object.keys(responses).find((k) => url.includes(k));
    const body = key ? responses[key] : { success: false, message: "not found" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

describe("reservas.search client method", () => {
  it("calls GET /api/admin/bookings/search with name param", async () => {
    const { fetchImpl, calls } = mockFetch({
      "bookings/search": {
        success: true,
        bookings: [],
        floors: [],
        total_count: 0,
        total: 0,
        page: 1,
        count: 15,
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.reservas.search({ name: "Beatriz" });

    expect(res.success).toBe(true);
    expect(calls[0].url).toContain("bookings/search");
    expect(calls[0].url).toContain("name=Beatriz");
    expect(calls[0].method).toBe("GET");
  });

  it("sends phone and count params", async () => {
    const { fetchImpl, calls } = mockFetch({
      "bookings/search": {
        success: true,
        bookings: [],
        floors: [],
        total_count: 0,
        total: 0,
        page: 1,
        count: 10,
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    await client.reservas.search({ phone: "679992249", count: 10 });

    expect(calls[0].url).toContain("phone=679992249");
    expect(calls[0].url).toContain("count=10");
  });

  it("sends name and phone combined", async () => {
    const { fetchImpl, calls } = mockFetch({
      "bookings/search": {
        success: true,
        bookings: [],
        floors: [],
        total_count: 0,
        total: 0,
        page: 1,
        count: 15,
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    await client.reservas.search({ name: "Gil", phone: "679" });

    expect(calls[0].url).toContain("name=Gil");
    expect(calls[0].url).toContain("phone=679");
  });

  it("sends page param", async () => {
    const { fetchImpl, calls } = mockFetch({
      "bookings/search": {
        success: true,
        bookings: [],
        floors: [],
        total_count: 0,
        total: 0,
        page: 2,
        count: 15,
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    await client.reservas.search({ name: "test", page: 2 });

    expect(calls[0].url).toContain("page=2");
  });

  it("returns bookings array matching Booking type shape", async () => {
    const booking = {
      id: 2384,
      customer_name: "Beatriz Gil Gregorio",
      contact_email: "bettyx8@hotmail.com",
      reservation_date: "2026-03-22",
      reservation_time: "14:00:00",
      party_size: 7,
      children: 0,
      contact_phone: "679992249",
      contact_phone_country_code: "34",
      status: "pending",
      arroz_type: null,
      arroz_servings: null,
      commentary: null,
      babyStrollers: 0,
      highChairs: 0,
      table_number: null,
      preferred_floor_number: null,
      added_date: "2026-02-15 21:55:17",
      special_menu: false,
      menu_de_grupo_id: null,
      principales_json: null,
    };

    const { fetchImpl } = mockFetch({
      "bookings/search": {
        success: true,
        bookings: [booking],
        floors: [],
        total_count: 1,
        total: 1,
        page: 1,
        count: 15,
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.reservas.search({ name: "Beatriz" });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.bookings).toHaveLength(1);
      expect(res.bookings[0].id).toBe(2384);
      expect(res.bookings[0].customer_name).toBe("Beatriz Gil Gregorio");
      expect(res.total_count).toBe(1);
    }
  });
});
