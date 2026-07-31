import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TechnicalSheetBrowser } from "./TechnicalSheetBrowser";

const SHEETS = [
  {
    id: 5, name: "Salsa brava", status: "PUBLISHED", portions: 4, imageUrl: "",
    usageCount: 2, categoryId: 3, categoryName: "Salsas", instructions: "",
    componentCount: 4, stepCount: 2, allergens: ["Gluten"],
    sellingPriceGross: 6.5, prepTimeMin: 20,
  },
  {
    id: 6, name: "Pan de masa madre", status: "DRAFT", portions: 8, imageUrl: "https://cdn/p.webp",
    usageCount: 0, categoryId: 0, categoryName: "", instructions: "",
    componentCount: 0, stepCount: 0, allergens: [],
    sellingPriceGross: null, prepTimeMin: null,
  },
];

let lastListUrl = "";

function mockApi(sheets = SHEETS) {
  lastListUrl = "";
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.includes("/stock/categories")) {
      return { ok: true, json: async () => ({ success: true, categories: [{ id: 3, name: "Salsas", isActive: true }] }) };
    }
    if (href.includes("/comida/technical-sheets") && (!init || init.method === undefined)) {
      lastListUrl = href;
      return { ok: true, json: async () => ({ success: true, sheets }) };
    }
    return { ok: true, json: async () => ({ success: true, sheetId: 99, outputItemId: 1 }) };
  }) as unknown as typeof fetch;
}

function renderBrowser(overrides: Record<string, unknown> = {}) {
  const onPick = vi.fn();
  const onCreate = vi.fn();
  render(
    <TechnicalSheetBrowser onPick={onPick} onCreate={onCreate} productName="Paella" {...overrides} />,
  );
  return { onPick, onCreate };
}

describe("TechnicalSheetBrowser", () => {
  beforeEach(() => mockApi());

  it("lists the sheets it finds as cards", async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getByText("Salsa brava")).toBeInTheDocument());
    expect(screen.getByTestId("sheet-card-6")).toBeInTheDocument();
  });

  it("offers a search box and passes the term to the server", async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getByText("Salsa brava")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("searchbox", { name: /buscar/i }), {
      target: { value: "brava" },
    });
    await waitFor(() => expect(lastListUrl).toContain("q=brava"));
  });

  it("filters by category", async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getByText("Salsa brava")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /categor/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Salsas" }));
    await waitFor(() => expect(lastListUrl).toContain("categoryId=3"));
  });

  it("filters by status", async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getByText("Salsa brava")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /estado/i }));
    fireEvent.click(await screen.findByRole("option", { name: /publicada/i }));
    await waitFor(() => expect(lastListUrl).toContain("status=PUBLISHED"));
  });

  // The create action is the way out of an empty catalogue, so it must always be
  // reachable - top right, per the brief.
  it("offers a create button", async () => {
    const { onCreate } = renderBrowser();
    fireEvent.click(screen.getByRole("button", { name: /crear ficha/i }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("reports the picked sheet", async () => {
    const { onPick } = renderBrowser();
    await waitFor(() => expect(screen.getByText("Salsa brava")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("sheet-card-5"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  // Reusing a sheet that another product already uses changes that product too.
  it("warns on a card that is already in use", async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getByTestId("sheet-card-5")).toBeInTheDocument());
    expect(screen.getByTestId("sheet-card-5").textContent).toMatch(/2 producto/i);
  });

  it("explains an empty result instead of showing a blank area", async () => {
    mockApi([]);
    renderBrowser();
    await waitFor(() =>
      expect(screen.getByText(/no hay fichas|ninguna ficha/i)).toBeInTheDocument(),
    );
  });
});
