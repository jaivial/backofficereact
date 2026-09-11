import { describe, it, expect } from "vitest";
import {
  getSectionDishesFingerprint,
  mirrorShouldAdoptServerDishes,
} from "../../helpers/menuEditor.helpers";
import type { EditorDish, EditorSection } from "../../types/menuEditor.types";

function dish(overrides: Partial<EditorDish> = {}): EditorDish {
  return {
    clientId: "dish-1",
    id: 101,
    title: "Tarta de queso",
    description: "",
    description_enabled: false,
    allergens: [],
    supplement_enabled: false,
    supplement_price: null,
    price: null,
    active: true,
    position: 0,
    ai_requested: false,
    ai_generating: false,
    ...overrides,
  };
}

function section(overrides: Partial<EditorSection> = {}): EditorSection {
  return {
    clientId: "sec-1",
    id: 10,
    title: "Postres",
    displayTitle: "Postres",
    subtitle: "",
    tabLabel: "",
    kind: "postres",
    dessertSource: "general",
    position: 0,
    annotations: [""],
    dishes: [],
    ...overrides,
  };
}

// Coordination id: dessert_section_source_v1
describe("mirrorShouldAdoptServerDishes", () => {
  it("returns false for a non-mirror section", () => {
    const mapped = section({ kind: "entrantes", dessertSource: "custom" });
    expect(mirrorShouldAdoptServerDishes(mapped, undefined, undefined)).toBe(false);
  });

  it("adopts the server dishes for a mirror with no local copy", () => {
    const mapped = section({ dishes: [dish()] });
    expect(mirrorShouldAdoptServerDishes(mapped, undefined, undefined)).toBe(true);
  });

  it("adopts the server dishes for a freshly added mirror whose local list is still empty", () => {
    // Regression: the add-section flow used to rebuild the mirror from the local
    // (empty) list, hiding every general dessert and then failing on save.
    const mapped = section({ dishes: [dish()] });
    const local = section({ dishes: [] });
    expect(mirrorShouldAdoptServerDishes(mapped, local, undefined)).toBe(true);
  });

  it("keeps unsaved local edits on a mirror", () => {
    const mapped = section({ dishes: [dish()] });
    const local = section({ dishes: [dish({ title: "Editado" })] });
    expect(mirrorShouldAdoptServerDishes(mapped, local, undefined)).toBe(false);
  });

  it("adopts the server list once the local edits are the saved ones", () => {
    const local = section({ dishes: [dish()] });
    const mapped = section({ dishes: [dish()] });
    const saved = getSectionDishesFingerprint(local);
    expect(mirrorShouldAdoptServerDishes(mapped, local, saved)).toBe(true);
  });

  it("keeps local edits that differ from the saved fingerprint", () => {
    const local = section({ dishes: [dish({ title: "Editado" })] });
    const mapped = section({ dishes: [dish()] });
    const saved = getSectionDishesFingerprint(section({ dishes: [dish()] }));
    expect(mirrorShouldAdoptServerDishes(mapped, local, saved)).toBe(false);
  });
});
