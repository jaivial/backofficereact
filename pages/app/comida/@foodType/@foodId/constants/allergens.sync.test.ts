import { describe, expect, it } from "vitest";

import { ALLERGEN_KEYS, CANONICAL_ALLERGENS } from "../../../../../../ui/widgets/allergens/allergens";
import { ALLERGEN_ALIAS_TO_CARD, CARD_ALLERGENS, CARD_ALLERGEN_KEYS } from "./index";

describe("comida allergen constants stay in sync with the shared canonical list", () => {
  it("declares the same allergen keys, in the same order", () => {
    expect(CARD_ALLERGENS.map((item) => item.key)).toEqual(CANONICAL_ALLERGENS.map((item) => item.key));
  });

  it("exposes the same key set", () => {
    expect([...CARD_ALLERGEN_KEYS].sort()).toEqual([...ALLERGEN_KEYS].sort());
  });

  it("maps every alias to a canonical key", () => {
    for (const canonical of Object.values(ALLERGEN_ALIAS_TO_CARD)) {
      expect(ALLERGEN_KEYS.has(canonical)).toBe(true);
    }
  });

  it("still attaches a lucide icon to every allergen", () => {
    for (const item of CARD_ALLERGENS) {
      expect(item.icon).toBeTruthy();
    }
  });
});
