import { describe, expect, it, vi } from "vitest";

import { createApiFetch, normalizeClientOpts } from "./request";

describe("createApiFetch", () => {
  it("adds a timeout signal when configured", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const apiFetch = createApiFetch(normalizeClientOpts({ baseUrl: "", fetchImpl, timeoutMs: 1000 }));

    await apiFetch("/api/admin/me", { method: "GET" });

    expect(fetchImpl).toHaveBeenCalledWith("/api/admin/me", expect.objectContaining({ method: "GET" }));
  });
});
