import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TechnicalSheetCostTab } from "./TechnicalSheetCostTab";
import type { SheetCost } from "./sheetsApi";

const BASE: SheetCost = {
  lines: [], ingredientCost: 0, labourCost: 0, directVariableCost: 0, totalCost: 0,
  costPerPortion: 0, grossPrice: 0, netPrice: 0, vatRate: 0, foodCostPct: 0,
  grossMargin: 0, costComplete: true, missingPrices: [],
};

describe("TechnicalSheetCostTab", () => {
  // A dish with no ingredients has no cost breakdown to show; an empty table
  // with headers looks like a loading failure.
  it("explains the empty state instead of rendering an empty table", () => {
    render(<TechnicalSheetCostTab cost={BASE} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/sin ingredientes/i)).toBeInTheDocument();
  });

  it("shows the breakdown once there are ingredients", () => {
    render(
      <TechnicalSheetCostTab
        cost={{
          ...BASE,
          lines: [{
            stockItemId: 1, name: "Harina", qtyBase: 500, baseUnit: "g", enteredQty: 500,
            unitLabel: "g", wastePct: 0, unitCostBase: 0.01, lineCost: 5, priceMissing: false,
          }],
          ingredientCost: 5, totalCost: 5, costPerPortion: 1.25,
        }}
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Harina")).toBeInTheDocument();
  });

  // A missing price is unknown, never zero: it must be visible on the line.
  it("marks a line whose price is unknown", () => {
    render(
      <TechnicalSheetCostTab
        cost={{
          ...BASE,
          lines: [{
            stockItemId: 2, name: "Azafran", qtyBase: 1, baseUnit: "g", enteredQty: 1,
            unitLabel: "g", wastePct: 0, unitCostBase: 0, lineCost: 0, priceMissing: true,
          }],
          costComplete: false, missingPrices: ["Azafran"],
        }}
      />,
    );
    // Scoped to the table: the warning banner also mentions the missing price.
    const row = screen.getByRole("row", { name: /azafran/i });
    expect(row.textContent).toMatch(/sin precio/i);
    expect(screen.getByTestId("sheet-cost-incomplete")).toBeInTheDocument();
  });

  // The summary is meaningless before anything has been costed.
  it("does not show a summary of zeros when nothing has been costed", () => {
    render(<TechnicalSheetCostTab cost={BASE} />);
    expect(screen.queryByTestId("sheet-cost-summary")).not.toBeInTheDocument();
  });

  it("shows the summary when there is something to summarise", () => {
    render(
      <TechnicalSheetCostTab
        cost={{
          ...BASE,
          lines: [{
            stockItemId: 1, name: "Harina", qtyBase: 500, baseUnit: "g", enteredQty: 500,
            unitLabel: "g", wastePct: 0, unitCostBase: 0.01, lineCost: 5, priceMissing: false,
          }],
          ingredientCost: 5, totalCost: 5, costPerPortion: 1.25,
        }}
      />,
    );
    expect(screen.getByTestId("sheet-cost-summary")).toBeInTheDocument();
  });

  it("says it is still calculating when there is no cost yet", () => {
    render(<TechnicalSheetCostTab cost={null} />);
    expect(screen.getByText(/calculando/i)).toBeInTheDocument();
  });
});
