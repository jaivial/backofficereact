import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProductionTypeSection } from "./ProductionTypeSection";

function mockApi(overrides: Record<string, unknown> = {}) {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url);
    // A saved product goes through /ensure; an unsaved one can only create the
    // sheet, so both entry points must answer.
    if (href.endsWith("/comida/technical-sheets/ensure") && init?.method === "POST") {
      return { ok: true, json: async () => ({ success: true, sheetId: 99 }) };
    }
    if (href.endsWith("/comida/technical-sheets") && init?.method === "POST") {
      return { ok: true, json: async () => ({ success: true, sheetId: 99, outputItemId: 5 }) };
    }
    const payload = href.includes("/components")
      ? { components: [] }
      : href.includes("/steps")
        ? { steps: [] }
        : href.includes("/cost")
          ? { cost: { lines: [], ingredientCost: 0, labourCost: 0, directVariableCost: 0,
                      totalCost: 0, costPerPortion: 0, grossPrice: 0, netPrice: 0, vatRate: 0,
                      foodCostPct: 0, grossMargin: 0, costComplete: true, missingPrices: [] } }
          : href.includes("/allergens")
            ? { derived: [], manualAdded: [], manualDisabled: [], effective: [], contributors: {} }
            : { sheets: [] };
    return { ok: true, json: async () => ({ success: true, ...payload, ...overrides }) };
  }) as unknown as typeof fetch;
}

beforeEach(() => mockApi());

