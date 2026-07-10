import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { FoodItemModal } from "./FoodItemModal";
import { expectAllElementsHaveDataAttr } from "../../../../lib/test/assertDataAttrs";

vi.mock("../../../../api/client", () => ({
  createClient: () => ({
    comida: {
      platos: { create: vi.fn(), patch: vi.fn(), categories: { list: vi.fn(() => new Promise(() => {})) } },
      bebidas: { create: vi.fn(), patch: vi.fn() },
      cafes: { create: vi.fn(), patch: vi.fn() },
      postres: { create: vi.fn(), patch: vi.fn() },
    },
  }),
}));

describe("FoodItemModal data-* attributes", () => {
  it("all rendered HTML elements have a semantic data-* attribute when open for platos", () => {
    const { container } = render(
      <FoodItemModal
        open={true}
        item={null}
        foodType="platos"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const portal = container.querySelector("[data-role='dialog']") || container;
    expectAllElementsHaveDataAttr(portal as HTMLElement);
  });
});
