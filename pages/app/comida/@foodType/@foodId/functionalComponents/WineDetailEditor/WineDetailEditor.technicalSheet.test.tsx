import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { WineDetailEditor } from "./WineDetailEditor";
import type { Vino } from "../../../../../../../api/types";

vi.mock("../../../../../../../api/client", () => ({
  createClient: () => ({
    comida: { vinos: { create: vi.fn(), patch: vi.fn() } },
  }),
}));

const WINE: Vino = {
  num: 12, tipo: "TINTO", nombre: "Sangria de la casa", precio: 12.5,
  descripcion: "", bodega: "", denominacion_origen: "", graduacion: 0,
  anyo: "", active: true, has_foto: false, production_type: "RAW",
};

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, sheets: [] }),
  })) as unknown as typeof fetch;
});

describe("WineDetailEditor technical sheet section", () => {
  // Sangria and other house preparations are wines that ARE produced, so wine
  // needs the same elaborated/bought choice as food.
  it("offers the production type choice for a saved wine", () => {
    render(<WineDetailEditor vino={WINE} isNew={false} onSave={vi.fn()} />);
    expect(screen.getByTestId("production-type-toggle")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /preparado/i })).toBeTruthy();
  });

  it("shows the stored production type rather than defaulting to bought", async () => {
    render(
      <WineDetailEditor
        vino={{ ...WINE, production_type: "MANUFACTURED", stock_recipe_id: 5 }}
        isNew={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /preparado/i }).getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect(screen.getByRole("tab", { name: /informaci/i })).toBeTruthy());
  });

  it("opens the sheet tabs directly for an elaborated wine", async () => {
    render(
      <WineDetailEditor
        vino={{ ...WINE, production_type: "MANUFACTURED", stock_recipe_id: 42 }}
        isNew={false}
        onSave={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByRole("tab", { name: /informaci/i })).toBeTruthy());
    expect(screen.getByRole("tab", { name: /coste/i })).toBeTruthy();
  });

  // A bottle bought and resold has no recipe.
  it("hides the sheet controls while the wine is bought", () => {
    render(<WineDetailEditor vino={WINE} isNew={false} onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /ficha/i })).toBeNull();
  });

  // The switch is always offered, including for a wine being created.
  it("still offers the switch for a new wine", () => {
    render(<WineDetailEditor vino={null} isNew onSave={vi.fn()} />);
    expect(screen.getByTestId("production-type-toggle")).toBeTruthy();
  });
});
