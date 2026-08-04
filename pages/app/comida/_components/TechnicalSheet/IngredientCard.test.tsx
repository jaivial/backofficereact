import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { IngredientCard } from "./IngredientCard";

const COMPONENT = {
  id: 5, stockItemId: 1, name: "Harina de trigo", quantity: 500, unitId: 3,
  unitCode: "g", qtyBase: 500, baseUnit: "g", wastePct: 0, isOptional: false,
  imageUrl: "",
};

function renderCard(overrides: Record<string, unknown> = {}) {
  const onRemove = vi.fn();
  render(<IngredientCard component={{ ...COMPONENT, ...overrides }} onRemove={onRemove} />);
  return onRemove;
}

describe("IngredientCard", () => {
  it("shows the name, the quantity and its unit", () => {
    renderCard();
    expect(screen.getByText("Harina de trigo")).toBeInTheDocument();
    expect(screen.getByText(/500\s*g/)).toBeInTheDocument();
  });

  it("shows the picture when the stock item has one", () => {
    renderCard({ imageUrl: "https://cdn/x.webp" });
    expect(screen.getByRole("img", { name: /harina de trigo/i })).toBeInTheDocument();
  });

  // A missing photo must not collapse the card: the placeholder holds the space.
  it("falls back to a placeholder when there is no picture", () => {
    renderCard();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("ingredient-image-placeholder-5")).toBeInTheDocument();
  });

  // Waste changes the real cost, so 0 % must read as "none" rather than "0".
  it("shows a dash when there is no waste, and the value when there is", () => {
    renderCard();
    expect(screen.getByTestId("ingredient-waste-5").textContent).toBe("—");
    render(<IngredientCard component={{ ...COMPONENT, id: 6, wastePct: 12 }} onRemove={vi.fn()} />);
    expect(screen.getByTestId("ingredient-waste-6").textContent).toContain("12");
  });

  // Icon-only actions still need an accessible name.
  it("removes through an icon button that names the ingredient", () => {
    const onRemove = renderCard();
    const button = screen.getByRole("button", { name: /quitar harina de trigo/i });
    expect(button.textContent?.trim()).toBe("");
    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalledWith(5);
  });
});
