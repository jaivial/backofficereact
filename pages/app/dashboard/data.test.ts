import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMetrics: vi.fn(),
}));

vi.mock("vike-react/useConfig", () => ({ useConfig: () => vi.fn() }));
vi.mock("../../../api/client", () => ({
  createClient: () => ({ dashboard: { getMetrics: mocks.getMetrics } }),
}));

import { data } from "./+data";

describe("dashboard data loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads booking and invoice metrics with one backend call", async () => {
    const metrics = { date: "2026-07-29", total: 1, pending: 0, confirmed: 1, cancelled: 0, totalPeople: 2 };
    const invoiceMetrics = { pendingCount: 2, pendingAmount: 30, monthIncome: 100, weekSentCount: 1 };
    mocks.getMetrics.mockResolvedValue({ success: true, metrics, invoiceMetrics });

    const result = await data({
      urlParsed: { search: { date: "2026-07-29" } },
      boRequest: { backendOrigin: "http://backend", cookieHeader: "bo_session=test" },
    } as never);

    expect(mocks.getMetrics).toHaveBeenCalledWith("2026-07-29");
    expect(mocks.getMetrics).toHaveBeenCalledTimes(1);
    expect(result.invoiceMetrics).toEqual(invoiceMetrics);
  });
});
