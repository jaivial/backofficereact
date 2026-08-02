import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../api/client", () => ({
  createClient: vi.fn(() => ({
    config: {
      getRestaurantInfo: vi.fn(async () => ({
        success: true,
        restaurantInfo: { tipoEmpresa: "sl_micro" },
      })),
    },
  })),
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  motion: { div: (props: Record<string, unknown>) => React.createElement("div", props) },
  useReducedMotion: () => false,
}));

vi.mock("lucide-react", () => {
  const icon = (name: string) => (props: Record<string, unknown>) => React.createElement("span", { "data-icon": name, ...props });
  return {
    Building2: icon("building-2"),
    Calculator: icon("calculator"),
    ChevronDown: icon("chevron-down"),
    ChevronUp: icon("chevron-up"),
    Landmark: icon("landmark"),
    Percent: icon("percent"),
    ReceiptText: icon("receipt-text"),
    SlidersHorizontal: icon("sliders-horizontal"),
    TrendingUp: icon("trending-up"),
    UserRound: icon("user-round"),
    Wallet: icon("wallet"),
  };
});

import { TaxSimulation } from "./TaxSimulation";

function renderSimulation() {
  return render(React.createElement(TaxSimulation, { grossRevenue: 200_000, stockPurchases: 30_000 }));
}

describe("TaxSimulation entity type wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to the entity type saved in Settings (per restaurant)", async () => {
    renderSimulation();
    // The saved type is sl_micro; the description must show the micropyme bracket.
    await waitFor(() => {
      const description = document.querySelector('[data-ui="tax-entity-description"]');
      expect(description?.textContent ?? "").toContain("19%");
      expect(description?.textContent ?? "").toContain("21%");
    });
    const description = document.querySelector('[data-ui="tax-entity-description"]');
    expect(description?.textContent ?? "").toContain("INCN < 1 M");
  });

  it("recalculates the simulation live when the user switches entity tab", async () => {
    renderSimulation();
    await waitFor(() => {
      expect(document.querySelector('[data-ui="tax-entity-description"]')?.textContent ?? "").toContain("19%");
    });

    const netBefore = (document.querySelector('[data-testid="tax-net-summary-value"]')?.textContent ?? "").trim();
    const taxesBefore = (document.querySelector('[data-testid="tax-total-taxes"]')?.textContent ?? "").trim();

    fireEvent.click(screen.getByRole("tab", { name: "SL" }));

    await waitFor(() => {
      expect(document.querySelector('[data-ui="tax-entity-description"]')?.textContent ?? "").toContain("25%");
    });
    // The income tax label flips from the society path and the totals move.
    expect(document.querySelector('[data-ui="tax-tax-income"]')?.textContent ?? "").toContain("Impuesto de Sociedades");

    const netAfter = (document.querySelector('[data-testid="tax-net-summary-value"]')?.textContent ?? "").trim();
    const taxesAfter = (document.querySelector('[data-testid="tax-total-taxes"]')?.textContent ?? "").trim();

    expect(netAfter).not.toBe(netBefore);
    expect(taxesAfter).not.toBe(taxesBefore);
  });

  it("keeps the saved setting intact when the user changes the tab locally", async () => {
    renderSimulation();
    await waitFor(() => {
      expect(document.querySelector('[data-ui="tax-entity-description"]')?.textContent ?? "").toContain("19%");
    });

    fireEvent.click(screen.getByRole("tab", { name: "Autónomo" }));
    await waitFor(() => {
      expect(document.querySelector('[data-ui="tax-entity-description"]')?.textContent ?? "").toContain("IRPF");
    });

    // Changing tabs must NOT persist: getRestaurantInfo is only called once on mount.
    const { createClient } = await import("../../../../../api/client");
    const client = (createClient as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(client.config.getRestaurantInfo).toHaveBeenCalledTimes(1);
  });
});
