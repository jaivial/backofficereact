import { describe, it, expect, vi } from "vitest";

vi.mock("vike-react/useConfig", () => ({ useConfig: () => () => undefined }));

// The page loads day config over HTTP; the accordion preference is the only
// value under test here, so every endpoint resolves to a failed response.
vi.mock("../../../../api/client", () => ({
  createClient: () => ({
    config: {
      getDay: async () => ({ success: false }),
      getDailyLimit: async () => ({ success: false }),
      getOpeningHours: async () => ({ success: false }),
      getMesasDeDos: async () => ({ success: false }),
      getMesasDeTres: async () => ({ success: false }),
      getFloors: async () => ({ success: false }),
      getHourSplit: async () => ({ success: false }),
    },
  }),
}));

import { data } from "./+data";

function ctx(preferences?: Record<string, string>) {
  return {
    urlParsed: { search: { date: "2026-08-18" } },
    bo: { session: preferences ? ({ preferences } as any) : (null as any) },
  } as any;
}

describe("reservas/config +data hourSplitDetailsOpen pass-through", () => {
  it("collapses when the stored preference is 0", async () => {
    const out = await data(ctx({ hourSplitDetailsOpenDay: "0" }));
    expect(out.hourSplitDetailsOpen).toBe(false);
  });

  it("expands when the stored preference is 1", async () => {
    const out = await data(ctx({ hourSplitDetailsOpenDay: "1" }));
    expect(out.hourSplitDetailsOpen).toBe(true);
  });

  it("defaults to expanded with no preference stored", async () => {
    const out = await data(ctx({}));
    expect(out.hourSplitDetailsOpen).toBe(true);
  });

  it("defaults to expanded with no session at all", async () => {
    const out = await data(ctx(undefined));
    expect(out.hourSplitDetailsOpen).toBe(true);
  });

  it("ignores the /app/config key (independent accordions)", async () => {
    const out = await data(ctx({ hourSplitDetailsOpenDefault: "0" }));
    expect(out.hourSplitDetailsOpen).toBe(true);
  });
});
