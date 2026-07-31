import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "jotai";

import Page from "./pos";

vi.mock("lucide-react", async () => {
  const { createElement } = await import("react");
  const icon = (name: string) => (props: Record<string, unknown>) => createElement("span", { "data-icon": name, ...props });
  return {
    Delete: icon("delete"), LayoutGrid: icon("layout-grid"), Maximize2: icon("maximize"), Minimize2: icon("minimize"),
    Minus: icon("minus"), Plus: icon("plus"), Receipt: icon("receipt"), Trash2: icon("trash"), Users: icon("users"), X: icon("x"),
    CreditCard: icon("card"), Search: icon("search"), UtensilsCrossed: icon("utensils"), Upload: icon("upload"), MoreVertical: icon("more"),
  };
});

const bootstrap = {
  success: true,
  settings: { isEnabled: true, stockMode: "SHADOW", coversMode: "SHADOW", timezone: "Europe/Madrid", businessDayCutoff: "05:00" },
  products: [{ id: 3, name: "Agua", priceGrossCents: 250, vatRate: 10, categoryName: "Bebidas", isActive: true }],
  visits: [],
  tables: [{ id: 7, name: "Mesa 1", capacity: 4, occupied: false }],
};

describe("POSPage", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "command-1" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/bootstrap")) return new Response(JSON.stringify(bootstrap));
      if (url.includes("/reservations/eligible")) return new Response(JSON.stringify({ success: true, items: [{ id: 22, customerName: "Ana", reservationDate: "2026-07-27", reservationTime: "14:00", partySize: 3, status: "confirmed" }] }));
      if (url.endsWith("/visits") && init?.method === "POST") return new Response(JSON.stringify({ success: true, visit: { id: 10, covers: 2, tableId: 7 }, ticket: { id: 11, version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } }), { status: 201 });
      if (url.includes("/lines") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 2, status: "OPEN", lines: [{ id: 12, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 250 } }), { status: 201 });
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));
  });

  const openMesa = async () => {
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
  };

  it("loads reservation and sends booking id when seating", async () => {
    render(<Provider><Page /></Provider>);
    await openMesa();
    expect(screen.queryByTestId("pos-load-reservations")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByTestId("pos-reservation-select"), { target: { value: "22" } });
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/pos/visits", expect.objectContaining({ body: expect.stringContaining('"bookingId":22') })));
  });

  it("opens a table and adds a product", async () => {
    render(<Provider><Page /></Provider>);
    await openMesa();
    fireEvent.change(screen.getByLabelText("Comensales"), { target: { value: "2" } });
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-product-3")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/pos/tickets/11/lines", expect.objectContaining({ method: "POST" })));
  });

  it("sends the order to kitchen from the control rail", async () => {
    render(<Provider><Page /></Provider>);
    await openMesa();
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-product-3")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Agua"));
    fireEvent.click(screen.getByTestId("pos-rail-cocina"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/pos/tickets/11/kitchen-dispatches", expect.objectContaining({ method: "POST" })));
  });
});
