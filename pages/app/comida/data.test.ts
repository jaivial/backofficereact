import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ counts: vi.fn() }));

vi.mock("vike-react/useConfig", () => ({ useConfig: () => vi.fn() }));
vi.mock("../../../api/client", () => ({
  createClient: () => ({ comida: { counts: mocks.counts } }),
}));

import { data } from "./+data";

describe("comida data loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads all category counts with one backend call", async () => {
    const countsByType = { vinos: 1, cafes: 2, postres: 3, platos: 4, bebidas: 5 };
    mocks.counts.mockResolvedValue({ success: true, countsByType });

    const result = await data({ boRequest: { backendOrigin: "http://backend", cookieHeader: "bo_session=test" } } as never);

    expect(mocks.counts).toHaveBeenCalledTimes(1);
    expect(result.countsByType).toEqual(countsByType);
  });
});
