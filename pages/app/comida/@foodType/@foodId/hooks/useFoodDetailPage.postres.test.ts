import { describe, expect, it } from "vitest";

import { detailEditorSupport } from "./useFoodDetailPage";

// Postres were the only catalogue type with no detail editor, which is why the
// "Tipo de producto" section could never appear for them. The support flags are
// extracted so this rule is testable without mounting the whole page.
describe("detailEditorSupport", () => {
  it("gives every non-wine catalogue type the quick editor", () => {
    for (const foodType of ["platos", "cafes", "bebidas", "postres"]) {
      expect(detailEditorSupport(foodType).supportsQuickEditor).toBe(true);
    }
  });

  // Wine has its own editor; routing it through the quick editor would render
  // two editors for the same product.
  it("leaves wine to its own editor", () => {
    expect(detailEditorSupport("vinos").supportsQuickEditor).toBe(false);
    expect(detailEditorSupport("vinos").isWine).toBe(true);
  });

  // Postres have no price or category columns, so the fields that depend on
  // them must not be claimed as supported.
  it("marks postres as a dessert rather than a plate", () => {
    const support = detailEditorSupport("postres");
    expect(support.isPostre).toBe(true);
    expect(support.isPlate).toBe(false);
  });
});
