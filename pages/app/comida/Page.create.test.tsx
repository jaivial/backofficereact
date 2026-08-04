import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Page from "./+Page";

describe("Comida hub create flow", () => {
  it("opens type onboarding in glass modal", () => {
    render(<Page />);

    fireEvent.click(screen.getByRole("button", { name: "Crear elemento de comida" }));

    expect(screen.getByRole("dialog", { name: "Crear elemento de comida" })).toHaveClass("bo-modal", "bo-modal--glass");
    for (const name of ["Plato", "Bebida", "Vino", "Cafe"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("bo-foodHubCard");
    }
  });

  it("uses plato /new fields", async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Crear elemento de comida" }));
    fireEvent.click(screen.getByRole("button", { name: "Plato" }));

    const modal = await screen.findByRole("dialog", { name: "Nuevo elemento" });
    expect(modal.querySelector('[data-ui="food-modal-field-tipo"]')).toBeTruthy();
    expect(modal.querySelector('[data-ui="food-modal-field-categoria"]')).toBeTruthy();
    expect(modal.querySelector('[data-role="food-modal-input-precio"]')).toHaveValue(0);
    // The switch row is styled by a named class now; the amount input is a
    // sibling below it rather than inline, so the row only holds label+switch.
    const supplementRow = modal.querySelector('[data-ui="food-modal-supplement-head"]') as HTMLElement;
    expect(supplementRow).toHaveClass("bo-foodModalSupplementHead");
    expect(supplementRow.parentElement).toHaveClass("bo-foodModalSupplementField");
    expect(supplementRow.querySelector('[data-role="food-modal-input-suplemento"]')).toBeNull();
    expect(modal.querySelector('[data-role="food-modal-visibility-switch"]')).toHaveAttribute("aria-checked", "false");

    const gluten = modal.querySelector('[data-role="food-modal-alergeno-option"][data-allergen="gluten"]') as HTMLButtonElement;
    expect(gluten).toHaveClass("bo-allergenCircle", "is-unselected");
    fireEvent.click(gluten);
    expect(gluten).toHaveClass("is-selected");
    expect(gluten).toHaveAttribute("aria-pressed", "true");
  });

  it.each([
    ["Plato", "Nuevo elemento"],
    ["Bebida", "Nuevo elemento"],
    ["Cafe", "Nuevo elemento"],
    ["Vino", "Nuevo vino"],
  ])("uses %s form after selection", async (type, title) => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Crear elemento de comida" }));
    fireEvent.click(screen.getByRole("button", { name: type }));

    expect(await screen.findByRole("dialog", { name: title })).toHaveClass("bo-modal", "bo-modal--glass");
  });
});
