import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StockOperationsPanel } from "./StockOperationsPanel";

const items = [
  { id: 1, name: "Harina", kind: "RAW", isTracked: true, displayUnit: { id: 2, code: "kg", label: "kg", factorToBase: 1000 } },
  { id: 3, name: "Masa", kind: "SEMI_FINISHED", isTracked: true, displayUnit: { id: 4, code: "kg", label: "kg", factorToBase: 1000 } },
];
const warehouses = [{ id: 7, name: "Principal", isDefault: true }];

describe("StockOperationsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/recipes") && init?.method === "POST") return new Response(JSON.stringify({ success: true, id: 8 }), { status: 201 });
      if (url.endsWith("/recipes")) return new Response(JSON.stringify({ success: true, recipes: [] }));
      if (url.includes("/production/preview")) return new Response(JSON.stringify({ success: true, outputItemId: 3, outputQuantityBase: 1000, components: [{ stockItemId: 1, name: "Harina", neededQuantityBase: 500, availableQuantityBase: 1000, shortage: false }] }));
      if (url.endsWith("/production")) return new Response(JSON.stringify({ success: true, id: 9 }), { status: 201 });
      if (url.includes("/forecast")) return new Response(JSON.stringify({ success: true, confidence: "LOW", historyDays: 20, requiredHistoryDays: 56, scenario: "MEDIUM", horizonDays: 7, items: [] }));
      if (url.endsWith("/costing")) return new Response(JSON.stringify({ success: true, items: [] }));
      if (url.endsWith("/labour-members")) return new Response(JSON.stringify({ success: true, items: [{ id: 12, name: "Ana", costAvailable: true }] }));
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }));
  });

  it("creates recipe with output and component", async () => {
    render(<StockOperationsPanel items={items} warehouses={warehouses} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByTestId("stock-recipe-new"));
    fireEvent.change(screen.getByTestId("stock-recipe-name"), { target: { value: "Masa pizza" } });
    fireEvent.change(screen.getByTestId("stock-recipe-output"), { target: { value: "3" } });
    fireEvent.change(screen.getByTestId("stock-recipe-component-0"), { target: { value: "1" } });
    fireEvent.change(screen.getByTestId("stock-recipe-component-qty-0"), { target: { value: "0.5" } });
    fireEvent.click(screen.getByText("Añadir mano de obra"));
    await screen.findByRole("option", { name: "Ana" });
    fireEvent.change(screen.getByLabelText("Miembro mano de obra 1"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Minutos mano de obra 1"), { target: { value: "45" } });
    fireEvent.click(screen.getByTestId("stock-recipe-save"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/stock/recipes", expect.objectContaining({ method: "POST", body: expect.stringContaining('"minutesPerBatch":45') })));
  });
});
