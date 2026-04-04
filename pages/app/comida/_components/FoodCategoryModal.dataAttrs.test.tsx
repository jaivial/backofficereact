import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { FoodCategoryModal } from "./FoodCategoryModal";
import { expectAllElementsHaveDataAttr } from "../../../../lib/test/assertDataAttrs";

describe("FoodCategoryModal data-* attributes", () => {
  it("all rendered HTML elements have a semantic data-* attribute when open", () => {
    const { container } = render(
      <FoodCategoryModal open={true} onClose={vi.fn()} onCreate={vi.fn()} />,
    );
    const portal = container.querySelector("[data-role='dialog']") || container;
    expectAllElementsHaveDataAttr(portal as HTMLElement);
  });
});
