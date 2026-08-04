import { describe, expect, it } from "vitest";

import {
  ALLERGEN_ALIAS_TO_CANONICAL,
  ALLERGEN_KEYS,
  CANONICAL_ALLERGENS,
  allergenIconSrc,
  allergenLabel,
  normalizeAllergen,
  normalizeAllergenList,
} from "./allergens";

describe("canonical allergen list", () => {
  it("declares the 14 EU regulated allergens", () => {
    expect(CANONICAL_ALLERGENS).toHaveLength(14);
    expect(ALLERGEN_KEYS.size).toBe(14);
  });

  it("gives every allergen an icon and a label", () => {
    for (const allergen of CANONICAL_ALLERGENS) {
      expect(allergen.icon).toMatch(/^\/media\/images\/.+\.png$/);
      expect(allergen.label.length).toBeGreaterThan(0);
    }
  });

  it("keeps the icon paths used by MenuDishPreviewCard", () => {
    expect(allergenIconSrc("Gluten")).toBe("/media/images/gluten.png");
    expect(allergenIconSrc("Frutos de cascara")).toBe("/media/images/frutoscascara.png");
    expect(allergenIconSrc("Moluscos")).toBe("/media/images/moluscos.png");
  });

  it("returns null for an unknown key instead of a broken image", () => {
    expect(allergenIconSrc("Kryptonita")).toBeNull();
  });

  it("labels a known key and falls back to the raw key otherwise", () => {
    expect(allergenLabel("Leche")).toBe("Leche");
    expect(allergenLabel("Kryptonita")).toBe("Kryptonita");
  });
});

describe("normalizeAllergen", () => {
  it("accepts canonical keys unchanged", () => {
    expect(normalizeAllergen("Gluten")).toBe("Gluten");
  });

  it("resolves legacy aliases", () => {
    expect(normalizeAllergen("lacteos")).toBe("Leche");
    expect(normalizeAllergen("frutos secos")).toBe("Frutos de cascara");
    expect(normalizeAllergen("frutos_secos")).toBe("Frutos de cascara");
  });

  it("is case and whitespace insensitive", () => {
    expect(normalizeAllergen("  GLUTEN  ")).toBe("Gluten");
    expect(normalizeAllergen("Lacteos")).toBe("Leche");
  });

  it("resolves accented spellings to the unaccented canonical key", () => {
    expect(normalizeAllergen("Sésamo")).toBe("Sesamo");
    expect(normalizeAllergen("crustáceos")).toBe("Crustaceos");
    expect(normalizeAllergen("Frutos de cáscara")).toBe("Frutos de cascara");
  });

  it("returns null for unknown or empty input", () => {
    expect(normalizeAllergen("Kryptonita")).toBeNull();
    expect(normalizeAllergen("")).toBeNull();
    expect(normalizeAllergen(null)).toBeNull();
    expect(normalizeAllergen(undefined)).toBeNull();
  });

  it("maps every declared alias to a canonical key", () => {
    for (const canonical of Object.values(ALLERGEN_ALIAS_TO_CANONICAL)) {
      expect(ALLERGEN_KEYS.has(canonical)).toBe(true);
    }
  });
});

describe("normalizeAllergenList", () => {
  it("normalizes, de-duplicates and drops unknown entries", () => {
    expect(normalizeAllergenList(["gluten", "Gluten", "lacteos", "Kryptonita", ""])).toEqual([
      "Gluten",
      "Leche",
    ]);
  });

  it("returns canonical display order, not input order", () => {
    expect(normalizeAllergenList(["Moluscos", "Gluten", "Leche"])).toEqual([
      "Gluten",
      "Leche",
      "Moluscos",
    ]);
  });

  it("tolerates a non-array input", () => {
    expect(normalizeAllergenList(null)).toEqual([]);
    expect(normalizeAllergenList(undefined)).toEqual([]);
  });
});
