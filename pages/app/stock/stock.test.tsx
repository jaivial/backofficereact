import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Page from "./stock";

vi.mock("vike-react/usePageContext",()=>({usePageContext:()=>({bo:{session:{user:{roleImportance:90}}}})}));

vi.mock("lucide-react", () => ({
  Boxes: () => React.createElement("span", { "data-testid": "boxes-icon" }),
  FileScan: () => React.createElement("span", { "data-testid": "file-scan-icon" }),
  Minus: () => React.createElement("span", { "data-testid": "minus-icon" }),
  Plus: () => React.createElement("span", { "data-testid": "plus-icon" }),
  Search: () => React.createElement("span", { "data-testid": "search-icon" }),
  Warehouse: () => React.createElement("span", { "data-testid": "warehouse-icon" }),
  X: () => React.createElement("span", { "data-testid": "x-icon" }),
}));

const item = {
  id: 1,
  name: "Harina",
  kind: "RAW",
  baseDimension: "MASS",
  baseUnit: "g",
  isTracked: true,
  deductionSource: "PRODUCTION",
  quantityBase: 12500,
  parLevelBase: 25000,
  reorderPointBase: 5000,
  displayUnit: { id: 2, code: "kg", label: "kg", factorToBase: 1000 },
};

describe("StockPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/stock/summary")) return new Response(JSON.stringify({ success: true, itemsTracked: 1, belowPar: 1, belowReorder: 0, outOfStock: 0, negative: 0, coveragePct: 50 }));
      if (url.includes("/movements") && init?.method === "POST") return new Response(JSON.stringify({ success: true, quantityBase: 13500 }), { status: 201 });
      if (url.includes("/stock/warehouses")) return new Response(JSON.stringify({ success: true, warehouses: [{ id: 7, name: "Principal", type: "STORAGE", isDefault: true, isActive: true, sortOrder: 0 }] }));
      return new Response(JSON.stringify({ success: true, items: [item], page: 1, pageSize: 24, total: 1, totalPages: 1 }));
    }));
  });

  it("renders stock cards and summary", async () => {
    render(<Page />);
    expect(await screen.findByText("Harina")).toBeInTheDocument();
    expect(screen.getByText("50% cubierto")).toBeInTheDocument();
  });

  it("styles page with shared theme-aware primitives", async () => {
    const { container } = render(<Page />);
    await screen.findByText("Harina");
    expect(container.querySelector(".bo-stockPage")).not.toBeNull();
    expect(container.querySelector(".bo-pageTitle")).not.toBeNull();
    expect(container.querySelectorAll(".bo-card.bo-stockItemCard").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".bo-btn").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("[class*='text-[var(']").length).toBe(0);
  });

  it("labels warehouse filter and search for assistive technology", async () => {
    render(<Page />);
    await screen.findByText("Harina");
    expect(screen.getByLabelText("Buscar artículos")).toBeInTheDocument();
    expect(screen.getByTestId("stock-warehouse-filter")).toHaveAccessibleName("Almacén");
  });

  it("adds stock using selected warehouse and unit", async () => {
    render(<Page />);
    await screen.findByText("Harina");
    fireEvent.click(screen.getByTestId("stock-add-1"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/stock/items/1/movements",
      expect.objectContaining({ method: "POST" }),
    ));
  });
});
