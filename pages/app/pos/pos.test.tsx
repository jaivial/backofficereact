import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "jotai";

import Page from "./pos";

const bootstrap = {
  success: true,
  settings: { isEnabled: true, stockMode: "SHADOW", coversMode: "SHADOW", timezone: "Europe/Madrid", businessDayCutoff: "05:00" },
  products: [{ id: 3, name: "Agua", priceGrossCents: 250, vatRate: 10, categoryName: "Bebidas", isActive: true }],
  visits: [],
  tables: [{ id: 7, name: "Mesa 1", capacity: 4, occupied: false }],
};

const openCashDay = {
  id: 900, date: "2026-07-27", status: "OPEN", openedBy: 7, openedByName: "Ana",
  closedBy: null, closedByName: "", openingCashCents: 0, openedAt: "2026-07-27T08:00:00Z",
  closedAt: null, forcedOpen: false, notes: null, totalGrossCents: 0, ticketCount: 0, covers: 0,
};

describe("POSPage", () => {
  beforeEach(() => {
    // The page writes the resolved business date back into the URL, and jsdom
    // keeps it for the rest of the file: without this every later test would
    // start already scoped to whatever day the previous one landed on.
    window.history.replaceState(null, "", "/app/pos");
    vi.stubGlobal("crypto", { randomUUID: () => "command-1" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      // The sell screen is gated behind an open cash day, so these tests have
      // to stand a till up before they can reach it.
      if (url.includes("/cash-days/current")) return new Response(JSON.stringify({ success: true, date: "2026-07-27", cashDay: openCashDay, unclosedPrevious: [] }));
      if (url.includes("/bootstrap")) return new Response(JSON.stringify(bootstrap));
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

  // Without a till open there is nothing to book the sales against, so the gate
  // replaces the sell screen instead of sitting on top of a usable one.
  it("gates the sell screen when the day has no cash day", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/cash-days/current")) return new Response(JSON.stringify({ success: true, date: "2026-02-17", cashDay: null, unclosedPrevious: [] }));
      if (url.includes("/bootstrap")) return new Response(JSON.stringify(bootstrap));
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));
    render(<Provider><Page /></Provider>);
    expect(await screen.findByTestId("pos-no-cash-day-modal")).toBeInTheDocument();
    expect(screen.getByTestId("pos-no-cash-day-title")).toHaveTextContent("17 de febrero de 2026");
    expect(screen.queryByTestId("pos-sell-screen")).toBeNull();
  });

  // Earlier unsealed days take priority over the plain no-cash-day gate: the
  // operator has to resolve them (close, or force-open) before opening today.
  it("shows the unclosed-days gate before the no-cash-day gate when earlier days are open", async () => {
    const unclosed = [{ id: 5, date: "2026-02-16", status: "OPEN", openedBy: 3, openedByName: "Lucía", closedBy: null, closedByName: "", openingCashCents: 0, openedAt: "2026-02-16T08:30:00Z", closedAt: null, forcedOpen: false, notes: null, totalGrossCents: 123456, ticketCount: 9, covers: 42 }];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/cash-days/current")) return new Response(JSON.stringify({ success: true, date: "2026-02-17", cashDay: null, unclosedPrevious: unclosed }));
      if (url.includes("/bootstrap")) return new Response(JSON.stringify(bootstrap));
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));
    render(<Provider><Page /></Provider>);
    expect(await screen.findByTestId("pos-unclosed-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("pos-no-cash-day-modal")).toBeNull();
  });

  // Changing the date puts the cash day hook back into loading for a render.
  // If the gate lifted meanwhile, a live sell screen scoped to the day the
  // operator just left would be on screen and taking orders.
  it("keeps the gate up while a date change is still in flight", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/cash-days/current")) return new Response(JSON.stringify({ success: true, date: "2026-02-17", cashDay: null, unclosedPrevious: [] }));
      if (url.includes("/bootstrap")) return new Response(JSON.stringify(bootstrap));
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));
    render(<Provider><Page /></Provider>);
    await screen.findByTestId("pos-no-cash-day-modal");

    fireEvent.click(screen.getByTestId("pos-no-cash-day-picker"));
    fireEvent.click(await screen.findByTestId("month-calendar-day-20"));

    // Synchronously after the click the refetch is in flight and unanswered.
    expect(screen.getByTestId("pos-no-cash-day-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("pos-sell-screen")).toBeNull();
  });

  // A cash day that never resolves leaves no date to gate on, and opening a
  // day with no date would let the server pick one.
  it("offers a retry instead of a dateless gate when the cash day fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/cash-days/current")) return new Response(JSON.stringify({ success: false, error: "Servidor caído" }), { status: 500 });
      if (url.includes("/bootstrap")) return new Response(JSON.stringify(bootstrap));
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));
    render(<Provider><Page /></Provider>);
    expect(await screen.findByTestId("pos-cash-day-retry")).toBeInTheDocument();
    expect(screen.queryByTestId("pos-no-cash-day-modal")).toBeNull();
    expect(screen.queryByTestId("pos-sell-screen")).toBeNull();
  });
});
