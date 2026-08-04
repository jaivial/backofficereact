import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePOSRegister } from "./usePOSRegister";

const bootstrap = {
  success: true,
  settings: { isEnabled: true, stockMode: "SHADOW", coversMode: "SHADOW", timezone: "Europe/Madrid", businessDayCutoff: "05:00" },
  products: [
    { id: 3, name: "Agua", priceGrossCents: 250, vatRate: 10, categoryName: "Bebidas", isActive: true },
    { id: 4, name: "Arroz a banda", priceGrossCents: 1650, vatRate: 10, categoryName: "Arroces", isActive: true },
    { id: 5, name: "Inactivo", priceGrossCents: 100, vatRate: 10, categoryName: "Bebidas", isActive: false },
  ],
  visits: [],
  tables: [{ id: 7, name: "Mesa 1", capacity: 4, occupied: false }, { id: 8, name: "Mesa 3", capacity: 2, occupied: false }, { id: 9, name: "Mesa 5", capacity: 2, occupied: true }],
  areas: [{ id: 1, name: "Terraza" }],
  operators: [{ id: 3, displayName: "Ana" }],
  currentShift: { id: 8, status: "OPEN", openedAt: "2026-07-30T10:00:00Z" },
  restaurant: { name: "Villa Carmen", taxId: "B12345678", address: "Calle Mayor 1", phone: "+34600000000", email: "hola@test.local", logoUrl: "https://cdn.test/logo.webp" },
};

