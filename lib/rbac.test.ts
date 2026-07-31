import { describe, expect, it } from "vitest";
import { hasSectionAccess, sidebarItemsForRole } from "./rbac";

describe("POS and stock navigation access", () => {
  it("keeps stock and POS visible for admin with legacy explicit sections", () => {
    const sections = ["reservas", "menus", "comida"];
    expect(hasSectionAccess("admin", "stock", sections, 90)).toBe(true);
    expect(hasSectionAccess("admin", "pos", sections, 90)).toBe(true);
    expect(sidebarItemsForRole("admin", sections, 90).map((item) => item.key)).toEqual(expect.arrayContaining(["stock", "pos"]));
  });

  it("keeps stock and POS hidden for non-admin roles without permission", () => {
    expect(hasSectionAccess("camarero", "stock", ["fichaje"], 40)).toBe(false);
    expect(hasSectionAccess("camarero", "pos", ["fichaje"], 40)).toBe(false);
  });
});
