import { describe, it, expect, vi } from "vitest";

vi.mock("vike-react/useConfig", () => ({
  useConfig: () => () => undefined,
}));

vi.mock("../../../../../api/client", () => ({
  createClient: () => ({
    comida: {
      vinos: { get: vi.fn() },
    },
  }),
}));

import { data } from "./+data";

function makePageContext(foodType: string, foodId: string) {
  return {
    routeParams: { foodType, foodId },
    urlPathname: `/app/comida/${foodType}/${foodId}`,
    boRequest: {
      backendOrigin: "http://127.0.0.1:8080",
      cookieHeader: "",
    },
  } as any;
}

describe("+data wine creation route (foodId='new')", () => {
  it("returns isNew=true when foodId route param is 'new'", async () => {
    const result = await data(makePageContext("vinos", "new"));
    expect(result.isNew).toBe(true);
  });

  it("returns foodType='vinos' when foodId is 'new'", async () => {
    const result = await data(makePageContext("vinos", "new"));
    expect(result.foodType).toBe("vinos");
  });

  it("returns isNew=false for a numeric foodId", async () => {
    const result = await data(makePageContext("vinos", "42"));
    expect(result.isNew).toBe(false);
  });

  it("returns item=null when foodId is 'new' (no backend fetch)", async () => {
    const result = await data(makePageContext("vinos", "new"));
    expect(result.item).toBeNull();
  });

  it("returns no error when foodId is 'new'", async () => {
    const result = await data(makePageContext("vinos", "new"));
    expect(result.error).toBeNull();
  });
});
