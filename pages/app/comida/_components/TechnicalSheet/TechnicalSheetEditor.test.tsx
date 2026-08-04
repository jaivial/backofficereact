import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TechnicalSheetEditor } from "./TechnicalSheetEditor";

const COMPONENTS = [
  {
    id: 10, stockItemId: 1, name: "Harina", quantity: 500, unitId: 3, unitCode: "g",
    qtyBase: 500, baseUnit: "g", wastePct: 0, isOptional: false,
  },
];
const STEPS = [
  {
    id: 20, stepNo: 1, title: "Amasar", description: "Amasar 10 min", imageUrl: "",
    generationStatus: "NONE", generationMode: "", generationError: "",
  },
];
const COST = {
  lines: [
    { stockItemId: 1, name: "Harina", qtyBase: 500, baseUnit: "g", enteredQty: 500,
      unitLabel: "g", wastePct: 0, unitCostBase: 0.01, lineCost: 5, priceMissing: false },
  ],
  ingredientCost: 5, labourCost: 0, directVariableCost: 0, totalCost: 5,
  costPerPortion: 1.25, grossPrice: 18, netPrice: 16.36, vatRate: 10,
  foodCostPct: 30.5, grossMargin: 11.36, zone: "GREEN",
  costComplete: true, missingPrices: [],
};
// Canonical casing, as the server sends it: the grid keys cards by canonical name.
const ALLERGENS = {
  derived: ["Gluten"], manualAdded: [], manualDisabled: [],
  effective: ["Gluten"], contributors: { Gluten: ["Harina"] },
};

function mockApi(costOverride?: Record<string, unknown>) {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url);
    if (init?.method === "PATCH" && href.includes("/allergens")) {
      const added = JSON.parse(String(init.body)).added as string[];
      return {
        ok: true,
        json: async () => ({
          success: true,
          derived: ALLERGENS.derived,
          manualAdded: added,
          manualDisabled: [],
          effective: [...ALLERGENS.derived, ...added],
          contributors: ALLERGENS.contributors,
        }),
      };
    }
    const payload = href.includes("/components")
      ? { components: COMPONENTS }
      : href.includes("/steps")
        ? { steps: STEPS }
        : href.includes("/cost")
          ? { cost: { ...COST, ...costOverride } }
          : href.includes("/allergens")
            ? ALLERGENS
            : {};
    return { ok: true, json: async () => ({ success: true, ...payload }) };
  }) as unknown as typeof fetch;
}

