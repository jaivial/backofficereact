import { describe, expect, it, vi } from "vitest";

import { createClient } from "./client";

describe("analytics client", () => {
  it("loads overview with typed range, granularity and previous comparison", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ success: true })));
    const client = createClient({ baseUrl: "http://backend", fetchImpl });

    await client.analytics.getOverview({
      from: "2026-07-01",
      to: "2026-07-31",
      granularity: "month",
      compare: "previous",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://backend/api/admin/analytics/overview?from=2026-07-01&to=2026-07-31&granularity=month&compare=previous",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("refreshes selected range with backend request shape", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ success: true, rowsWritten: 4 })));
    const client = createClient({ baseUrl: "http://backend", fetchImpl });

    await client.analytics.refresh({ from: "2026-07-01", to: "2026-07-31" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://backend/api/admin/analytics/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ from: "2026-07-01", to: "2026-07-31" }),
      }),
    );
  });
});
