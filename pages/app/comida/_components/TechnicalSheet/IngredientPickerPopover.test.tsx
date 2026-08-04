import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { IngredientPickerPopover } from "./IngredientPickerPopover";

const ITEMS = [
  { id: 1, name: "Harina de trigo", sku: "catalog:comida:5", baseUnit: "g", displayUnit: { id: 3, code: "g", label: "gramos" } },
  { id: 2, name: "Aceite de oliva", sku: "catalog:comida:6", baseUnit: "ml", displayUnit: { id: 4, code: "ml", label: "mililitros" } },
];

function mockFetch() {
  global.fetch = vi.fn(async (url: string) => {
    if (String(url).includes("/stock/items")) {
      return { ok: true, json: async () => ({ success: true, items: ITEMS }) };
    }
    return { ok: true, json: async () => ({ success: true, componentId: 77 }) };
  }) as unknown as typeof fetch;
}

function renderPicker(onAdded = vi.fn()) {
  const anchor = { current: document.createElement("button") };
  document.body.appendChild(anchor.current);
  render(
    <IngredientPickerPopover
      open
      anchorRef={anchor}
      sheetId={9}
      onClose={() => {}}
      onAdded={onAdded}
    />,
  );
  return onAdded;
}

describe("IngredientPickerPopover", () => {
  beforeEach(() => mockFetch());

  it("searches the raw product catalogue and lists what it finds", async () => {
    renderPicker();
    fireEvent.change(screen.getByRole("searchbox", { name: /buscar/i }), {
      target: { value: "harina" },
    });
    await waitFor(() => expect(screen.getByText("Harina de trigo")).toBeInTheDocument());
  });

  // Quantity is required: an ingredient with no amount cannot be costed, so
  // adding one silently as zero would corrupt the sheet's cost.
  it("does not add an ingredient until a quantity is given", async () => {
    const onAdded = renderPicker();
    fireEvent.change(screen.getByRole("searchbox", { name: /buscar/i }), {
      target: { value: "harina" },
    });
    await waitFor(() => expect(screen.getByText("Harina de trigo")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /harina de trigo/i }));

    const add = screen.getByRole("button", { name: /anadir ingrediente/i });
    expect(add).toBeDisabled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("adds the selected ingredient with its quantity and unit", async () => {
    const onAdded = renderPicker();
    fireEvent.change(screen.getByRole("searchbox", { name: /buscar/i }), {
      target: { value: "harina" },
    });
    await waitFor(() => expect(screen.getByText("Harina de trigo")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /harina de trigo/i }));
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /anadir ingrediente/i }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    const body = JSON.parse(
      (global.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls
        .map((call) => call[1])
        .filter((init) => init?.method === "POST")
        .at(-1)!.body as string,
    );
    expect(body.stockItemId).toBe(1);
    expect(body.quantity).toBe(500);
    expect(body.unitId).toBe(3);
  });

  it("says so when the search finds nothing, instead of showing an empty box", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, items: [] }),
    })) as unknown as typeof fetch;
    renderPicker();
    fireEvent.change(screen.getByRole("searchbox", { name: /buscar/i }), {
      target: { value: "zzz" },
    });
    await waitFor(() => expect(screen.getByText(/ning|sin resultados/i)).toBeInTheDocument());
  });
});
