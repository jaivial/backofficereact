import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOverview: vi.fn(),
}));

vi.mock("vike-react/useConfig", () => ({ useConfig: () => vi.fn() }));
vi.mock("../../../api/client", () => ({
  createClient: () => ({ analytics: { getOverview: mocks.getOverview } }),
}));

import { data } from "./+data";

describe("estadisticas data loader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes explicit range, granularity and comparison to backend", async () => {
    const overview = { success: true, currency: "EUR" };
    mocks.getOverview.mockResolvedValue(overview);

    const result = await data({
      urlParsed: {
        search: {
          from: "2026-07-01",
          to: "2026-07-31",
          granularity: "week",
          compare: "previous",
        },
      },
      boRequest: { backendOrigin: "http://backend", cookieHeader: "bo_session=test" },
    } as never);

    expect(mocks.getOverview).toHaveBeenCalledWith({
      from: "2026-07-01",
      to: "2026-07-31",
      granularity: "week",
      compare: "previous",
    });
    expect(result.overview).toEqual(overview);
    expect(result.error).toBeNull();
  });

  it("returns loader error when overview responds with API error", async () => {
    mocks.getOverview.mockResolvedValue({ success: false, message: "No autorizado" });

    const result = await data({
      urlParsed: { search: { from: "2026-07-01", to: "2026-07-31" } },
      boRequest: { backendOrigin: "http://backend", cookieHeader: "" },
    } as never);

    expect(result.overview).toBeNull();
    expect(result.error).toBe("No autorizado");
  });
});
