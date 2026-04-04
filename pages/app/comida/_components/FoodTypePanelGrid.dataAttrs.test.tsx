import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { FoodTypePanelGrid } from "./FoodTypePanelGrid";
import { expectAllElementsHaveDataAttr } from "../../../../lib/test/assertDataAttrs";

describe("FoodTypePanelGrid data-* attributes", () => {
  it("all rendered HTML elements have a semantic data-* attribute", () => {
    const { container } = render(
      <FoodTypePanelGrid
        countsByType={{ vinos: 5, cafes: 3, postres: 2, platos: 10, bebidas: 7 }}
        onSelect={vi.fn()}
      />,
    );
    expectAllElementsHaveDataAttr(container);
  });
});
