import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { AllergenSelectGrid, CANONICAL_ALLERGEN_OPTIONS } from "./AllergenSelectGrid";

describe("AllergenSelectGrid", () => {
  it("renders one card per option inside the shared grid", () => {
    render(<AllergenSelectGrid options={CANONICAL_ALLERGEN_OPTIONS} selected={[]} onToggle={vi.fn()} />);
    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(14);
    // Same classes as the product modal, so both grids are styled by one rule.
    expect(cards[0].className).toContain("bo-allergenCircle");
    expect(screen.getByTestId("allergen-select-grid").className).toContain("bo-allergenGrid");
  });

  it("marks the selected ones in a non-colour channel too", () => {
    render(
      <AllergenSelectGrid options={CANONICAL_ALLERGEN_OPTIONS} selected={["Gluten"]} onToggle={vi.fn()} />,
    );
    const gluten = screen.getByRole("button", { name: /gluten/i });
    expect(gluten).toHaveAttribute("aria-pressed", "true");
    expect(gluten.className).toContain("is-selected");
  });

  it("reports the toggled allergen", () => {
    const onToggle = vi.fn();
    render(<AllergenSelectGrid options={CANONICAL_ALLERGEN_OPTIONS} selected={[]} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /^leche$/i }));
    expect(onToggle).toHaveBeenCalledWith("Leche", true);
  });

  it("reports a de-selection when an already selected card is clicked", () => {
    const onToggle = vi.fn();
    render(
      <AllergenSelectGrid options={CANONICAL_ALLERGEN_OPTIONS} selected={["Leche"]} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^leche$/i }));
    expect(onToggle).toHaveBeenCalledWith("Leche", false);
  });

  // A derived allergen comes from the ingredients. Unticking "gluten" on a dish
  // made of flour would be a food-safety lie, so it must be refused.
  it("locks derived allergens and never reports a change for them", () => {
    const onToggle = vi.fn();
    render(
      <AllergenSelectGrid
        options={CANONICAL_ALLERGEN_OPTIONS}
        selected={["Gluten"]}
        locked={["Gluten"]}
        lockedReasons={{ Gluten: "Detectado por: Harina" }}
        onToggle={onToggle}
      />,
    );
    const gluten = screen.getByRole("button", { name: /gluten/i });
    expect(gluten).toHaveAttribute("aria-disabled", "true");
    expect(gluten.getAttribute("title")).toContain("Harina");
    fireEvent.click(gluten);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("accepts the slug-based options the product modal already persists", () => {
    const onToggle = vi.fn();
    render(
      <AllergenSelectGrid
        options={[{ value: "frutos_secos", label: "Frutos secos", icon: <span /> }]}
        selected={["frutos_secos"]}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /frutos secos/i }));
    expect(onToggle).toHaveBeenCalledWith("frutos_secos", false);
  });
});

describe("AllergenSelectGrid badges", () => {
  // Allergens inherited from a technical sheet need to be distinguishable from
  // the ones the user ticked by hand, otherwise "why can't I remove this?" has
  // no answer on screen.
  it("marks a badged allergen in the corner and names the reason", () => {
    render(
      <AllergenSelectGrid
        options={CANONICAL_ALLERGEN_OPTIONS}
        selected={["Gluten"]}
        locked={["Gluten"]}
        badges={{ Gluten: "FT" }}
        lockedReasons={{ Gluten: "Viene de la ficha tecnica" }}
        onToggle={vi.fn()}
      />,
    );
    const gluten = screen.getByRole("button", { name: /gluten/i });
    const badge = gluten.querySelector("[data-role='allergen-option-badge']");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("FT");
    expect(gluten.getAttribute("title")).toContain("ficha tecnica");
  });

  // Only one marker may occupy the corner, or the badge and the padlock overlap.
  it("shows the badge instead of the padlock when both would apply", () => {
    render(
      <AllergenSelectGrid
        options={CANONICAL_ALLERGEN_OPTIONS}
        selected={["Gluten"]}
        locked={["Gluten"]}
        badges={{ Gluten: "FT" }}
        onToggle={vi.fn()}
      />,
    );
    const gluten = screen.getByRole("button", { name: /gluten/i });
    expect(gluten.querySelector("[data-role='allergen-option-badge']")).not.toBeNull();
    expect(gluten.querySelector(".bo-allergenCircleLock")).toBeNull();
  });

  it("leaves un-badged allergens unmarked", () => {
    render(
      <AllergenSelectGrid
        options={CANONICAL_ALLERGEN_OPTIONS}
        selected={[]}
        badges={{ Gluten: "FT" }}
        onToggle={vi.fn()}
      />,
    );
    const leche = screen.getByRole("button", { name: /^leche$/i });
    expect(leche.querySelector("[data-role='allergen-option-badge']")).toBeNull();
  });
});
