import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProductionTypeSection } from "./ProductionTypeSection";

const SHEET = {
  id: 5, name: "Salsa brava", status: "PUBLISHED", portions: 4, imageUrl: "",
  usageCount: 0, categoryId: 0, categoryName: "", instructions: "Remover",
  componentCount: 2, stepCount: 1, allergens: ["Gluten"],
  sellingPriceGross: 6.5, prepTimeMin: 20,
};

function mockApi() {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.includes("/stock/categories")) {
      return { ok: true, json: async () => ({ success: true, categories: [] }) };
    }
    if (href.includes("/comida/technical-sheets") && init?.method === "POST") {
      return { ok: true, json: async () => ({ success: true, sheetId: 77, outputItemId: 9 }) };
    }
    if (href.match(/technical-sheets\/\d+\/(components|steps|cost|allergens)/)) {
      return {
        ok: true,
        json: async () => ({
          success: true, components: [], steps: [],
          derived: [], manualAdded: [], manualDisabled: [], effective: [], contributors: {},
          cost: {
            lines: [], ingredientCost: 0, labourCost: 0, directVariableCost: 0, totalCost: 0,
            costPerPortion: 0, grossPrice: 0, netPrice: 0, vatRate: 0, foodCostPct: 0,
            grossMargin: 0, costComplete: true, missingPrices: [],
          },
        }),
      };
    }
    return { ok: true, json: async () => ({ success: true, sheets: [SHEET] }) };
  }) as unknown as typeof fetch;
}

function renderSection(overrides: Record<string, unknown> = {}) {
  const onSheetLinked = vi.fn();
  const onSheetPicked = vi.fn();
  render(
    <ProductionTypeSection
      itemId={null}
      productionType="MANUFACTURED"
      stockRecipeId={null}
      productName="Paella"
      onChange={vi.fn()}
      onSheetLinked={onSheetLinked}
      onSheetPicked={onSheetPicked}
      {...overrides}
    />,
  );
  return { onSheetLinked, onSheetPicked };
}

describe("ProductionTypeSection browsing", () => {
  beforeEach(() => mockApi());

  // Preparado used to create a sheet immediately; now it browses first, so no
  // draft is created until the user actually asks for one.
  it("shows the browser instead of creating a sheet straight away", async () => {
    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("technical-sheet-browser")).toBeInTheDocument(),
    );
    const posts = (global.fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls
      .filter((call) => call[1]?.method === "POST");
    expect(posts).toHaveLength(0);
    expect(screen.queryByTestId("technical-sheet-editor")).not.toBeInTheDocument();
  });

  it("reports the picked sheet so the form can be filled from it", async () => {
    const { onSheetPicked, onSheetLinked } = renderSection();
    await waitFor(() => expect(screen.getByTestId("sheet-card-5")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("sheet-card-5"));

    await waitFor(() => expect(onSheetPicked).toHaveBeenCalledWith(expect.objectContaining({ id: 5 })));
    expect(onSheetLinked).toHaveBeenCalledWith(5);
    // Picking opens the sheet it just chose.
    await waitFor(() => expect(screen.getByTestId("technical-sheet-editor")).toBeInTheDocument());
  });

  it("creates a sheet only when the create button is used", async () => {
    const { onSheetLinked } = renderSection();
    await waitFor(() => expect(screen.getByTestId("technical-sheet-browser")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /crear ficha/i }));

    await waitFor(() => expect(onSheetLinked).toHaveBeenCalledWith(77));
    await waitFor(() => expect(screen.getByTestId("technical-sheet-editor")).toBeInTheDocument());
  });

  it("offers a back control that returns to the list", async () => {
    renderSection();
    await waitFor(() => expect(screen.getByTestId("sheet-card-5")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("sheet-card-5"));
    await waitFor(() => expect(screen.getByTestId("technical-sheet-editor")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    await waitFor(() =>
      expect(screen.getByTestId("technical-sheet-browser")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("technical-sheet-editor")).not.toBeInTheDocument();
  });

  // A product that already has a sheet should open it, not ask again.
  it("opens the linked sheet directly when the product already has one", async () => {
    renderSection({ stockRecipeId: 42, itemId: 12 });
    await waitFor(() => expect(screen.getByTestId("technical-sheet-editor")).toBeInTheDocument());
    expect(screen.queryByTestId("technical-sheet-browser")).not.toBeInTheDocument();
  });
});
