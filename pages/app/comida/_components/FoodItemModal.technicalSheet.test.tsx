import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FoodItemModal } from "./FoodItemModal";
import type { SheetSummary } from "./TechnicalSheet/sheetsApi";
import type { FoodItem } from "../../../../api/types";

vi.mock("../../../../api/client", () => ({
  createClient: () => ({
    comida: {
      platos: {
        // A real create returns the new dish id; without it the modal has
        // nothing to link the technical sheet to.
        create: vi.fn(async () => ({ success: true, num: 123 })),
        patch: vi.fn(async () => ({ success: true })),
        categories: { list: vi.fn(() => new Promise(() => {})) },
      },
      bebidas: { create: vi.fn(), patch: vi.fn() },
      cafes: { create: vi.fn(), patch: vi.fn() },
      postres: { create: vi.fn(), patch: vi.fn() },
    },
  }),
}));

const RAW_ITEM: FoodItem = {
  num: 7, tipo: "PLATO", nombre: "Paella", precio: 18, descripcion: "", titulo: "Paella",
  suplemento: 0, alergenos: [], active: true, has_foto: false, production_type: "RAW",
};

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, sheets: [] }),
  })) as unknown as typeof fetch;
});

describe("FoodItemModal technical sheet section", () => {
  // This is the whole point of the feature: from the dish modal the user must be
  // able to say "this is elaborated" and reach its technical sheet.
  it("offers the raw/manufactured choice when editing an existing dish", () => {
    render(
      <FoodItemModal
        open item={RAW_ITEM} foodType="platos"
        onClose={vi.fn()} onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId("production-type-toggle")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /materia prima/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /preparado/i })).toBeTruthy();
  });

  it("reflects the saved production type instead of always defaulting to raw", async () => {
    render(
      <FoodItemModal
        open item={{ ...RAW_ITEM, production_type: "MANUFACTURED", stock_recipe_id: 42 }}
        foodType="platos" onClose={vi.fn()} onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /preparado/i }).getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect(screen.getByRole("tab", { name: /informaci/i })).toBeTruthy());
  });

  // A sheet built while creating a dish must be attached when that dish is
  // saved. Without this the recipe the user just typed is orphaned: it exists
  // in stock but the dish does not point at it.
  it("links the sheet built during create once the dish is saved", async () => {
    const calls: { url: string; method?: string; body?: any }[] = [];
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (init?.method === "POST" && String(url).includes("/comida/technical-sheets")) {
        return { ok: true, json: async () => ({ success: true, sheetId: 55, outputItemId: 9 }) };
      }
      return { ok: true, json: async () => ({ success: true, sheets: [], components: [], steps: [] }) };
    }) as unknown as typeof fetch;

    const onSave = vi.fn();
    render(
      <FoodItemModal open item={null} foodType="platos" onClose={vi.fn()} onSave={onSave} />,
    );

    // A dish needs a name to save at all; submitting an empty form would be
    // blocked by validation and prove nothing about the link.
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Paella nueva" } });
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    // Creation is explicit now: Preparado browses, the button creates.
    fireEvent.click(await screen.findByRole("button", { name: /crear ficha/i }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith("/comida/technical-sheets") && c.method === "POST")).toBe(true),
    );

    // The modal saves the dish through the API client, then attaches the sheet
    // it just built. Only the second step goes through fetch.
    const form = screen.getByRole("button", { name: /guardar/i }).closest("form");
    fireEvent.submit(form!);

    await waitFor(
      () => {
        const link = calls.find((c) => c.url.includes("/production-type") && c.method === "PATCH");
        expect(link?.body?.stockRecipeId).toBe(55);
      },
      { timeout: 5000 },
    );
  });

  // The create modal is where most dishes are added, so the switch must be
  // there too; the sheet is created when the dish is first saved.
  it("shows the switch in the create modal", () => {
    render(
      <FoodItemModal open item={null} foodType="platos" onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(screen.getByTestId("production-type-toggle")).toBeTruthy();
  });

  // Choosing Preparado opens the sheet itself, ready for ingredients, instead
  // of asking the user to find another button first.
  it("opens the sheet tabs directly for a Preparado dish", async () => {
    render(
      <FoodItemModal
        open item={{ ...RAW_ITEM, production_type: "MANUFACTURED", stock_recipe_id: 42 }}
        foodType="platos" onClose={vi.fn()} onSave={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByRole("tab", { name: /informaci/i })).toBeTruthy());
    expect(screen.getByRole("tab", { name: /receta/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /coste/i })).toBeTruthy();
  });

  // Materia prima has no recipe, so the sheet controls stay out of the way.
  it("does not offer a technical sheet while the dish is materia prima", () => {
    render(
      <FoodItemModal open item={RAW_ITEM} foodType="platos" onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /ficha t/i })).toBeNull();
  });
});

