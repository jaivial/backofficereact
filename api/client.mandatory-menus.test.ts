import { describe, expect, it, beforeEach } from "vitest";
import { vi } from "vitest";

import { createClient } from "./client";

function mockFetch(responses: Record<string, unknown>) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string });
    const key = Object.keys(responses).find((k) => url.includes(k));
    const body = key ? responses[key] : { success: false, message: "not found" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

describe("config.mandatoryMenus", () => {
  describe("getMandatoryMenus", () => {
    it("calls GET /api/admin/config/mandatory-menus with date param", async () => {
      const { fetchImpl, calls } = mockFetch({
        "config/mandatory-menus": {
          success: true,
          date: "2026-04-05",
          status: true,
          mandatory: true,
          menuIds: [1, 2],
          menuChooseMain: [1],
        },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      const res = await client.config.getMandatoryMenus("2026-04-05");

      expect(res.success).toBe(true);
      expect(calls[0].url).toContain("config/mandatory-menus");
      expect(calls[0].url).toContain("date=2026-04-05");
      expect(calls[0].method).toBe("GET");
    });

    it("returns empty arrays when no config exists", async () => {
      const { fetchImpl } = mockFetch({
        "config/mandatory-menus": {
          success: true,
          date: "2026-04-05",
          status: false,
          mandatory: false,
          menuIds: [],
          menuChooseMain: [],
        },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      const res = await client.config.getMandatoryMenus("2026-04-05");

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.status).toBe(false);
        expect(res.menuIds).toEqual([]);
        expect(res.menuChooseMain).toEqual([]);
      }
    });
  });

  describe("saveMandatoryMenus", () => {
    it("calls POST /api/admin/config/mandatory-menus with correct payload", async () => {
      const { fetchImpl, calls } = mockFetch({
        "config/mandatory-menus": {
          success: true,
          date: "2026-04-05",
          status: true,
          mandatory: true,
          menuIds: [1, 2],
          menuChooseMain: [1],
        },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      const res = await client.config.saveMandatoryMenus({
        date: "2026-04-05",
        status: true,
        mandatory: true,
        menuIds: [1, 2],
        menuChooseMain: [1],
      });

      expect(res.success).toBe(true);
      expect(calls[0].url).toContain("config/mandatory-menus");
      expect(calls[0].method).toBe("POST");
      expect(calls[0].body).toBeTruthy();
      const parsedBody = JSON.parse(calls[0].body!);
      expect(parsedBody.date).toBe("2026-04-05");
      expect(parsedBody.status).toBe(true);
      expect(parsedBody.mandatory).toBe(true);
      expect(parsedBody.menuIds).toEqual([1, 2]);
      expect(parsedBody.menuChooseMain).toEqual([1]);
    });

    it("sends status=false when turning off mandatory menus", async () => {
      const { fetchImpl, calls } = mockFetch({
        "config/mandatory-menus": {
          success: true,
          date: "2026-04-05",
          status: false,
          mandatory: false,
          menuIds: [],
          menuChooseMain: [],
        },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      await client.config.saveMandatoryMenus({
        date: "2026-04-05",
        status: false,
        mandatory: false,
        menuIds: [],
        menuChooseMain: [],
      });

      expect(calls[0].method).toBe("POST");
      const parsedBody = JSON.parse(calls[0].body!);
      expect(parsedBody.status).toBe(false);
      expect(parsedBody.mandatory).toBe(false);
      expect(parsedBody.menuIds).toEqual([]);
    });
  });
});

describe("menus.getSelector", () => {
  it("calls GET /api/admin/menus/selector", async () => {
    const { fetchImpl, calls } = mockFetch({
      "menus/selector": {
        success: true,
        menus: [
          { id: 1, menu_title: "Menu del día", menu_type: "closed_conventional" },
          { id: 2, menu_title: "Menú Grupo", menu_type: "closed_group" },
        ],
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.menus.getSelector();

    expect(res.success).toBe(true);
    expect(calls[0].url).toContain("menus/selector");
    expect(calls[0].method).toBe("GET");
    if (res.success) {
      expect(res.menus).toHaveLength(2);
      expect(res.menus[0].menu_title).toBe("Menu del día");
    }
  });

  it("returns empty menus array when no menus exist", async () => {
    const { fetchImpl } = mockFetch({
      "menus/selector": {
        success: true,
        menus: [],
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.menus.getSelector();

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.menus).toEqual([]);
    }
  });
});