describe("usePOSRegister", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let uuid = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `key-${++uuid}` });
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/bootstrap")) return new Response(JSON.stringify(bootstrap));
      if (url.endsWith("/visits") && init?.method === "POST") return new Response(JSON.stringify({ success: true, visit: { id: 10, covers: 2, tableId: 7 }, ticket: { id: 11, version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } }), { status: 201 });
      if (url.endsWith("/visits/10/merge") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 5, status: "OPEN", lines: [], totalGrossCents: 0 }, covers: 5, movedLines: 1 }));
      if (url.includes("/tickets/11/lines/12/comp") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 4, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE", comped: true }], totalGrossCents: 0 } }));
      if (url.includes("/tickets/11/lines/12/move") && init?.method === "POST") {
        const moved = Number(JSON.parse(String(init?.body)).quantity);
        return new Response(JSON.stringify({
          success: true,
          sourceTicket: { id: 11, version: 4, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 2 - moved, unitPriceGrossCents: 250, lineTotalGrossCents: 250 * (2 - moved), status: "ACTIVE" }], totalGrossCents: 250 * (2 - moved) },
          targetTicket: { id: 21, version: 2, status: "OPEN", lines: [{ id: 31, productId: 3, productName: "Agua", quantity: moved, unitPriceGrossCents: 250, lineTotalGrossCents: 250 * moved, status: "ACTIVE" }], totalGrossCents: 250 * moved },
        }));
      }
      if (url.includes("/tickets/11/lines/12") && init?.method === "PATCH") {
        const quantity = Number(JSON.parse(String(init?.body)).quantity);
        return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 3, lines: [{ id: 12, productId: 3, productName: "Agua", quantity, unitPriceGrossCents: 250, lineTotalGrossCents: 250 * quantity, status: "ACTIVE" }], totalGrossCents: 250 * quantity } }));
      }
      if (url.endsWith("/tickets/11/lines/12/tags") && init?.method === "POST") return new Response(JSON.stringify({ success: true }));
      if (url.includes("/tickets/11/lines") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 2, lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 250 } }), { status: 201 });
      if (url.endsWith("/visits/10/tickets") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 21, version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } }), { status: 201 });
      if (url.includes("/tickets/11/checkout") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, ticketNumber: "TPV-1", version: 5, status: "PAID", lines: [], totalGrossCents: 250 }, stockStatus: "APPLIED", visitClosed: true }));
      return new Response(JSON.stringify({ success: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("loads bootstrap data on mount", async () => {
    const { result } = renderHook(() => usePOSRegister());
    await waitFor(() => expect(result.current.products.length).toBe(3));
    expect(result.current.tables[0].name).toBe("Mesa 1");
    expect(result.current.settings.isEnabled).toBe(true);
    expect(result.current.operators).toEqual(bootstrap.operators);
    expect(result.current.currentShift).toEqual(bootstrap.currentShift);
    expect(result.current.restaurant).toEqual(bootstrap.restaurant);
  });

  it("filters products by query and active flag", async () => {
    const { result } = renderHook(() => usePOSRegister());
    await waitFor(() => expect(result.current.products.length).toBe(3));
    expect(result.current.filteredProducts.map((p) => p.name)).toEqual(["Agua", "Arroz a banda"]);
    act(() => result.current.setQuery("arroz"));
    expect(result.current.filteredProducts.map((p) => p.name)).toEqual(["Arroz a banda"]);
  });

  it("opens a visit and adds a product line", async () => {
    const { result } = renderHook(() => usePOSRegister());
    await waitFor(() => expect(result.current.tables.length).toBe(3));
    act(() => result.current.setSelectedTable(result.current.tables[0]));
    await act(async () => { await result.current.openVisit(); });
    expect(result.current.ticket?.id).toBe(11);
    expect(result.current.visit?.covers).toBe(2);
    await act(async () => { await result.current.addProduct(result.current.products[0]); });
    expect(result.current.activeTicketLines.length).toBe(1);
    expect(result.current.ticketTotal).toBe(250);
  });

  it("increments quantity instead of duplicating when the same product is added twice", async () => {
    const { result } = renderHook(() => usePOSRegister());
    await waitFor(() => expect(result.current.tables.length).toBe(3));
    act(() => result.current.setSelectedTable(result.current.tables[0]));
    await act(async () => { await result.current.openVisit(); });
    await act(async () => { await result.current.addProduct(result.current.products[0]); });
    await act(async () => { await result.current.addProduct(result.current.products[0]); });
    expect(result.current.activeTicketLines.length).toBe(1);
    expect(result.current.activeTicketLines[0].quantity).toBe(2);
    expect(result.current.ticketTotal).toBe(500);
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/tickets/11/lines") && (call[1] as RequestInit | undefined)?.method === "POST").length).toBe(1);
  });

  describe("rail feature commands", () => {
    const openWithLine = async () => {
      const { result } = renderHook(() => usePOSRegister());
      await waitFor(() => expect(result.current.tables.length).toBe(3));
      act(() => result.current.setSelectedTable(result.current.tables[0]));
      await act(async () => { await result.current.openVisit(); });
      await act(async () => { await result.current.addProduct(result.current.products[0]); });
      return result;
    };

    const bodyOf = (suffix: string) => {
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).endsWith(suffix));
      return JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
    };

    it("parks and unparks the visit", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.parkVisit(true, "Esperando postre"); });
      expect(bodyOf("/visits/10/park")).toEqual({ parked: true, note: "Esperando postre" });
      expect(result.current.ticket).toBeNull();
    });

    it("explicitly unparks before restoring authoritative parked state", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/visits/10/park")) return new Response(JSON.stringify({ success: true }));
        if (url.endsWith("/visits/10")) return new Response(JSON.stringify({ success: true, visit: { id: 10, covers: 2, parked: false, tickets: [{ id: 11, version: 4, status: "OPEN", lines: [], totalGrossCents: 0 }] } }));
        if (url.endsWith("/bootstrap")) return new Response(JSON.stringify(bootstrap));
        return new Response(JSON.stringify({ success: true }));
      });
      await act(async () => { await result.current.restoreParkedVisit(10); });
      expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({ parked: false });
      expect(result.current.visit?.parked).toBe(false);
    });

    it("applies a surcharge through the adjustments endpoint", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.applyAdjustment("SURCHARGE", "PERCENT", 10, "Terraza"); });
      expect(bodyOf("/tickets/11/adjustments")).toMatchObject({ type: "SURCHARGE", mode: "PERCENT", percent: 10, reason: "Terraza" });
    });

    it("refuses an adjustment without a reason", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.applyAdjustment("SURCHARGE", "AMOUNT", 100, "  "); });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.error).toBe("Indica el motivo.");
    });

    it("comps a line with a reason", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.compLine(result.current.activeTicketLines[0], true, "Invitacion"); });
      expect(bodyOf("/tickets/11/lines/12/comp")).toEqual({ comped: true, reason: "Invitacion", expectedVersion: 2 });
    });

    it("saves a line comment without touching the quantity", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.setLineNote(result.current.activeTicketLines[0], "Sin hielo"); });
      expect(bodyOf("/tickets/11/lines/12")).toMatchObject({ quantity: 1, notes: "Sin hielo" });
    });

    it("opens the cash drawer with a reason", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.openDrawer("CHANGE"); });
      expect(bodyOf("/drawer/open")).toMatchObject({ reason: "CHANGE" });
    });

    it("guards concurrent drawer commands with one stable key", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await Promise.all([result.current.openDrawer("CHANGE"), result.current.openDrawer("CHANGE")]); });
      const calls = fetchMock.mock.calls.filter((entry) => String(entry[0]).endsWith("/drawer/open"));
      expect(calls).toHaveLength(1);
      expect(JSON.parse(String((calls[0][1] as RequestInit).body)).idempotencyKey).toBeTruthy();
    });

    it("attaches the customer to the visit", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.setVisitCustomer("Ana Ruiz", "12345678Z"); });
      expect(bodyOf("/visits/10/customer")).toEqual({ customerName: "Ana Ruiz", customerTaxId: "12345678Z" });
    });

    it("assigns the operator to the ticket", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.setTicketOperator(3); });
      expect(bodyOf("/tickets/11/operator")).toEqual({ operatorMemberId: 3 });
    });

    it("merges the selected visits into the active one", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.mergeVisits([41]); });
      expect(bodyOf("/visits/10/merge")).toMatchObject({ sourceVisitIds: [41] });
    });

    it("opens a bar visit on the BAR channel", async () => {
      const { result } = renderHook(() => usePOSRegister());
      await waitFor(() => expect(result.current.tables.length).toBe(3));
      fetchMock.mockClear();
      await act(async () => { await result.current.openBar(); });
      expect(bodyOf("/visits")).toMatchObject({ channel: "BAR", covers: 0 });
    });

    it("toggles a tag on a line", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.toggleLineTag(result.current.activeTicketLines[0], 2, true); });
      expect(bodyOf("/tickets/11/lines/12/tags")).toEqual({ tagId: 2, attach: true });
      expect(result.current.ticket?.lines[0].tagIds).toEqual([2]);
    });
  });

  describe("moveVisitToTable", () => {
    const openWithLine = async () => {
      const { result } = renderHook(() => usePOSRegister());
      await waitFor(() => expect(result.current.tables.length).toBe(3));
      act(() => result.current.setSelectedTable(result.current.tables[0]));
      await act(async () => { await result.current.openVisit(); });
      await act(async () => { await result.current.addProduct(result.current.products[0]); });
      return result;
    };

    it("patches the visit with the new table and keeps the covers", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.moveVisitToTable(result.current.tables[1]); });
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).endsWith("/visits/10"));
      expect((call?.[1] as RequestInit | undefined)?.method).toBe("PATCH");
      expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body))).toMatchObject({ tableId: 8, covers: 2 });
      expect(result.current.visit?.tableId).toBe(8);
      expect(result.current.ticket?.id).toBe(11);
    });

    it("refuses to move onto an occupied table", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.moveVisitToTable(result.current.tables[2]); });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.error).toBe("La mesa está ocupada.");
    });

    it("does nothing when the target table is the current one", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.moveVisitToTable(result.current.tables[0]); });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("checkout", () => {
    const openWithLine = async () => {
      const { result } = renderHook(() => usePOSRegister());
      await waitFor(() => expect(result.current.tables.length).toBe(3));
      act(() => result.current.setSelectedTable(result.current.tables[0]));
      await act(async () => { await result.current.openVisit(); });
      await act(async () => { await result.current.addProduct(result.current.products[0]); });
      return result;
    };

    it("computes the change due from the cash tendered", async () => {
      const result = await openWithLine();
      act(() => result.current.setCash("5"));
      expect(result.current.changeDue).toBe(250);
    });

    it("includes tip in amount due, payment validation and change", async () => {
      const result = await openWithLine();
      act(() => { result.current.setCash("3.50"); result.current.setTipCents(100); });
      expect(result.current.amountDueCents).toBe(350);
      expect(result.current.changeDue).toBe(0);
      await act(async () => { await result.current.checkout(); });
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("/checkout"));
      expect(JSON.parse(String((call?.[1] as RequestInit).body)).payments[0]).toMatchObject({ amountCents: 250, tipCents: 100 });
    });

    it("reports no change when the tendered amount does not exceed the total", async () => {
      const result = await openWithLine();
      act(() => result.current.setCash("2"));
      expect(result.current.changeDue).toBe(0);
    });

    it("accepts cash over the total and settles exactly the ticket total", async () => {
      const result = await openWithLine();
      act(() => result.current.setCash("5"));
      await act(async () => { await result.current.checkout(); });
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("/checkout"));
      const body = JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
      expect(body.payments).toEqual([{ method: "CASH", amountCents: 250, tipCents: 0, idempotencyKey: expect.any(String) }]);
      expect(result.current.lastPaidTicket?.ticketNumber).toBe("TPV-1");
    });

    it("does not charge twice when checkout is invoked concurrently", async () => {
      const result = await openWithLine();
      act(() => result.current.setCash("2.50"));
      await act(async () => { await Promise.all([result.current.checkout(), result.current.checkout()]); });
      expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/checkout")).length).toBe(1);
    });

    it("blocks checkout when the tendered amount is below the total", async () => {
      const result = await openWithLine();
      act(() => result.current.setCash("1"));
      await act(async () => { await result.current.checkout(); });
      expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/checkout")).length).toBe(0);
      expect(result.current.error).toBe("El pago no cubre el total.");
    });

    it("closes a fully comped zero-total ticket without a fake payment", async () => {
      const result = await openWithLine();
      await act(async () => { await result.current.compLine(result.current.activeTicketLines[0], true, "Invitación casa"); });
      await act(async () => { await result.current.checkout(); });
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("/checkout"));
      const body = JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
      expect(body.payments).toEqual([]);
    });
  });

  describe("sendKitchen", () => {
    const openWithLine = async () => {
      const { result } = renderHook(() => usePOSRegister());
      await waitFor(() => expect(result.current.tables.length).toBe(3));
      act(() => result.current.setSelectedTable(result.current.tables[0]));
      await act(async () => { await result.current.openVisit(); });
      await act(async () => { await result.current.addProduct(result.current.products[0]); });
      return result;
    };

    it("reports every active line as pending before dispatching", async () => {
      const result = await openWithLine();
      expect(result.current.pendingKitchenLines.map((line) => line.id)).toEqual([12]);
      expect(result.current.hasPendingKitchenLines).toBe(true);
    });

    it("marks dispatched quantities as sent and empties the pending list", async () => {
      const result = await openWithLine();
      await act(async () => { await result.current.sendKitchen(); });
      expect(result.current.pendingKitchenLines).toEqual([]);
      expect(result.current.hasPendingKitchenLines).toBe(false);
      expect(result.current.sentKitchenQuantities[12]).toBe(1);
    });

    it("re-flags a line as pending when its quantity grows after the dispatch", async () => {
      const result = await openWithLine();
      await act(async () => { await result.current.sendKitchen(); });
      await act(async () => { await result.current.addProduct(result.current.products[0]); });
      expect(result.current.pendingKitchenLines.map((line) => line.id)).toEqual([12]);
    });

    it("does not dispatch again when nothing is pending", async () => {
      const result = await openWithLine();
      await act(async () => { await result.current.sendKitchen(); });
      fetchMock.mockClear();
      await act(async () => { await result.current.sendKitchen(); });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("split tickets", () => {
    const openWithTwoUnits = async () => {
      const { result } = renderHook(() => usePOSRegister());
      await waitFor(() => expect(result.current.tables.length).toBe(3));
      act(() => result.current.setSelectedTable(result.current.tables[0]));
      await act(async () => { await result.current.openVisit(); });
      await act(async () => { await result.current.addProduct(result.current.products[0]); });
      await act(async () => { await result.current.addProduct(result.current.products[0]); });
      return result;
    };

    it("creates a sibling ticket and targets it", async () => {
      const result = await openWithTwoUnits();
      await act(async () => { await result.current.createSplitTicket(); });
      expect(result.current.openSplitTickets.map((entry) => entry.id)).toEqual([11, 21]);
      expect(result.current.splitTargetId).toBe(21);
    });

    it("moves the whole line to the target ticket by default", async () => {
      const result = await openWithTwoUnits();
      await act(async () => { await result.current.createSplitTicket(); });
      fetchMock.mockClear();
      await act(async () => { await result.current.moveLine(result.current.activeTicketLines[0]); });
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("/lines/12/move"));
      expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body)).quantity).toBe(2);
      expect(result.current.ticketTotal).toBe(0);
    });

    it("moves a partial quantity clamped to the line quantity", async () => {
      const result = await openWithTwoUnits();
      await act(async () => { await result.current.createSplitTicket(); });
      fetchMock.mockClear();
      await act(async () => { await result.current.moveLine(result.current.activeTicketLines[0], 1); });
      let call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("/lines/12/move"));
      expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body)).quantity).toBe(1);
      expect(result.current.ticketTotal).toBe(250);

      fetchMock.mockClear();
      await act(async () => { await result.current.moveLine(result.current.activeTicketLines[0], 99); });
      call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("/lines/12/move"));
      expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body)).quantity).toBe(1);
    });

    it("ignores a non-positive move quantity", async () => {
      const result = await openWithTwoUnits();
      await act(async () => { await result.current.createSplitTicket(); });
      fetchMock.mockClear();
      await act(async () => { await result.current.moveLine(result.current.activeTicketLines[0], 0); });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("applyDiscount", () => {
    const openWithLine = async () => {
      const { result } = renderHook(() => usePOSRegister());
      await waitFor(() => expect(result.current.tables.length).toBe(3));
      act(() => result.current.setSelectedTable(result.current.tables[0]));
      await act(async () => { await result.current.openVisit(); });
      await act(async () => { await result.current.addProduct(result.current.products[0]); });
      return result;
    };

    it("rejects a positive discount without a reason", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.applyDiscount(100, "  "); });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.error).toBe("Indica el motivo del descuento.");
    });

    it("posts the trimmed reason and the amount in cents", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.applyDiscount(100, "  Fidelidad  "); });
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).endsWith("/tickets/11/discount"));
      expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body))).toEqual({ amountCents: 100, reason: "Fidelidad" });
    });

    it("clamps the discount to the ticket total", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.applyDiscount(9999, "Invitación"); });
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).endsWith("/tickets/11/discount"));
      expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body)).amountCents).toBe(250);
    });

    it("allows clearing the discount with amount 0 and no reason", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.applyDiscount(0, ""); });
      const call = fetchMock.mock.calls.find((entry) => String(entry[0]).endsWith("/tickets/11/discount"));
      expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body))).toEqual({ amountCents: 0, reason: "" });
    });
  });

  describe("voidOrder", () => {
    const openWithLine = async () => {
      const { result } = renderHook(() => usePOSRegister());
      await waitFor(() => expect(result.current.tables.length).toBe(3));
      act(() => result.current.setSelectedTable(result.current.tables[0]));
      await act(async () => { await result.current.openVisit(); });
      await act(async () => { await result.current.addProduct(result.current.products[0]); });
      return result;
    };

    it("does nothing when the reason is blank", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.voidOrder("   "); });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.ticket?.id).toBe(11);
    });

    it("voids every active line, then the ticket, then cancels the visit", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.voidOrder("Error de comanda"); });

      const calls = fetchMock.mock.calls.map((call) => `${(call[1] as RequestInit | undefined)?.method || "GET"} ${String(call[0])}`);
      expect(calls).toContain("POST /api/admin/pos/tickets/11/lines/12/void");
      expect(calls).toContain("POST /api/admin/pos/tickets/11/void");
      expect(calls).toContain("POST /api/admin/pos/visits/10/cancel");
      expect(result.current.ticket).toBeNull();
      expect(result.current.visit).toBeNull();
      expect(result.current.splitTickets).toEqual([]);
    });

    it("sends the trimmed reason to the line void and ticket void endpoints", async () => {
      const result = await openWithLine();
      fetchMock.mockClear();
      await act(async () => { await result.current.voidOrder("  Cliente se va  "); });

      for (const suffix of ["/tickets/11/lines/12/void", "/tickets/11/void"]) {
        const call = fetchMock.mock.calls.find((entry) => String(entry[0]).endsWith(suffix));
        expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body)).reason).toBe("Cliente se va");
      }
    });
  });
});
