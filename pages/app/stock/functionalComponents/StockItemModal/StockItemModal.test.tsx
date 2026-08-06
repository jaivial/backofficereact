import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StockItemModal } from "./StockItemModal";

// The sheet editor fetches components/steps/cost/allergens right after a sheet
// is created, and the browser fetches the sheet list and stock categories on
// mount. One mock answers all of them.
function stubFetch() {
  const calls: { url: string; method?: string; body?: any }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (method === "POST" && url.endsWith("/comida/technical-sheets")) {
        return new Response(JSON.stringify({ success: true, sheetId: 55, outputItemId: 9 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (method === "POST" && url.endsWith("/api/admin/stock/items")) {
        return new Response(JSON.stringify({ success: true, id: 1 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/comida/technical-sheets/")) {
        return new Response(
          JSON.stringify({
            success: true,
            components: [],
            steps: [],
            cost: null,
            derived: [],
            manualAdded: [],
            manualDisabled: [],
            effective: [],
            contributors: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ success: true, sheets: [], categories: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

function submitForm() {
  const form = screen.getByTestId("stock-create-item").closest("form");
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
}

describe("StockItemModal", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a RAW article with the chosen dimension and unit for Materia prima", async () => {
    const calls = stubFetch();
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<StockItemModal open onClose={onClose} onCreated={onCreated} />);

    fireEvent.change(screen.getByTestId("stock-item-name"), { target: { value: "Harina" } });
    // Dimension via the reusable dropdown, not the native select.
    fireEvent.click(screen.getByRole("button", { name: "Dimensión" }));
    fireEvent.click(screen.getByRole("option", { name: "Unidades" }));
    fireEvent.change(screen.getByTestId("stock-item-unit"), { target: { value: "saco" } });
    fireEvent.change(screen.getByTestId("stock-item-factor"), { target: { value: "25" } });

    submitForm();

    await waitFor(() => {
      const create = calls.find((c) => c.url.endsWith("/api/admin/stock/items") && c.method === "POST");
      expect(create).toBeTruthy();
      expect(create!.body).toMatchObject({
        name: "Harina",
        kind: "RAW",
        baseDimension: "COUNT",
        isTracked: true,
        deductionSource: "BOTH_MANUAL",
        displayUnitCode: "saco",
        displayUnitLabel: "saco",
        displayUnitFactor: 25,
      });
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("does not create the article while Preparado has no ficha tecnica", () => {
    stubFetch();
    render(<StockItemModal open onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    expect(screen.getByTestId("stock-create-item")).toBeDisabled();
    expect(screen.getByText(/crea o selecciona una ficha tecnica/i)).toBeTruthy();
  });

  it("blocks the article until a ficha exists, then closes without POSTing a RAW item", async () => {
    const calls = stubFetch();
    const onClose = vi.fn();
    render(<StockItemModal open onClose={onClose} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByTestId("stock-item-name"), { target: { value: "Pure de patata" } });
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    expect(screen.getByTestId("stock-create-item")).toBeDisabled();

    // Creating the ficha from the browser enables the submit and shows the
    // technical sheet editor.
    fireEvent.click(await screen.findByRole("button", { name: /crear ficha tecnica/i }));
    await waitFor(() => expect(screen.getByTestId("stock-create-item")).toBeEnabled());
    await waitFor(() => expect(screen.getByTestId("technical-sheet-editor")).toBeTruthy());

    // The sheet create carries the chosen output unit.
    const sheetCreate = calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/comida/technical-sheets"),
    );
    expect(sheetCreate).toBeTruthy();
    expect(sheetCreate!.body).toMatchObject({
      name: "Pure de patata",
      portions: 1,
      baseDimension: "MASS",
      displayUnitCode: "kg",
      displayUnitLabel: "kg",
      displayUnitFactor: 1000,
    });

    submitForm();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const rawCreate = calls.find((c) => c.method === "POST" && c.url.endsWith("/api/admin/stock/items"));
    expect(rawCreate).toBeUndefined();
  });

  it("resets the form and the sheet link on every open", async () => {
    const calls = stubFetch();
    const { rerender } = render(<StockItemModal open onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByTestId("stock-item-name"), { target: { value: "Salsa brava" } });
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    fireEvent.click(await screen.findByRole("button", { name: /crear ficha tecnica/i }));
    await waitFor(() => expect(screen.getByTestId("stock-create-item")).toBeEnabled());

    // Closing and reopening starts from Materia prima with an empty form and
    // no sheet link: going Preparado again demands a fresh ficha.
    rerender(<StockItemModal open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    rerender(<StockItemModal open onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByTestId("stock-item-name")).toHaveValue("");
    expect(screen.getByRole("radio", { name: /materia prima/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("stock-create-item")).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    expect(screen.getByTestId("stock-create-item")).toBeDisabled();
    expect(calls.filter((c) => c.method === "POST" && c.url.endsWith("/comida/technical-sheets")).length).toBe(1);
  });
});
