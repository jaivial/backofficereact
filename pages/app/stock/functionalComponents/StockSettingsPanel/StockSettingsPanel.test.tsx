import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StockSettingsPanel } from "./StockSettingsPanel";

describe("StockSettingsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/settings") && !init?.method) return new Response(JSON.stringify({ success: true, warehouseDisplayMode: "AGGREGATED", countCadence: "WEEKLY", allowNegativeStock: true, labourCostEnabled: false, businessProfile: "", seasonalityProfile: {}, onboardingCompleted: false }));
      if (url.endsWith("/vat-rates")) return new Response(JSON.stringify({ success: true, vatRates: [] }));
      if (url.endsWith("/margin-scopes")) return new Response(JSON.stringify({ success: true, scopes: [], defaults: [{ zone: "PURPLE", min: null, max: 25 }, { zone: "GREEN", min: 25, max: 35 }, { zone: "AMBER", min: 35, max: 40 }, { zone: "RED", min: 40, max: null }] }));
      return new Response(JSON.stringify({ success: true }));
    }));
  });

  it("saves onboarding settings", async () => {
    render(<StockSettingsPanel />);
    expect(await screen.findByRole("combobox", { name: "Frecuencia de recuento" })).toHaveValue("WEEKLY");
    fireEvent.change(screen.getByTestId("stock-settings-business-profile"), { target: { value: "Restaurante de playa con terraza" } });
    fireEvent.click(screen.getByTestId("stock-settings-save"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/stock/settings", expect.objectContaining({ method: "PATCH" })));
  });
});