describe("TechnicalSheetEditor", () => {
  beforeEach(() => mockApi());

  it("offers the three documented subtabs", async () => {
    render(<TechnicalSheetEditor sheetId={1} sheetName="Pan" />);
    expect(screen.getByRole("tab", { name: /informaci/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /receta/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /coste/i })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Harina")).toBeTruthy());
  });

  it("shows ingredients on the information tab", async () => {
    render(<TechnicalSheetEditor sheetId={1} sheetName="Pan" />);
    await waitFor(() => expect(screen.getByText("Harina")).toBeTruthy());
    expect(screen.getByText(/500/)).toBeTruthy();
  });

  // Derived allergens come from the ingredients, so they must be visibly locked
  // rather than silently unremovable.
  it("locks derived allergens and names the ingredient responsible", async () => {
    render(<TechnicalSheetEditor sheetId={1} sheetName="Pan" />);
    const card = () => document.querySelector('[data-allergen="Gluten"]') as HTMLElement | null;
    await waitFor(() => expect(card()).not.toBeNull());
    expect(card()!.getAttribute("aria-disabled")).toBe("true");
    expect(card()!.getAttribute("title")).toContain("Harina");
  });

  it("shows the recipe steps in order on the recipe tab", async () => {
    render(<TechnicalSheetEditor sheetId={1} sheetName="Pan" />);
    fireEvent.click(screen.getByRole("tab", { name: /receta/i }));
    // The step text is editable, so it lives in form fields rather than in
    // static nodes.
    await waitFor(() =>
      expect(screen.getByLabelText(/titulo del paso 1/i)).toHaveValue("Amasar"),
    );
    expect(screen.getByLabelText(/descripcion del paso 1/i)).toHaveValue("Amasar 10 min");
  });

  it("shows the cost total and the margin zone as text, not colour alone", async () => {
    render(<TechnicalSheetEditor sheetId={1} sheetName="Pan" />);
    fireEvent.click(screen.getByRole("tab", { name: /coste/i }));
    await waitFor(() => expect(screen.getByTestId("sheet-cost-total")).toBeTruthy());
    expect(screen.getByTestId("sheet-cost-total").textContent).toContain("5");
    // The zone must be readable without seeing the colour.
    expect(screen.getByTestId("sheet-cost-zone").textContent).toMatch(/correcto|verde|green/i);
  });

  // The single most important cost rule: an unpriced ingredient must be called
  // out, never absorbed into a confident-looking total.
  // Regression: the PATCH response used to carry only "final", so the component
  // replaced its state with an object that had no effective list and the chip
  // for the just-added allergen never appeared.
  it("shows a manually added allergen straight after adding it", async () => {
    render(<TechnicalSheetEditor sheetId={1} sheetName="Pan" />);
    const cardFor = (key: string) =>
      document.querySelector(`[data-role="sheet-alergeno-option"][data-allergen="${key}"]`);
    await waitFor(() => expect(cardFor("Gluten")).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /anadir alergeno/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^leche$/i }));

    await waitFor(() => expect(cardFor("Leche")).not.toBeNull());
    // The derived one must survive the update.
    expect(cardFor("Gluten")).not.toBeNull();
  });

  it("warns loudly when the cost is incomplete", async () => {
    mockApi({ costComplete: false, missingPrices: ["Azafran"], zone: undefined });
    render(<TechnicalSheetEditor sheetId={1} sheetName="Pan" />);
    fireEvent.click(screen.getByRole("tab", { name: /coste/i }));

    await waitFor(() => expect(screen.getByTestId("sheet-cost-incomplete")).toBeTruthy());
    expect(screen.getByTestId("sheet-cost-incomplete").textContent).toContain("Azafran");
    // No zone may be shown while the number is known to be wrong.
    expect(screen.queryByTestId("sheet-cost-zone")).toBeNull();
  });
});

// The popover and the Informacion grid are two views of one set. A change in
// either must appear in both, or the user sees contradictory state.
describe("TechnicalSheetEditor allergen sync", () => {
  beforeEach(() => mockApi());

  const inGrid = (key: string) =>
    document.querySelector(`[data-role="sheet-alergeno-option"][data-allergen="${key}"]`);
  const inPicker = (key: string) =>
    document.querySelector(`[data-role="sheet-alergeno-picker-option"][data-allergen="${key}"]`);

  it("shows an allergen added in the popover in the grid, and marks it selected in both", async () => {
    render(<TechnicalSheetEditor sheetId={1} sheetName="Pan" />);
    await waitFor(() => expect(inGrid("Gluten")).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /anadir alergeno/i }));
    await waitFor(() => expect(inPicker("Leche")).not.toBeNull());
    fireEvent.click(inPicker("Leche")!);

    // The grid gains the card...
    await waitFor(() => expect(inGrid("Leche")).not.toBeNull());
    // ...and the popover now shows it as selected rather than still on offer.
    expect(inPicker("Leche")!.getAttribute("aria-pressed")).toBe("true");
  });

  // The picker reflects the sheet's derived allergens too, locked, so it cannot
  // be used as a back door around the food-safety rule.
  it("locks a derived allergen inside the popover as well", async () => {
    render(<TechnicalSheetEditor sheetId={1} sheetName="Pan" />);
    await waitFor(() => expect(inGrid("Gluten")).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /anadir alergeno/i }));
    await waitFor(() => expect(inPicker("Gluten")).not.toBeNull());

    const gluten = inPicker("Gluten")!;
    expect(gluten.getAttribute("aria-disabled")).toBe("true");
    expect(gluten.getAttribute("title")).toContain("Harina");
  });
});
