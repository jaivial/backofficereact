import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { AllergenPickerPopover } from "./AllergenPickerPopover";

function renderPicker(props: Partial<React.ComponentProps<typeof AllergenPickerPopover>> = {}) {
  const anchor = { current: document.createElement("button") };
  document.body.appendChild(anchor.current);
  const onToggle = vi.fn();
  render(
    <AllergenPickerPopover
      open
      anchorRef={anchor}
      selected={[]}
      onClose={() => {}}
      onToggle={onToggle}
      {...props}
    />,
  );
  return onToggle;
}

const card = (key: string) =>
  document.querySelector(`[data-role="sheet-alergeno-picker-option"][data-allergen="${key}"]`);

describe("AllergenPickerPopover", () => {
  // Same component as the sheet's own grid, so the two can never look different.
  it("renders the shared allergen grid", () => {
    renderPicker();
    expect(screen.getByTestId("allergen-select-grid")).toBeInTheDocument();
    expect(screen.getByTestId("allergen-select-grid").className).toContain("bo-allergenGrid");
  });

  // All 14 are offered, not only the missing ones: the picker doubles as a view
  // of what the sheet already declares, which is what keeps it in sync.
  it("offers every regulated allergen", () => {
    renderPicker();
    expect(document.querySelectorAll('[data-role="sheet-alergeno-picker-option"]')).toHaveLength(14);
  });

  it("shows the ones already on the sheet as selected", () => {
    renderPicker({ selected: ["Gluten"] });
    expect(card("Gluten")?.getAttribute("aria-pressed")).toBe("true");
    expect(card("Leche")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("reports an addition", () => {
    const onToggle = renderPicker();
    fireEvent.click(card("Leche")!);
    expect(onToggle).toHaveBeenCalledWith("Leche", true);
  });

  // Clicking a selected one removes it, so the popover edits the same set the
  // main grid shows rather than being add-only.
  it("reports a removal", () => {
    const onToggle = renderPicker({ selected: ["Leche"] });
    fireEvent.click(card("Leche")!);
    expect(onToggle).toHaveBeenCalledWith("Leche", false);
  });

  // A derived allergen comes from the ingredients; unticking it here would be a
  // food-safety lie, exactly as in the main grid.
  it("locks derived allergens", () => {
    const onToggle = renderPicker({
      selected: ["Gluten"],
      derived: ["Gluten"],
      contributors: { Gluten: ["Harina"] },
    });
    const gluten = card("Gluten")!;
    expect(gluten.getAttribute("aria-disabled")).toBe("true");
    expect(gluten.getAttribute("title")).toContain("Harina");
    fireEvent.click(gluten);
    expect(onToggle).not.toHaveBeenCalled();
  });

  // Legacy slugs must resolve, or an allergen stored as "lacteos" would appear
  // unselected and be added twice.
  it("treats a legacy slug as the canonical allergen", () => {
    renderPicker({ selected: ["lacteos"] });
    expect(card("Leche")?.getAttribute("aria-pressed")).toBe("true");
  });
});
