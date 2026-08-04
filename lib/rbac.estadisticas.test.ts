import { describe, expect, it } from "vitest";

import { hasSectionAccess, isPathAllowed, sidebarItemsForRole } from "./rbac";

describe("estadisticas access", () => {
  it("defaults statistics to root and admin only", () => {
    expect(hasSectionAccess("root", "estadisticas", [], 100)).toBe(true);
    expect(hasSectionAccess("admin", "estadisticas", [], 90)).toBe(true);
    expect(hasSectionAccess("admin", "estadisticas", ["fichaje"], 90)).toBe(true);
    expect(hasSectionAccess("metre", "estadisticas", [], 70)).toBe(false);
    expect(hasSectionAccess("camarero", "estadisticas", [], 40)).toBe(false);
  });

  it("maps statistics route and sidebar permission", () => {
    expect(isPathAllowed("/app/estadisticas", "admin", ["estadisticas"], 90)).toBe(true);
    expect(isPathAllowed("/app/estadisticas", "metre", ["fichaje"], 70)).toBe(false);
    expect(sidebarItemsForRole("admin", ["estadisticas"], 90)).toEqual(
      expect.arrayContaining([{ key: "estadisticas", href: "/app/estadisticas", label: "Estadisticas" }]),
    );
  });
});
