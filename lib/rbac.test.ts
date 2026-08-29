import { describe, expect, it } from "vitest";

import {
  normalizeAppVersion,
  sectionAllowedByAppVersion,
} from "./app-version";
import { hasSectionAccess } from "./access-policy";
import { firstAllowedPath, isPathAllowed, sidebarItemsForRole } from "./navigation";

describe("POS and stock navigation access (legacy explicit-sections coverage)", () => {
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

describe("normalizeAppVersion", () => {
  it("defaults empty/unknown values to 0.1", () => {
    expect(normalizeAppVersion(undefined)).toBe("0.1");
    expect(normalizeAppVersion("")).toBe("0.1");
    expect(normalizeAppVersion(null)).toBe("0.1");
    expect(normalizeAppVersion("  ")).toBe("0.1");
    expect(normalizeAppVersion("0.3")).toBe("0.1");
    expect(normalizeAppVersion("garbage")).toBe("0.1");
  });

  it("accepts 0.1 and 0.2", () => {
    expect(normalizeAppVersion("0.1")).toBe("0.1");
    expect(normalizeAppVersion("0.2")).toBe("0.2");
  });
});

describe("sectionAllowedByAppVersion", () => {
  it("v0.2-only modules (stock, pos, estadisticas, plataforma) are blocked on v0.1", () => {
    for (const section of ["stock", "pos", "estadisticas", "plataforma"] as const) {
      expect(sectionAllowedByAppVersion(section, "0.1")).toBe(false);
      expect(sectionAllowedByAppVersion(section, undefined)).toBe(false);
    }
  });

  it("v0.2-only modules are unlocked on v0.2", () => {
    for (const section of ["stock", "pos", "estadisticas", "plataforma"] as const) {
      expect(sectionAllowedByAppVersion(section, "0.2")).toBe(true);
    }
  });

  it("v0.1 modules are always allowed regardless of version", () => {
    for (const section of ["reservas", "menus", "comida", "miembros", "horarios", "fichaje", "facturas", "ajustes"] as const) {
      expect(sectionAllowedByAppVersion(section, "0.1")).toBe(true);
      expect(sectionAllowedByAppVersion(section, "0.2")).toBe(true);
    }
  });
});

describe("hasSectionAccess (root role)", () => {
  const ROOT = "root";

  it("v0.1 root cannot access v0.2-only modules", () => {
    for (const section of ["stock", "pos", "estadisticas", "plataforma"] as const) {
      expect(hasSectionAccess(ROOT, section, undefined, 100, "0.1")).toBe(false);
    }
  });

  it("v0.2 root can access v0.2-only modules", () => {
    for (const section of ["stock", "pos", "estadisticas", "plataforma"] as const) {
      expect(hasSectionAccess(ROOT, section, undefined, 100, "0.2")).toBe(true);
    }
  });

  it("v0.1 root keeps the base modules", () => {
    for (const section of ["reservas", "menus", "comida", "miembros", "horarios", "fichaje", "facturas"] as const) {
      expect(hasSectionAccess(ROOT, section, undefined, 100, "0.1")).toBe(true);
    }
  });
});

describe("sidebarItemsForRole", () => {
  it("v0.1 root does not see Stock, TPV, Estadisticas or Plataforma entries", () => {
    const items = sidebarItemsForRole("root", undefined, 100, "0.1");
    const keys = items.map((i) => i.key);
    expect(keys).toContain("reservas");
    expect(keys).toContain("miembros");
    expect(keys).not.toContain("stock");
    expect(keys).not.toContain("pos");
    expect(keys).not.toContain("estadisticas");
    expect(keys).not.toContain("plataforma");
  });

  it("v0.2 root sees every module", () => {
    const items = sidebarItemsForRole("root", undefined, 100, "0.2");
    const keys = items.map((i) => i.key);
    expect(keys).toContain("stock");
    expect(keys).toContain("pos");
    expect(keys).toContain("estadisticas");
    expect(keys).toContain("plataforma");
    expect(keys).toContain("reservas");
    expect(keys).toContain("miembros");
  });

  it("non-privileged roles are unaffected by version (never had those modules)", () => {
    const items = sidebarItemsForRole("camarero", undefined, 40, "0.2");
    const keys = items.map((i) => i.key);
    expect(keys).toContain("fichaje");
    expect(keys).not.toContain("stock");
    expect(keys).not.toContain("pos");
    expect(keys).not.toContain("plataforma");
  });
});

describe("isPathAllowed", () => {
  it("blocks /app/stock for v0.1 root and allows it for v0.2 root", () => {
    expect(isPathAllowed("/app/stock", "root", undefined, 100, "0.1")).toBe(false);
    expect(isPathAllowed("/app/stock", "root", undefined, 100, "0.2")).toBe(true);
  });

  it("blocks /app/pos and /app/estadisticas for v0.1 root", () => {
    expect(isPathAllowed("/app/pos", "root", undefined, 100, "0.1")).toBe(false);
    expect(isPathAllowed("/app/estadisticas", "root", undefined, 100, "0.1")).toBe(false);
    expect(isPathAllowed("/app/plataforma", "root", undefined, 100, "0.1")).toBe(false);
  });

  it("keeps /app/reservas and /app/miembros open on v0.1", () => {
    expect(isPathAllowed("/app/reservas", "root", undefined, 100, "0.1")).toBe(true);
    expect(isPathAllowed("/app/miembros", "root", undefined, 100, "0.1")).toBe(true);
  });
});

describe("firstAllowedPath", () => {
  it("v0.1 root lands on reservas, never on a gated module", () => {
    const path = firstAllowedPath("root", undefined, 100, "0.1");
    expect(path).toBe("/app/reservas");
  });
});