describe("ProductionTypeSection", () => {
  // The switch is the entry point to the whole feature; if it is conditional,
  // some product types silently lose the ability to have a technical sheet.
  it("always shows the Preparado / Materia prima switch", () => {
    render(<ProductionTypeSection itemId={7} productionType="RAW" stockRecipeId={null} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /materia prima/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /preparado/i })).toBeTruthy();
  });

  it("shows the switch even for a product that has not been saved yet", () => {
    render(<ProductionTypeSection itemId={null} productionType="RAW" stockRecipeId={null} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /preparado/i })).toBeTruthy();
  });

  // Materia prima means "bought as-is": there is no recipe to show.
  it("hides the recipe subtabs while the product is raw", () => {
    render(<ProductionTypeSection itemId={7} productionType="RAW" stockRecipeId={null} onChange={vi.fn()} />);
    expect(screen.queryByRole("tab", { name: /informaci/i })).toBeNull();
  });

  it("shows the three subtabs inline once the product is Preparado", async () => {
    render(<ProductionTypeSection itemId={7} productionType="MANUFACTURED" stockRecipeId={42} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /informaci/i })).toBeTruthy());
    expect(screen.getByRole("tab", { name: /receta/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /coste/i })).toBeTruthy();
  });

  // A technical sheet does not need a product id to exist, so a dish being
  // created can have its recipe built right away. Deferring it forced the user
  // to save, reopen and find the section again just to add ingredients.
  it("offers the sheet browser for a product that has not been saved yet", async () => {
    render(<ProductionTypeSection itemId={null} productionType="MANUFACTURED" stockRecipeId={null} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("technical-sheet-browser")).toBeTruthy());
  });

  // The sheet exists before the product does, so the parent must be told which
  // sheet to attach when it saves; otherwise the recipe is orphaned. Creation is
  // now explicit, so the button has to be pressed first.
  it("reports the new sheet so the parent can link it on save", async () => {
    const onSheetLinked = vi.fn();
    render(
      <ProductionTypeSection
        itemId={null} productionType="MANUFACTURED" stockRecipeId={null}
        productName="Paella nueva" onChange={vi.fn()} onSheetLinked={onSheetLinked}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /crear ficha/i }));
    await waitFor(() => expect(onSheetLinked).toHaveBeenCalledWith(99));
  });

  // Choosing Preparado lands the user in the sheet catalogue: reuse is the
  // common case, and creating a draft on every mis-click left orphans behind.
  it("shows the sheet browser when Preparado is chosen, before any sheet exists", async () => {
    render(<ProductionTypeSection itemId={7} productionType="MANUFACTURED" stockRecipeId={null} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("technical-sheet-browser")).toBeTruthy());
    expect(screen.getByRole("button", { name: /crear ficha/i })).toBeTruthy();
  });

  // The sheet has to exist before ingredients can be attached to it, so it is
  // created on demand rather than making the user find a separate action.
  it("creates the technical sheet on demand and reports it to the parent", async () => {
    const calls: { url: string; method?: string }[] = [];
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method });
      if (String(url).endsWith("/comida/technical-sheets/ensure") && init?.method === "POST") {
        return { ok: true, json: async () => ({ success: true, sheetId: 77 }) };
      }
      if (String(url).endsWith("/comida/technical-sheets") && init?.method === "POST") {
        return { ok: true, json: async () => ({ success: true, sheetId: 77, outputItemId: 5 }) };
      }
      return { ok: true, json: async () => ({ success: true, sheets: [], components: [], steps: [] }) };
    }) as unknown as typeof fetch;

    const onSheetLinked = vi.fn();
    render(
      <ProductionTypeSection
        itemId={7} productionType="MANUFACTURED" stockRecipeId={null}
        productName="Paella" onChange={vi.fn()} onSheetLinked={onSheetLinked}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /crear ficha/i }));
    await waitFor(() => expect(onSheetLinked).toHaveBeenCalledWith(77));
    expect(calls.some((c) => c.url.endsWith("/comida/technical-sheets/ensure") && c.method === "POST")).toBe(true);
  });

  // A sheet that is created but never linked is an orphan: it exists in stock
  // but no product points at it, so the next visit creates another one.
  it("links the new sheet to the product, not just to local state", async () => {
    const calls: { url: string; method?: string; body?: any }[] = [];
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (String(url).endsWith("/comida/technical-sheets/ensure") && init?.method === "POST") {
        return { ok: true, json: async () => ({ success: true, sheetId: 77 }) };
      }
      if (String(url).endsWith("/comida/technical-sheets") && init?.method === "POST") {
        return { ok: true, json: async () => ({ success: true, sheetId: 77, outputItemId: 5 }) };
      }
      return { ok: true, json: async () => ({ success: true, sheets: [], components: [], steps: [] }) };
    }) as unknown as typeof fetch;

    render(
      <ProductionTypeSection
        itemId={7} productionType="MANUFACTURED" stockRecipeId={null}
        productName="Paella" onChange={vi.fn()} onSheetLinked={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /crear ficha/i }));

    // Creating and linking is one server call, so an orphan sheet cannot be
    // produced by the client giving up between two requests.
    await waitFor(() => {
      const ensure = calls.find(
        (c) => c.url.endsWith("/comida/technical-sheets/ensure") && c.method === "POST",
      );
      expect(ensure?.body?.itemId).toBe(7);
    });
  });

  // A product that already has a sheet opens straight into it rather than being
  // asked to search for it again.
  it("opens the linked sheet directly instead of browsing", async () => {
    render(<ProductionTypeSection itemId={7} productionType="MANUFACTURED" stockRecipeId={42} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("technical-sheet-editor")).toBeTruthy());
    expect(screen.queryByTestId("technical-sheet-browser")).toBeNull();
  });

  it("reports the change so the parent can persist it", async () => {
    const onChange = vi.fn();
    render(<ProductionTypeSection itemId={7} productionType="RAW" stockRecipeId={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("MANUFACTURED"));
  });

  // Wine and postres live in their own tables; the section must pass that on or
  // the write lands on the wrong table.
  it("forwards the catalogue source with the save", async () => {
    const bodies: Record<string, unknown>[] = [];
    global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body) bodies.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => ({ success: true, sheets: [] }) };
    }) as unknown as typeof fetch;

    render(<ProductionTypeSection itemId={7} productionType="RAW" stockRecipeId={null} source="vinos" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    expect(bodies[0].source).toBe("vinos");
  });
});
