import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FoodDetailQuickEditor } from "./FoodDetailQuickEditor";

// The "Editar" button on /app/comida navigates HERE, so this is the screen the
// user actually means when they ask where the technical sheet controls are.
const BASE_PROPS = {
  isPlate: true,
  isBebida: false,
  savingQuick: false,
  quickCanSave: true,
  quickName: "Paella",
  quickTipo: "PRINCIPAL",
  quickPrecio: "18.00",
  quickSuplemento: "",
  quickHasSuplemento: false,
  quickCategoria: "",
  quickDescripcion: "",
  quickActive: true,
  categoriesLoading: false,
  quickTipoOptions: [{ value: "PRINCIPAL", label: "Principal" }],
  quickCategorySelectOptions: [],
  allergenList: [],
  savingAllergens: false,
  onOpenAllergenModal: vi.fn(),
  onToggleAllergen: vi.fn(),
  onQuickNameChange: vi.fn(),
  onQuickTipoChange: vi.fn(),
  onQuickPrecioChange: vi.fn(),
  onQuickSuplementoChange: vi.fn(),
  onQuickHasSuplementoChange: vi.fn(),
  onQuickCategoriaChange: vi.fn(),
  onQuickDescripcionChange: vi.fn(),
  onQuickActiveChange: vi.fn(),
  onQuickSave: vi.fn(),
  onAddCategoryClick: vi.fn(),
};

beforeEach(() => {
  // Choosing Preparado creates a sheet, so the mock has to answer that call or
  // the tabs legitimately have nothing to render.
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url);
    if (init?.method === "POST" && href.includes("/comida/technical-sheets")) {
      return { ok: true, json: async () => ({ success: true, sheetId: 88, outputItemId: 9 }) };
    }
    return {
      ok: true,
      json: async () => ({
        success: true, sheets: [], components: [], steps: [],
        derived: [], manualAdded: [], manualDisabled: [], effective: [], contributors: {},
        cost: {
          lines: [], ingredientCost: 0, labourCost: 0, directVariableCost: 0, totalCost: 0,
          costPerPortion: 0, grossPrice: 0, netPrice: 0, vatRate: 0, foodCostPct: 0,
          grossMargin: 0, costComplete: true, missingPrices: [],
        },
      }),
    };
  }) as unknown as typeof fetch;
});

describe("FoodDetailQuickEditor technical sheet section", () => {
  it("lets the user mark the dish as elaborated", () => {
    render(<FoodDetailQuickEditor {...BASE_PROPS} itemId={7} productionType="RAW" stockRecipeId={null} />);
    expect(screen.getByTestId("production-type-toggle")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /preparado/i })).toBeTruthy();
  });

  it("shows the saved production type rather than always defaulting to bought", () => {
    render(<FoodDetailQuickEditor {...BASE_PROPS} itemId={7} productionType="MANUFACTURED" stockRecipeId={42} />);
    expect(screen.getByRole("radio", { name: /preparado/i }).getAttribute("aria-checked")).toBe("true");
  });

  it("opens the sheet tabs directly for an elaborated dish", async () => {
    render(<FoodDetailQuickEditor {...BASE_PROPS} itemId={7} productionType="MANUFACTURED" stockRecipeId={42} />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /informaci/i })).toBeTruthy());
    expect(screen.getByRole("tab", { name: /coste/i })).toBeTruthy();
  });

  // A bought product has no recipe, so the sheet controls must stay hidden.
  it("hides the sheet controls while the dish is bought", () => {
    render(<FoodDetailQuickEditor {...BASE_PROPS} itemId={7} productionType="RAW" stockRecipeId={null} />);
    expect(screen.queryByRole("button", { name: /ficha/i })).toBeNull();
  });

  // The switch is shown even before the dish exists: it is the entry point to
  // the feature, so hiding it would make technical sheets undiscoverable. The
  // sheet itself is created when the dish is first saved.
  it("still offers the switch for an unsaved dish", () => {
    render(<FoodDetailQuickEditor {...BASE_PROPS} itemId={null} productionType="RAW" stockRecipeId={null} />);
    expect(screen.getByTestId("production-type-toggle")).toBeTruthy();
  });

  // Even before the dish exists, choosing Preparado opens the sheet so the
  // recipe can be built straight away.
  // Preparado browses the sheet catalogue first; nothing is created until the
  // user picks or explicitly creates one.
  it("offers the sheet browser for an unsaved dish marked Preparado", async () => {
    render(<FoodDetailQuickEditor {...BASE_PROPS} itemId={null} productionType="MANUFACTURED" stockRecipeId={null} />);
    await waitFor(() => expect(screen.getByTestId("technical-sheet-browser")).toBeTruthy());
  });
});