// Picking an existing sheet fills the form from it: the sheet already knows the
// dish's name, price, allergens and description, so making the user retype them
// would invite the two records to disagree.
describe("FoodItemModal filling from a picked sheet", () => {
  const SHEET: SheetSummary = {
    id: 5, name: "Salsa brava", status: "PUBLISHED", portions: 4, imageUrl: "https://cdn/s.webp",
    usageCount: 0, categoryId: 0, categoryName: "", instructions: "Remover sin parar",
    componentCount: 2, stepCount: 1, allergens: ["Gluten", "Leche"],
    sellingPriceGross: 6.5, prepTimeMin: 20,
  };

  function mockWithSheet(sheet = SHEET) {
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/stock/categories")) {
        return { ok: true, json: async () => ({ success: true, categories: [] }) };
      }
      if (init?.method === "POST" && href.includes("/comida/technical-sheets")) {
        return { ok: true, json: async () => ({ success: true, sheetId: 55, outputItemId: 9 }) };
      }
      if (href.match(/technical-sheets\/\d+\//)) {
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
      return { ok: true, json: async () => ({ success: true, sheets: [sheet] }) };
    }) as unknown as typeof fetch;
  }

  it("fills name, price, description and allergens from the chosen sheet", async () => {
    mockWithSheet();
    render(<FoodItemModal open item={null} foodType="platos" onClose={vi.fn()} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    fireEvent.click(await screen.findByTestId("sheet-card-5"));

    await waitFor(() => expect(screen.getByLabelText(/nombre/i)).toHaveValue("Salsa brava"));
    expect(screen.getByLabelText(/precio/i)).toHaveValue(6.5);
    expect(screen.getByLabelText(/detalle/i)).toHaveValue("Remover sin parar");
    // Allergens come from the sheet's own derived+manual set.
    const gluten = document.querySelector(
      '[data-role="food-modal-alergeno-option"][data-allergen="gluten"]',
    );
    expect(gluten?.getAttribute("aria-pressed")).toBe("true");
  });

  // A sheet with no price must not overwrite the product's price with zero.
  it("leaves the price alone when the sheet has none", async () => {
    mockWithSheet({ ...SHEET, sellingPriceGross: null });
    render(<FoodItemModal open item={null} foodType="platos" onClose={vi.fn()} onSave={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    fireEvent.click(await screen.findByTestId("sheet-card-5"));

    await waitFor(() => expect(screen.getByLabelText(/nombre/i)).toHaveValue("Salsa brava"));
    expect(screen.getByLabelText(/precio/i)).toHaveValue(12);
  });
});

// A sheet's allergens ARE the dish's allergens: they are what gets printed on
// the menu. Editing them inside the ficha tecnica has to reach the product's own
// grid, or the two records disagree about the same dish and whichever is saved
// last silently wins.
describe("FoodItemModal allergen sync with the sheet", () => {
  const SHEET_ALLERGENS = {
    derived: ["Gluten"],
    manualAdded: [] as string[],
    manualDisabled: [] as string[],
    effective: ["Gluten"],
    contributors: { Gluten: ["Harina"] },
  };

  function mockApi() {
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/stock/categories")) {
        return { ok: true, json: async () => ({ success: true, categories: [] }) };
      }
      if (href.includes("/allergens") && init?.method === "PATCH") {
        const added = JSON.parse(String(init.body)).added as string[];
        return {
          ok: true,
          json: async () => ({
            success: true,
            ...SHEET_ALLERGENS,
            manualAdded: added,
            effective: [...SHEET_ALLERGENS.derived, ...added],
          }),
        };
      }
      if (href.includes("/allergens")) {
        return { ok: true, json: async () => ({ success: true, ...SHEET_ALLERGENS }) };
      }
      if (init?.method === "POST" && href.includes("/comida/technical-sheets")) {
        return { ok: true, json: async () => ({ success: true, sheetId: 55, outputItemId: 9 }) };
      }
      if (href.match(/technical-sheets\/\d+\//)) {
        return {
          ok: true,
          json: async () => ({
            success: true, components: [], steps: [],
            cost: {
              lines: [], ingredientCost: 0, labourCost: 0, directVariableCost: 0, totalCost: 0,
              costPerPortion: 0, grossPrice: 0, netPrice: 0, vatRate: 0, foodCostPct: 0,
              grossMargin: 0, costComplete: true, missingPrices: [],
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, sheets: [] }) };
    }) as unknown as typeof fetch;
  }

  const productCard = (slug: string) =>
    document.querySelector(`[data-role="food-modal-alergeno-option"][data-allergen="${slug}"]`);

  it("marks the sheet's derived allergens on the product grid", async () => {
    mockApi();
    render(<FoodItemModal open item={null} foodType="platos" onClose={vi.fn()} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    fireEvent.click(await screen.findByRole("button", { name: /crear ficha/i }));

    // Gluten is derived from the sheet's ingredients, so the dish carries it.
    await waitFor(() => expect(productCard("gluten")?.getAttribute("aria-pressed")).toBe("true"));
  });

  it("marks an allergen added inside the sheet on the product grid too", async () => {
    mockApi();
    render(<FoodItemModal open item={null} foodType="platos" onClose={vi.fn()} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    fireEvent.click(await screen.findByRole("button", { name: /crear ficha/i }));
    await waitFor(() => expect(productCard("gluten")?.getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: /anadir alergeno/i }));
    const leche = await waitFor(() => {
      const node = document.querySelector(
        '[data-role="sheet-alergeno-picker-option"][data-allergen="Leche"]',
      );
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    fireEvent.click(leche);

    // "Leche" is persisted as the legacy slug "lacteos" on comida items.
    await waitFor(() => expect(productCard("lacteos")?.getAttribute("aria-pressed")).toBe("true"));
    // The derived one must survive.
    expect(productCard("gluten")?.getAttribute("aria-pressed")).toBe("true");
  });
});

// Allergens that come from the technical sheet are the sheet's statement about
// the dish, not a user preference: they are badged, cannot be unticked here, and
// are released only when the product stops being Preparado.
describe("FoodItemModal sheet-owned allergens", () => {
  const SHEET_ALLERGENS = {
    derived: ["Gluten"],
    manualAdded: [] as string[],
    manualDisabled: [] as string[],
    effective: ["Gluten"],
    contributors: { Gluten: ["Harina"] },
  };

  function mockApi() {
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/stock/categories")) {
        return { ok: true, json: async () => ({ success: true, categories: [] }) };
      }
      if (href.includes("/allergens")) {
        return { ok: true, json: async () => ({ success: true, ...SHEET_ALLERGENS }) };
      }
      if (init?.method === "POST" && href.includes("/comida/technical-sheets")) {
        return { ok: true, json: async () => ({ success: true, sheetId: 55, outputItemId: 9 }) };
      }
      if (href.match(/technical-sheets\/\d+\//)) {
        return {
          ok: true,
          json: async () => ({
            success: true, components: [], steps: [],
            cost: {
              lines: [], ingredientCost: 0, labourCost: 0, directVariableCost: 0, totalCost: 0,
              costPerPortion: 0, grossPrice: 0, netPrice: 0, vatRate: 0, foodCostPct: 0,
              grossMargin: 0, costComplete: true, missingPrices: [],
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, sheets: [] }) };
    }) as unknown as typeof fetch;
  }

  const card = (slug: string) =>
    document.querySelector(
      `[data-role="food-modal-alergeno-option"][data-allergen="${slug}"]`,
    ) as HTMLElement | null;

  async function openSheet() {
    render(<FoodItemModal open item={null} foodType="platos" onClose={vi.fn()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    fireEvent.click(await screen.findByRole("button", { name: /crear ficha/i }));
    await waitFor(() => expect(card("gluten")?.getAttribute("aria-pressed")).toBe("true"));
  }

  it("badges a sheet allergen so the user can see where it came from", async () => {
    mockApi();
    await openSheet();
    const badge = card("gluten")!.querySelector(
      '[data-role="food-modal-alergeno-option-badge"]',
    );
    expect(badge).not.toBeNull();
    expect(card("gluten")!.getAttribute("title")).toMatch(/ficha tecnica/i);
  });

  it("refuses to untick a sheet allergen from the product grid", async () => {
    mockApi();
    await openSheet();
    const gluten = card("gluten")!;
    expect(gluten.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(gluten);
    // Still declared: only the sheet may remove it.
    expect(card("gluten")?.getAttribute("aria-pressed")).toBe("true");
  });

  // Turning the product back into Materia prima detaches the sheet, so its
  // allergens are no longer the dish's and must be released.
  it("releases sheet allergens when the product stops being Preparado", async () => {
    mockApi();
    await openSheet();
    fireEvent.click(screen.getByRole("radio", { name: /materia prima/i }));

    await waitFor(() => expect(card("gluten")?.getAttribute("aria-pressed")).toBe("false"));
    expect(card("gluten")?.getAttribute("aria-disabled")).toBeNull();
  });

  // A hand-picked allergen is the user's, so it stays editable alongside.
  it("leaves manually chosen allergens editable", async () => {
    mockApi();
    await openSheet();
    fireEvent.click(card("huevos")!);
    await waitFor(() => expect(card("huevos")?.getAttribute("aria-pressed")).toBe("true"));
    expect(card("huevos")!.querySelector('[data-role="food-modal-alergeno-option-badge"]')).toBeNull();
    fireEvent.click(card("huevos")!);
    await waitFor(() => expect(card("huevos")?.getAttribute("aria-pressed")).toBe("false"));
  });
});

// Removing an allergen inside the ficha tecnica has to clear it from the product
// grid as well. The sheet owns those entries, so a stale one left behind would
// be both wrong and unremovable: the card is locked precisely because the sheet
// is supposed to be in charge of it.
describe("FoodItemModal releases allergens the sheet stops declaring", () => {
  let effective: string[] = [];

  function mockApi() {
    effective = ["Gluten"];
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/stock/categories")) {
        return { ok: true, json: async () => ({ success: true, categories: [] }) };
      }
      if (href.includes("/allergens") && init?.method === "PATCH") {
        // The sheet's manual layer is replaced by whatever the client sends, so
        // an allergen left out of `added` is being switched off.
        const added = JSON.parse(String(init.body)).added as string[];
        effective = ["Gluten", ...added.filter((key) => key !== "Gluten")];
        return {
          ok: true,
          json: async () => ({
            success: true, derived: ["Gluten"], manualAdded: added, manualDisabled: [],
            effective, contributors: { Gluten: ["Harina"] },
          }),
        };
      }
      if (href.includes("/allergens")) {
        return {
          ok: true,
          json: async () => ({
            success: true, derived: ["Gluten"], manualAdded: [], manualDisabled: [],
            effective, contributors: { Gluten: ["Harina"] },
          }),
        };
      }
      if (init?.method === "POST" && href.includes("/comida/technical-sheets")) {
        return { ok: true, json: async () => ({ success: true, sheetId: 55, outputItemId: 9 }) };
      }
      if (href.match(/technical-sheets\/\d+\//)) {
        return {
          ok: true,
          json: async () => ({
            success: true, components: [], steps: [],
            cost: {
              lines: [], ingredientCost: 0, labourCost: 0, directVariableCost: 0, totalCost: 0,
              costPerPortion: 0, grossPrice: 0, netPrice: 0, vatRate: 0, foodCostPct: 0,
              grossMargin: 0, costComplete: true, missingPrices: [],
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, sheets: [] }) };
    }) as unknown as typeof fetch;
  }

  const card = (slug: string) =>
    document.querySelector(
      `[data-role="food-modal-alergeno-option"][data-allergen="${slug}"]`,
    ) as HTMLElement | null;
  const pickerCard = (key: string) =>
    document.querySelector(
      `[data-role="sheet-alergeno-picker-option"][data-allergen="${key}"]`,
    ) as HTMLElement | null;

  it("clears the product card when the allergen is switched off in the sheet", async () => {
    mockApi();
    render(<FoodItemModal open item={null} foodType="platos" onClose={vi.fn()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    fireEvent.click(await screen.findByRole("button", { name: /crear ficha/i }));
    await waitFor(() => expect(card("gluten")?.getAttribute("aria-pressed")).toBe("true"));

    // Add Leche in the sheet, then take it away again.
    fireEvent.click(screen.getByRole("button", { name: /anadir alergeno/i }));
    await waitFor(() => expect(pickerCard("Leche")).not.toBeNull());
    fireEvent.click(pickerCard("Leche")!);
    await waitFor(() => expect(card("lacteos")?.getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(pickerCard("Leche")!);
    await waitFor(() => expect(card("lacteos")?.getAttribute("aria-pressed")).toBe("false"));
    // ...and it is editable again, since the sheet no longer claims it.
    expect(card("lacteos")?.getAttribute("aria-disabled")).toBeNull();
    // The derived one is untouched.
    expect(card("gluten")?.getAttribute("aria-pressed")).toBe("true");
  });

  // A user's own pick must survive a sheet update: the sheet only governs the
  // entries it contributed.
  it("keeps a manually chosen allergen when the sheet changes", async () => {
    mockApi();
    render(<FoodItemModal open item={null} foodType="platos" onClose={vi.fn()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
    fireEvent.click(await screen.findByRole("button", { name: /crear ficha/i }));
    await waitFor(() => expect(card("gluten")?.getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(card("huevos")!);
    await waitFor(() => expect(card("huevos")?.getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: /anadir alergeno/i }));
    await waitFor(() => expect(pickerCard("Leche")).not.toBeNull());
    fireEvent.click(pickerCard("Leche")!);

    await waitFor(() => expect(card("lacteos")?.getAttribute("aria-pressed")).toBe("true"));
    expect(card("huevos")?.getAttribute("aria-pressed")).toBe("true");
  });
});
