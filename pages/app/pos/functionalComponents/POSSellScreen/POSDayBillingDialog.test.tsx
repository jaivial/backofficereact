import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { POSDayBillingDialog } from "./POSDayBillingDialog";
import { POSControlRail } from "./POSControlRail";

vi.mock("lucide-react", async () => {
  const { createElement } = await import("react");
  const icon = (name: string) => (props: Record<string, unknown>) => createElement("span", { "data-icon": name, ...props });
  const names = ["X", "RefreshCw", "Archive", "Banknote", "ChefHat", "Combine", "FileText", "Gift", "HandCoins", "IdCard", "LayoutGrid", "Lock", "Map", "MessageSquare", "Percent", "Receipt", "Scissors", "ShoppingBag", "Split", "Tags", "Trash2", "TrendingUp", "UserRound", "Wine", "ListChecks", "CirclePause", "ChartPie"];
  return Object.fromEntries(names.map((name) => [name, icon(name)]));
});

const billing = {
  success: true,
  date: "2026-02-10",
  totalCents: 10300,
  closedCents: 7800,
  openCents: 2500,
  openTickets: 1,
  closedTickets: 3,
  openTables: 1,
  byMethod: { CASH: 4800, CARD: 1500, BANK: 1500, OTHER: 0 },
  tipsCents: 300,
  tables: [
    { tableId: 5, tableName: "Mesa 1", channel: "DINE_IN", open: false, openCents: 0, closedCents: 5500, totalCents: 5500 },
    { tableId: 6, tableName: "Mesa 2", channel: "DINE_IN", open: true, openCents: 2500, closedCents: 1500, totalCents: 4000 },
    { tableId: null, tableName: "", channel: "TAKEAWAY", open: false, openCents: 0, closedCents: 800, totalCents: 800 },
  ],
};

const text = (id: string) => (screen.getByTestId(id).textContent || "").replace(/\s/g, " ");

afterEach(() => vi.unstubAllGlobals());

describe("POSDayBillingDialog", () => {
  it("shows the day total, the closed/open split, the tenders and every table", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(billing)));
    vi.stubGlobal("fetch", fetchMock);
    render(<POSDayBillingDialog date="2026-02-10" onClose={() => {}} />);

    await screen.findByTestId("pos-billing-total");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/pos/cash-days/2026-02-10/billing", expect.anything());
    expect(text("pos-billing-total")).toMatch(/103,00/);
    expect(text("pos-billing-closed")).toMatch(/78,00/);
    expect(text("pos-billing-open")).toMatch(/25,00/);
    expect(screen.getByTestId("pos-billing-bar")).toHaveAttribute("aria-label", "76% cerrado");

    expect(within(screen.getByTestId("pos-billing-method-CASH")).getByText("Efectivo")).toBeInTheDocument();
    expect(text("pos-billing-method-CASH")).toMatch(/48,00/);
    expect(text("pos-billing-method-CARD")).toMatch(/15,00/);
    expect(text("pos-billing-method-BANK")).toMatch(/15,00/);
    expect(text("pos-billing-method-OTHER")).toMatch(/0,00/);
    expect(text("pos-billing-tips")).toMatch(/3,00/);

    const rows = screen.getAllByTestId("pos-billing-table");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("Mesa 2");
    expect(rows[1]).toHaveTextContent("Abierta");
    expect(rows[2]).toHaveTextContent("Para llevar");
  });

  it("reloads on Actualizar and surfaces a backend error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(billing)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: "Sin permiso" }), { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<POSDayBillingDialog date="2026-02-10" onClose={() => {}} />);
    fireEvent.click(await screen.findByTestId("pos-billing-refresh"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("pos-billing-error")).toBeInTheDocument();
  });

  it("shows an empty state for a day without tables", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...billing, totalCents: 0, closedCents: 0, openCents: 0, closedTickets: 0, openTables: 0, tipsCents: 0, byMethod: { CASH: 0, CARD: 0, BANK: 0, OTHER: 0 }, tables: [] }))));
    render(<POSDayBillingDialog date="2026-02-10" onClose={() => {}} />);
    expect(await screen.findByTestId("pos-billing-tables-empty")).toBeInTheDocument();
    expect(screen.getByTestId("pos-billing-bar")).toHaveAttribute("aria-label", "0% cerrado");
    expect(screen.queryByTestId("pos-billing-tips")).toBeNull();
  });
});

describe("POSControlRail facturación", () => {
  it("keeps Facturación enabled on a sealed day while every other action is disabled", () => {
    const onAction = vi.fn();
    render(<POSControlRail onAction={onAction} readOnly />);
    expect(screen.getByTestId("pos-rail-comanda")).toBeDisabled();
    const button = screen.getByTestId("pos-rail-facturacion");
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledWith("facturacion");
  });
});
