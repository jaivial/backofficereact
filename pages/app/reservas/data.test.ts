import { describe, it, expect, vi } from "vitest";

vi.mock("vike-react/useConfig", () => ({ useConfig: () => () => undefined }));

import { data } from "./+data";

function ctxWithSession(preferences?: Record<string, string>) {
  return {
    bo: { session: preferences ? ({ preferences } as any) : (null as any) },
  } as any;
}

describe("reservas +data SSR display-mode pass-through", () => {
  it("maps session.preferences.reservasDisplayMode = grid", async () => {
    const out = await data(ctxWithSession({ reservasDisplayMode: "grid" }) as any);
    expect(out.displayMode).toBe("grid");
  });

  it("maps session.preferences.reservasDisplayMode = tabla", async () => {
    const out = await data(ctxWithSession({ reservasDisplayMode: "tabla" }) as any);
    expect(out.displayMode).toBe("tabla");
  });

  it("defaults to tabla when no preference is stored", async () => {
    const out = await data(ctxWithSession({}) as any);
    expect(out.displayMode).toBe("tabla");
  });

  it("defaults to tabla when there is no session at all", async () => {
    const out = await data(ctxWithSession(undefined) as any);
    expect(out.displayMode).toBe("tabla");
  });

  it("ignores unknown preference values (falls back to tabla)", async () => {
    const out = await data(ctxWithSession({ reservasDisplayMode: "cards" }) as any);
    expect(out.displayMode).toBe("tabla");
  });
});
