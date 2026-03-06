import { describe, expect, it } from "vitest";

import { createClient } from "./client";

describe("createClient admin path normalization", () => {
  it("keeps /api/admin/* when baseUrl points to backend origin", async () => {
    let requestedURL = "";
    const fetchImpl: typeof fetch = async (input, _init) => {
      requestedURL = String(input);
      return new Response(JSON.stringify({ success: false, message: "Credenciales invalidas" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = createClient({ baseUrl: "http://127.0.0.1:8080", fetchImpl });
    await client.auth.login("test@example.com", "wrong");

    expect(requestedURL).toBe("http://127.0.0.1:8080/api/admin/login");
  });

  it("keeps /api/admin/* when using same-origin proxy", async () => {
    let requestedURL = "";
    const fetchImpl: typeof fetch = async (input, _init) => {
      requestedURL = String(input);
      return new Response(JSON.stringify({ success: false, message: "Credenciales invalidas" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = createClient({ baseUrl: "", fetchImpl });
    await client.auth.login("test@example.com", "wrong");

    expect(requestedURL).toBe("/api/admin/login");
  });

  it("normalizes legacy /admin/* paths to /api/admin/*", async () => {
    let requestedURL = "";
    const fetchImpl: typeof fetch = async (input, _init) => {
      requestedURL = String(input);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = createClient({ baseUrl: "http://127.0.0.1:8080", fetchImpl });
    await client.request("/admin/website", { method: "GET" });

    expect(requestedURL).toBe("http://127.0.0.1:8080/api/admin/website");
  });
});
