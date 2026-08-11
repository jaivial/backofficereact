import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "jotai";

import { POSSellScreen } from "./POSSellScreen";

const downloadComandaPdf = vi.hoisted(() => vi.fn(async (_input: Record<string, unknown>) => {}));
vi.mock("../../utils/comandaPdf", () => ({ downloadComandaPdf }));

vi.mock("lucide-react", async () => {
  const { createElement } = await import("react");
  const icon = (name: string) => (props: Record<string, unknown>) => createElement("span", { "data-icon": name, ...props });
  return {
    ArrowRightLeft: icon("arrow-right-left"), Delete: icon("delete"), LayoutGrid: icon("layout-grid"), Maximize2: icon("maximize"), Minimize2: icon("minimize"),
    Merge: icon("merge"), Minus: icon("minus"), Plus: icon("plus"), Receipt: icon("receipt"), Trash2: icon("trash"), Users: icon("users"), X: icon("x"), UtensilsCrossed: icon("utensils"), Upload: icon("upload"), MoreVertical: icon("more"),
  };
});

const bootstrap = {
  success: true,
  settings: { isEnabled: true, stockMode: "SHADOW", coversMode: "SHADOW", timezone: "Europe/Madrid", businessDayCutoff: "05:00" },
  products: [
    { id: 3, name: "Agua", priceGrossCents: 250, vatRate: 10, categoryName: "Bebidas", isActive: true },
    { id: 4, name: "Arroz a banda", priceGrossCents: 1650, vatRate: 10, categoryName: "Arroces", isActive: true },
    { id: 6, name: "Café solo", priceGrossCents: 160, vatRate: 10, categoryName: "Cafés", isActive: true },
  ],
  visits: [],
  tables: [{ id: 7, name: "Mesa 1", capacity: 4, occupied: false, areaId: 1, areaName: "Salón" }, { id: 8, name: "Mesa 3", capacity: 2, occupied: false, areaId: 2, areaName: "Terraza" }],
  areas: [{ id: 1, name: "Salón" }, { id: 2, name: "Terraza" }],
  operators: [{ id: 3, displayName: "Ana" }, { id: 4, displayName: "Luis" }],
  currentShift: { id: 8, status: "OPEN" },
  restaurant: { name: "Villa Carmen", taxId: "B12345678", address: "Calle Mayor 1", phone: "+34600000000", logoUrl: "https://cdn.test/logo.webp" },
};

describe("POSSellScreen", () => {
  beforeEach(() => {
    downloadComandaPdf.mockReset();
    downloadComandaPdf.mockResolvedValue(undefined);
    vi.stubGlobal("crypto", { randomUUID: () => "key-1" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/bootstrap")) return new Response(JSON.stringify(bootstrap));
      if (url.endsWith("/visits") && init?.method === "POST") return new Response(JSON.stringify({ success: true, visit: { id: 10, covers: 2, tableId: 7 }, ticket: { id: 11, version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } }), { status: 201 });
      if (url.includes("/tickets/11/lines/12/move") && init?.method === "POST") return new Response(JSON.stringify({
        success: true,
        sourceTicket: { id: 11, version: 4, status: "OPEN", lines: [], totalGrossCents: 0 },
        targetTicket: { id: 21, version: 2, status: "OPEN", lines: [{ id: 31, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 250 },
      }));
      if (url.includes("/tickets/11/lines/12/void") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 3, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "VOIDED" }], totalGrossCents: 0 } }));
      if (url.includes("/tickets/11/lines/12/comp") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 7, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE", comped: true }], totalGrossCents: 0 } }));
      if (url.includes("/tickets/11/lines") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 2, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 250 } }), { status: 201 });
      if (url.endsWith("/visits/10/tickets") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 21, version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } }), { status: 201 });
      if (url.includes("/tickets/11/checkout") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, ticketNumber: "TPV-1", version: 5, status: "PAID", lines: [], totalGrossCents: 250 }, stockStatus: "APPLIED", visitClosed: true }));
      if (url.endsWith("/tags")) return new Response(JSON.stringify({ success: true, items: [{ id: 2, name: "Sin gluten", isActive: true }] }));
      if (url.endsWith("/visits/10/merge") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 5, status: "OPEN", lines: [], totalGrossCents: 0 }, covers: 5 }));
      if (url.includes("/adjustments") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 6, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 275 } }));
      if (url.includes("/tickets/21/lines/31/move") && init?.method === "POST") return new Response(JSON.stringify({
        success: true,
        sourceTicket: { id: 21, version: 3, status: "OPEN", lines: [], totalGrossCents: 0 },
        targetTicket: { id: 11, version: 5, status: "OPEN", lines: [{ id: 31, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 250 },
      }));
      if (url.includes("/tickets/21/void") && init?.method === "POST") return new Response(JSON.stringify({ success: true, ticket: { id: 21, version: 4, status: "VOIDED", lines: [], totalGrossCents: 0 } }));
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));
  });

  it("renders layout regions: switcher, categories, products, ticket, keypad, rail", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    expect(screen.getByTestId("pos-ticket-panel")).toBeInTheDocument();
    expect(screen.getByTestId("pos-keypad")).toBeInTheDocument();
    expect(screen.getByTestId("pos-category-panel")).toBeInTheDocument();
    expect(screen.getByTestId("pos-product-grid")).toBeInTheDocument();
    expect(screen.getByTestId("pos-control-rail")).toBeInTheDocument();
  });

  it("locks every input when the day is sealed (readOnly)", async () => {
    render(<Provider><POSSellScreen readOnly date="2026-02-10" /></Provider>);
    expect(screen.getByTestId("pos-readonly-notice")).toBeInTheDocument();
    // A sealed day disables the whole rail and every keypad key.
    expect(screen.getByTestId("pos-rail-comanda")).toBeDisabled();
    expect(screen.getByTestId("pos-key-7")).toBeDisabled();
    expect(screen.getByTestId("pos-keypad-confirm")).toBeDisabled();
  });

  it("derives category tiles from products and filters grid on tap", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    expect(await screen.findByTestId("pos-category-Arroces")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("pos-category-Arroces"));
    await waitFor(() => {
      expect(screen.getByTestId("pos-product-4")).toBeInTheDocument();
      expect(screen.queryByTestId("pos-product-3")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("pos-category-all"));
    expect(await screen.findByTestId("pos-product-3")).toBeInTheDocument();
  });

  it("opens a table via Mesa flow and adds product with one tap", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Agua"));
    expect(screen.getByTestId("pos-total-value")).toHaveTextContent("2,50");
  });

  it("loads today's reservations when the table modal opens and shows empty fallback", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    expect(await screen.findByTestId("pos-reservations-empty")).toHaveTextContent("No hay reservas para hoy");
    expect(screen.queryByTestId("pos-load-reservations")).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/pos/reservations/eligible", expect.objectContaining({ credentials: "include" })));
  });

  it("shows the 23-feature control rail", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    await screen.findByTestId("pos-control-rail");
    for (const key of ["total", "comanda", "aparcar", "mesa", "salon", "juntar-mesas", "borrar-comanda", "combinado", "cliente", "cocina", "cajon", "descuento", "recargo", "invita", "empleado", "separar-comanda", "tags", "barra", "comentario", "dividir-comanda", "suplemento", "propina", "pack"]) {
      expect(screen.getByTestId(`pos-rail-${key}`)).toBeInTheDocument();
    }
  });

  it("asks for confirmation before voiding a ticket line", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-void-12");

    fireEvent.click(screen.getByTestId("pos-line-void-12"));
    expect(await screen.findByText(/¿Anular 1 × Agua/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => expect(screen.queryByText(/¿Anular 1 × Agua/)).not.toBeInTheDocument());
    expect(screen.getByTestId("pos-line-12")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("pos-line-void-12"));
    fireEvent.click(await screen.findByText("Anular"));
    await waitFor(() => expect(screen.queryByTestId("pos-line-12")).not.toBeInTheDocument());
  });

  it("dividir comanda shows the per-guest share and pre-fills the checkout with one share", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");

    fireEvent.click(screen.getByTestId("pos-rail-dividir-comanda"));
    const guests = await screen.findByTestId("pos-divide-guests");
    fireEvent.change(guests, { target: { value: "2" } });
    expect(screen.getByTestId("pos-divide-share")).toHaveTextContent("1,25");
    expect(screen.getByTestId("pos-divide-shares")).toHaveTextContent(/1,25\s*€ \+ 1,25\s*€/);

    fireEvent.click(screen.getByTestId("pos-divide-collect"));
    await waitFor(() => expect(screen.getByTestId("pos-checkout-modal")).toBeInTheDocument());
    expect(screen.getByTestId("pos-cash")).toHaveValue("1.25");
  });

  it("does not open the dividir comanda modal without an active ticket", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-dividir-comanda"));
    expect(screen.queryByTestId("pos-divide-modal")).not.toBeInTheDocument();
  });

  it("mesa moves an open comanda to another table and keeps the lines", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");

    fireEvent.click(screen.getByTestId("pos-rail-mesa"));
    expect(await screen.findByTestId("pos-tables-modal-title")).toHaveTextContent("Cambiar mesa");

    fireEvent.click(screen.getByTestId("pos-table-8"));
    await waitFor(() => {
      const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((entry: unknown[]) => String(entry[0]).endsWith("/visits/10") && (entry[1] as RequestInit | undefined)?.method === "PATCH");
      expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body))).toMatchObject({ tableId: 8 });
    });
    await waitFor(() => expect(screen.queryByTestId("pos-tables-modal")).not.toBeInTheDocument());
    expect(screen.getByTestId("pos-line-12")).toBeInTheDocument();
  });

  const openTableWithLine = async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");
  };

  const fetchCalls = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
  const lastBodyFor = (suffix: string) => {
    const call = [...fetchCalls()].reverse().find((entry: unknown[]) => String(entry[0]).endsWith(suffix));
    return JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
  };

  it("aparcar parks the comanda and clears the register", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-aparcar"));
    fireEvent.change(await screen.findByTestId("pos-park-note"), { target: { value: "Esperando postre" } });
    fireEvent.click(screen.getByTestId("pos-park-confirm"));
    await waitFor(() => expect(lastBodyFor("/visits/10/park")).toEqual({ parked: true, note: "Esperando postre" }));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Selecciona mesa"));
  });

  it("recargo applies a percentage surcharge", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-recargo"));
    fireEvent.click(await screen.findByTestId("pos-surcharge-option-percent"));
    fireEvent.change(screen.getByTestId("pos-surcharge-value"), { target: { value: "10" } });
    fireEvent.change(screen.getByTestId("pos-surcharge-reason"), { target: { value: "Terraza" } });
    fireEvent.click(screen.getByTestId("pos-surcharge-confirm"));
    await waitFor(() => expect(lastBodyFor("/tickets/11/adjustments")).toMatchObject({ type: "SURCHARGE", mode: "PERCENT", percent: 10, reason: "Terraza" }));
  });

  it("invita comps the selected line", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-line-12"));
    fireEvent.click(screen.getByTestId("pos-rail-invita"));
    fireEvent.change(await screen.findByTestId("pos-comp-reason"), { target: { value: "Invitacion casa" } });
    fireEvent.click(screen.getByTestId("pos-comp-confirm"));
    await waitFor(() => expect(lastBodyFor("/tickets/11/lines/12/comp")).toEqual({ comped: true, reason: "Invitacion casa", expectedVersion: 2 }));
  });

  it("comentario saves a note on the selected line", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-line-12"));
    fireEvent.click(screen.getByTestId("pos-rail-comentario"));
    fireEvent.change(await screen.findByTestId("pos-note-note"), { target: { value: "Sin hielo" } });
    fireEvent.click(screen.getByTestId("pos-note-confirm"));
    await waitFor(() => expect(lastBodyFor("/tickets/11/lines/12")).toMatchObject({ notes: "Sin hielo" }));
  });

  it("cajon records a drawer opening", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-cajon"));
    fireEvent.click(await screen.findByTestId("pos-drawer-confirm"));
    await waitFor(() => expect(lastBodyFor("/drawer/open")).toMatchObject({ reason: "NO_SALE" }));
  });

  it("cliente attaches customer billing data to the visit", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-cliente"));
    fireEvent.change(await screen.findByTestId("pos-customer-customerName"), { target: { value: "Ana Ruiz" } });
    fireEvent.change(screen.getByTestId("pos-customer-customerTaxId"), { target: { value: "12345678Z" } });
    fireEvent.click(screen.getByTestId("pos-customer-confirm"));
    await waitFor(() => expect(lastBodyFor("/visits/10/customer")).toEqual({ customerName: "Ana Ruiz", customerTaxId: "12345678Z" }));
  });

  it("propina adds a tip on top of the checkout total", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-propina"));
    fireEvent.change(await screen.findByTestId("pos-tip-value"), { target: { value: "1" } });
    fireEvent.click(screen.getByTestId("pos-tip-confirm"));
    await waitFor(() => expect(screen.getByTestId("pos-checkout-modal")).toBeInTheDocument());
    expect(screen.getByTestId("pos-checkout-tip")).toHaveTextContent("1,00");
  });

  it("allows closing a fully comped zero-total ticket", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-line-12"));
    fireEvent.click(screen.getByTestId("pos-rail-invita"));
    fireEvent.change(await screen.findByTestId("pos-comp-reason"), { target: { value: "Invitación casa" } });
    fireEvent.click(screen.getByTestId("pos-comp-confirm"));
    await waitFor(() => expect(screen.getByTestId("pos-total-value")).toHaveTextContent("0,00"));
    fireEvent.click(screen.getByTestId("pos-rail-total"));
    expect(await screen.findByTestId("pos-checkout-confirm")).not.toBeDisabled();
  });

  it("barra opens a tableless bar sale", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-barra"));
    await waitFor(() => expect(lastBodyFor("/visits")).toMatchObject({ channel: "BAR", covers: 0 }));
  });

  it("salon filters the table grid by area", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-salon"));
    expect(await screen.findByTestId("pos-tables-modal")).toBeInTheDocument();
    expect(screen.getByTestId("pos-area-1")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("pos-area-1"));
    await waitFor(() => expect(screen.queryByTestId("pos-table-8")).not.toBeInTheDocument());
    expect(screen.getByTestId("pos-table-7")).toBeInTheDocument();
  });

  it("resets Salon to Todos after close and reopen", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-salon"));
    fireEvent.click(screen.getByTestId("pos-area-1"));
    expect(screen.queryByTestId("pos-table-8")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("pos-tables-close"));
    fireEvent.click(screen.getByTestId("pos-rail-salon"));
    expect(screen.getByTestId("pos-area-all")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("pos-table-8")).toBeInTheDocument();
  });

  it("disables line metadata actions until a line is selected and disables Barra with an active visit", async () => {
    await openTableWithLine();
    expect(screen.getByTestId("pos-rail-invita")).toBeDisabled();
    expect(screen.getByTestId("pos-rail-tags")).toBeDisabled();
    expect(screen.getByTestId("pos-rail-comentario")).toBeDisabled();
    expect(screen.getByTestId("pos-rail-barra")).toBeDisabled();
    fireEvent.click(screen.getByTestId("pos-line-12"));
    expect(screen.getByTestId("pos-rail-invita")).not.toBeDisabled();
    expect(screen.getByTestId("pos-rail-tags")).not.toBeDisabled();
    expect(screen.getByTestId("pos-rail-comentario")).not.toBeDisabled();
  });

  it("uses operator names and supports clearing the assignment", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-empleado"));
    expect(await screen.findByRole("option", { name: "Ana" })).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("pos-operator-operatorMemberId"), { target: { value: "3" } });
    fireEvent.click(screen.getByTestId("pos-operator-confirm"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-operator")).toHaveTextContent("Ana"));
  });

  it("uses register tip state for exact payment, pending and change", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-propina"));
    fireEvent.change(await screen.findByTestId("pos-tip-value"), { target: { value: "1" } });
    fireEvent.click(screen.getByTestId("pos-tip-confirm"));
    expect(await screen.findByTestId("pos-checkout-due")).toHaveTextContent("3,50");
    fireEvent.click(screen.getByTestId("pos-quick-cash-exact"));
    expect(screen.getByTestId("pos-cash")).toHaveValue("3.50");
    expect(screen.getByTestId("pos-checkout-pending")).toHaveTextContent("0,00");
    expect(screen.getByTestId("pos-checkout-change")).toHaveTextContent("0,00");
  });

  it("keeps every rail button actionable", async () => {
    await openTableWithLine();
    const inert: string[] = [];
    for (const key of ["total", "comanda", "aparcar", "mesa", "salon", "juntar-mesas", "borrar-comanda", "combinado", "cliente", "cocina", "cajon", "descuento", "recargo", "invita", "empleado", "separar-comanda", "tags", "barra", "comentario", "dividir-comanda", "suplemento", "propina", "pack"]) {
      const button = screen.getByTestId(`pos-rail-${key}`);
      if (!(button as HTMLButtonElement).disabled) continue;
      inert.push(key);
    }
    expect(inert).toEqual(["invita", "tags", "barra", "comentario"]);
  });

  it("total opens the checkout modal, fills exact cash and shows the change due", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");

    fireEvent.click(screen.getByTestId("pos-rail-total"));
    const confirm = await screen.findByTestId("pos-checkout-confirm");
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByTestId("pos-quick-cash-exact"));
    expect(screen.getByTestId("pos-checkout-change")).toHaveTextContent("0,00");
    expect(confirm).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("pos-quick-cash-5"));
    expect(screen.getByTestId("pos-checkout-change")).toHaveTextContent("2,50");

    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByTestId("pos-checkout-modal")).not.toBeInTheDocument());
    expect(await screen.findByTestId("pos-last-receipt")).toHaveTextContent("TPV-1");
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((entry: unknown[]) => String(entry[0]).includes("/checkout")).length).toBe(1);
  });

  it("cocina marks dispatched lines as sent and disables the rail button while nothing is pending", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));

    expect(screen.getByTestId("pos-rail-cocina")).toBeDisabled();
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");
    expect(screen.getByTestId("pos-rail-cocina")).not.toBeDisabled();
    expect(screen.queryByTestId("pos-line-sent-12")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("pos-rail-cocina"));
    expect(await screen.findByTestId("pos-line-sent-12")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("pos-rail-cocina")).toBeDisabled());
  });

  it("separar comanda creates a second ticket, moves a line to it and switches between tickets", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");

    fireEvent.click(screen.getByTestId("pos-rail-separar-comanda"));
    expect(await screen.findByTestId("pos-split-tab-21")).toBeInTheDocument();
    expect(screen.getByTestId("pos-split-tab-11")).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByTestId("pos-line-move-12"));
    await waitFor(() => expect(screen.queryByTestId("pos-line-12")).not.toBeInTheDocument());

    fireEvent.click(screen.getByTestId("pos-split-tab-21"));
    await waitFor(() => expect(screen.getByTestId("pos-split-tab-21")).toHaveAttribute("aria-selected", "true"));
    expect(screen.getByTestId("pos-line-31")).toBeInTheDocument();
  });

  it("reagrupar button merges all split tickets back into one", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");

    fireEvent.click(screen.getByTestId("pos-rail-separar-comanda"));
    expect(await screen.findByTestId("pos-split-tab-21")).toBeInTheDocument();
    expect(await screen.findByTestId("pos-split-merge")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("pos-line-move-12"));
    await waitFor(() => expect(screen.queryByTestId("pos-line-12")).not.toBeInTheDocument());

    fireEvent.click(screen.getByTestId("pos-split-merge"));
    await waitFor(() => expect(screen.queryByTestId("pos-split-tab-21")).not.toBeInTheDocument());
    expect(screen.queryByTestId("pos-split-merge")).not.toBeInTheDocument();
  });

  it("descuento applies a percentage of the ticket total with a reason", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");

    fireEvent.click(screen.getByTestId("pos-rail-descuento"));
    const confirm = await screen.findByTestId("pos-discount-confirm");
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByTestId("pos-discount-mode-percent"));
    fireEvent.change(screen.getByTestId("pos-discount-amount"), { target: { value: "10" } });
    fireEvent.change(screen.getByTestId("pos-discount-reason"), { target: { value: "Fidelidad" } });
    expect(screen.getByTestId("pos-discount-preview")).toHaveTextContent("0,25");

    fireEvent.click(confirm);
    await waitFor(() => {
      const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((entry: unknown[]) => String(entry[0]).endsWith("/tickets/11/discount"));
      expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body))).toEqual({ amountCents: 25, reason: "Fidelidad" });
    });
    await waitFor(() => expect(screen.queryByTestId("pos-discount-modal")).not.toBeInTheDocument());
  });

  it("does not open the descuento modal without an active ticket", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-descuento"));
    expect(screen.queryByTestId("pos-discount-modal")).not.toBeInTheDocument();
  });

  it("borrar comanda accepts an optional typed reason", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");

    fireEvent.click(screen.getByTestId("pos-rail-borrar-comanda"));
    const confirm = await screen.findByTestId("pos-void-order-confirm");
    expect(confirm).not.toBeDisabled();

    fireEvent.change(screen.getByTestId("pos-void-order-reason"), { target: { value: "Error de comanda" } });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.queryByTestId("pos-void-order-modal")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Selecciona mesa"));
  });

  it("borrar comanda allows deleting without typing a reason", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-borrar-comanda"));
    const confirm = await screen.findByTestId("pos-void-order-confirm");
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(lastBodyFor("/tickets/11/void")).toEqual({ reason: "Sin motivo indicado" }));
  });

  it("does not open the borrar comanda modal without an active ticket", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-borrar-comanda"));
    expect(screen.queryByTestId("pos-void-order-modal")).not.toBeInTheDocument();
  });

  it("renders the accent closing actions first in the rail", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    const rail = await screen.findByTestId("pos-control-rail");
    const keys = [...rail.querySelectorAll("button")].map((button) => button.getAttribute("data-testid"));
    // Total + Cerrar mesas are the accent actions and lead the rail; comanda follows.
    expect(keys.slice(0, 3)).toEqual(["pos-rail-total", "pos-rail-cerrar-mesas", "pos-rail-comanda"]);
  });

  it("keeps comanda disabled without a ticket and without active lines", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    expect(await screen.findByTestId("pos-rail-comanda")).toBeDisabled();
    fireEvent.click(screen.getByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));
    expect(screen.getByTestId("pos-rail-comanda")).toBeDisabled();
    fireEvent.click(screen.getByTestId("pos-product-3"));
    await screen.findByTestId("pos-line-12");
    expect(screen.getByTestId("pos-rail-comanda")).not.toBeDisabled();
  });

  it("comanda downloads the ticket summary with the current visit context", async () => {
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-comanda"));
    await waitFor(() => expect(downloadComandaPdf).toHaveBeenCalledTimes(1));
    expect(downloadComandaPdf.mock.calls[0][0]).toMatchObject({
      ticket: expect.objectContaining({ id: 11 }),
      visit: expect.objectContaining({ id: 10 }),
      restaurant: expect.objectContaining({ name: "Villa Carmen", taxId: "B12345678" }),
      generatedAt: expect.any(Date),
    });
  });

  it("comanda does not download twice while a download is running", async () => {
    let release: () => void = () => {};
    downloadComandaPdf.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-comanda"));
    fireEvent.click(screen.getByTestId("pos-rail-comanda"));
    await waitFor(() => expect(downloadComandaPdf).toHaveBeenCalledTimes(1));
    await act(async () => { release(); });
  });

  it("comanda reports an error and keeps the ticket when the pdf fails", async () => {
    downloadComandaPdf.mockRejectedValue(new Error("No se pudo generar la comanda."));
    await openTableWithLine();
    fireEvent.click(screen.getByTestId("pos-rail-comanda"));
    expect(await screen.findByTestId("pos-error")).toHaveTextContent("No se pudo generar la comanda.");
    expect(screen.getByTestId("pos-line-12")).toBeInTheDocument();
  });

  it("expands the ticket panel and hides the catalog on double tap of the total row", async () => {
    render(<Provider><POSSellScreen /></Provider>);
    fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
    fireEvent.click(await screen.findByText("Mesa 1"));
    fireEvent.click(screen.getByTestId("pos-open-visit"));
    await waitFor(() => expect(screen.getByTestId("pos-total-row")).toBeInTheDocument());
    expect(screen.getByTestId("pos-sell-row-catalog")).toBeVisible();

    fireEvent.doubleClick(screen.getByTestId("pos-total-row"));
    expect(screen.getByTestId("pos-ticket-panel")).toHaveClass("pos-ticketPanel--expanded");
    expect(screen.getByTestId("pos-sell-row-catalog")).not.toBeVisible();

    fireEvent.doubleClick(screen.getByTestId("pos-total-row"));
    expect(screen.getByTestId("pos-ticket-panel")).not.toHaveClass("pos-ticketPanel--expanded");
    expect(screen.getByTestId("pos-sell-row-catalog")).toBeVisible();
  });

  describe("keypad price customization", () => {
    it("adds product at keypad price when a number is entered before tapping product", async () => {
      render(<Provider><POSSellScreen /></Provider>);
      fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
      fireEvent.click(await screen.findByText("Mesa 1"));
      fireEvent.click(screen.getByTestId("pos-open-visit"));
      await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));

      // Type 2,00 on keypad (€2.00)
      fireEvent.click(screen.getByTestId("pos-key-2"));
      fireEvent.click(screen.getByTestId("pos-key-comma"));
      fireEvent.click(screen.getByTestId("pos-key-0"));
      fireEvent.click(screen.getByTestId("pos-key-0"));

      // Tap Agua (normally €2.50)
      fireEvent.click(screen.getByTestId("pos-product-3"));

      await waitFor(() => {
        const call = fetchCalls().find((entry: unknown[]) => String(entry[0]).includes("/tickets/11/lines") && (entry[1] as RequestInit | undefined)?.method === "POST");
        expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body))).toMatchObject({
          productId: 3,
          quantity: 1,
          unitPriceOverrideCents: 200,
        });
      });
    });

    it("adds product with qty and price override when using multiplier", async () => {
      render(<Provider><POSSellScreen /></Provider>);
      fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
      fireEvent.click(await screen.findByText("Mesa 1"));
      fireEvent.click(screen.getByTestId("pos-open-visit"));
      await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));

      // Type 3 × 6 (3 units at €6 each)
      fireEvent.click(screen.getByTestId("pos-key-3"));
      fireEvent.click(screen.getByTestId("pos-key-op-mul"));
      fireEvent.click(screen.getByTestId("pos-key-6"));

      // Tap Agua
      fireEvent.click(screen.getByTestId("pos-product-3"));

      await waitFor(() => {
        const call = fetchCalls().find((entry: unknown[]) => String(entry[0]).includes("/tickets/11/lines") && (entry[1] as RequestInit | undefined)?.method === "POST");
        expect(JSON.parse(String((call?.[1] as RequestInit | undefined)?.body))).toMatchObject({
          productId: 3,
          quantity: 3,
          unitPriceOverrideCents: 600,
        });
      });
    });

    it("adds multiple units at catalog price when only qty and multiplier entered", async () => {
      render(<Provider><POSSellScreen /></Provider>);
      fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
      fireEvent.click(await screen.findByText("Mesa 1"));
      fireEvent.click(screen.getByTestId("pos-open-visit"));
      await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));

      // Type 3 × (no price after)
      fireEvent.click(screen.getByTestId("pos-key-3"));
      fireEvent.click(screen.getByTestId("pos-key-op-mul"));

      // Tap Agua (€2.50 catalog price)
      fireEvent.click(screen.getByTestId("pos-product-3"));

      await waitFor(() => {
        const call = fetchCalls().find((entry: unknown[]) => String(entry[0]).includes("/tickets/11/lines") && (entry[1] as RequestInit | undefined)?.method === "POST");
        const body = JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
        expect(body).toMatchObject({
          productId: 3,
          quantity: 3,
        });
        expect(body.unitPriceOverrideCents).toBeUndefined();
      });
    });

    it("clears keypad value and multiplier after adding product with override", async () => {
      render(<Provider><POSSellScreen /></Provider>);
      fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
      fireEvent.click(await screen.findByText("Mesa 1"));
      fireEvent.click(screen.getByTestId("pos-open-visit"));
      await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));

      // Type 3 × 6
      fireEvent.click(screen.getByTestId("pos-key-3"));
      fireEvent.click(screen.getByTestId("pos-key-op-mul"));
      fireEvent.click(screen.getByTestId("pos-key-6"));

      // Tap Agua
      fireEvent.click(screen.getByTestId("pos-product-3"));
      await screen.findByTestId("pos-line-12");

      // Keypad should be reset
      expect(screen.getByTestId("pos-keypad-value")).toHaveTextContent("0");
      expect(screen.queryByTestId("pos-keypad-expr")).not.toBeInTheDocument();
    });

    it("shows multiplier indicator when qty is set via multiplier", async () => {
      render(<Provider><POSSellScreen /></Provider>);
      fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
      fireEvent.click(await screen.findByText("Mesa 1"));
      fireEvent.click(screen.getByTestId("pos-open-visit"));
      await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));

      // Type 3 ×
      fireEvent.click(screen.getByTestId("pos-key-3"));
      fireEvent.click(screen.getByTestId("pos-key-op-mul"));

      // Should show multiplier indicator
      expect(screen.getByTestId("pos-keypad-multiplier")).toHaveTextContent("3 ×");
    });

    it("creates separate line when adding product at catalog price after a price-overridden line exists", async () => {
      // Mock: first add returns line with custom price, second add should POST new line
      let callCount = 0;
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/bootstrap")) return new Response(JSON.stringify(bootstrap));
        if (url.endsWith("/visits") && init?.method === "POST") return new Response(JSON.stringify({ success: true, visit: { id: 10, covers: 2, tableId: 7 }, ticket: { id: 11, version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } }), { status: 201 });
        if (url.includes("/tickets/11/lines") && init?.method === "POST") {
          callCount++;
          if (callCount === 1) {
            // First add: price override at €2.00
            return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 2, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 200, lineTotalGrossCents: 200, status: "ACTIVE" }], totalGrossCents: 200 } }), { status: 201 });
          }
          // Second add: new line at catalog price
          return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 3, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 200, lineTotalGrossCents: 200, status: "ACTIVE" }, { id: 13, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 450 } }), { status: 201 });
        }
        return new Response(JSON.stringify({ success: true, items: [] }));
      }));

      render(<Provider><POSSellScreen /></Provider>);
      fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
      fireEvent.click(await screen.findByText("Mesa 1"));
      fireEvent.click(screen.getByTestId("pos-open-visit"));
      await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));

      // First: add Agua at €2.00 (price override)
      fireEvent.click(screen.getByTestId("pos-key-2"));
      fireEvent.click(screen.getByTestId("pos-product-3"));
      await screen.findByTestId("pos-line-12");

      // Second: add Agua without price override (should create new line, not merge)
      fireEvent.click(screen.getByTestId("pos-product-3"));

      await waitFor(() => {
        // Should have two separate POST calls, no PATCH
        const postCalls = fetchCalls().filter((entry: unknown[]) => String(entry[0]).includes("/tickets/11/lines") && (entry[1] as RequestInit | undefined)?.method === "POST");
        expect(postCalls).toHaveLength(2);
      });
    });

    it("merges into existing line when adding product with same custom price", async () => {
      // Mock: first add returns line with custom price, second add with same price should PATCH
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/bootstrap")) return new Response(JSON.stringify(bootstrap));
        if (url.endsWith("/visits") && init?.method === "POST") return new Response(JSON.stringify({ success: true, visit: { id: 10, covers: 2, tableId: 7 }, ticket: { id: 11, version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } }), { status: 201 });
        if (url.includes("/tickets/11/lines") && init?.method === "POST") {
          // First add: price override at €2.00
          return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 2, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 1, unitPriceGrossCents: 200, lineTotalGrossCents: 200, status: "ACTIVE" }], totalGrossCents: 200 } }), { status: 201 });
        }
        if (url.includes("/tickets/11/lines/12") && init?.method === "PATCH") {
          // Second add: merge into existing €2.00 line
          return new Response(JSON.stringify({ success: true, ticket: { id: 11, version: 3, status: "OPEN", lines: [{ id: 12, productId: 3, productName: "Agua", quantity: 2, unitPriceGrossCents: 200, lineTotalGrossCents: 400, status: "ACTIVE" }], totalGrossCents: 400 } }));
        }
        return new Response(JSON.stringify({ success: true, items: [] }));
      }));

      render(<Provider><POSSellScreen /></Provider>);
      fireEvent.click(await screen.findByTestId("pos-rail-mesa"));
      fireEvent.click(await screen.findByText("Mesa 1"));
      fireEvent.click(screen.getByTestId("pos-open-visit"));
      await waitFor(() => expect(screen.getByTestId("pos-ticket-panel")).toHaveTextContent("Cuenta"));

      // First: add Agua at €2.00 (price override)
      fireEvent.click(screen.getByTestId("pos-key-2"));
      fireEvent.click(screen.getByTestId("pos-product-3"));
      await screen.findByTestId("pos-line-12");

      // Second: add Agua at €2.00 again (should merge via PATCH)
      fireEvent.click(screen.getByTestId("pos-key-2"));
      fireEvent.click(screen.getByTestId("pos-product-3"));

      await waitFor(() => {
        const patchCalls = fetchCalls().filter((entry: unknown[]) => String(entry[0]).includes("/tickets/11/lines/12") && (entry[1] as RequestInit | undefined)?.method === "PATCH");
        expect(patchCalls).toHaveLength(1);
        expect(JSON.parse(String((patchCalls[0][1] as RequestInit)?.body))).toMatchObject({ quantity: 2 });
      });
    });
  });

  // Without the date the screen would silently show today's tables while the
  // header claims to be on the day the user picked.
  it("scopes the register to the requested business date", async () => {
    render(<Provider><POSSellScreen date="2026-03-07" /></Provider>);
    await waitFor(() => expect(screen.getByTestId("pos-sell-screen")).toBeInTheDocument());
    const bootstrapCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((call) => String(call[0]).includes("/bootstrap"));
    expect(String(bootstrapCall?.[0])).toContain("date=2026-03-07");
  });

  it("flags a sealed day on the screen root", async () => {
    render(<Provider><POSSellScreen date="2026-03-07" readOnly /></Provider>);
    await waitFor(() => expect(screen.getByTestId("pos-sell-screen")).toHaveAttribute("data-readonly", "true"));
    expect(screen.getByTestId("pos-readonly-notice")).toBeInTheDocument();
  });

  // The backend rejects any mutation on a closed day, so an enabled control
  // could only ever produce an error the operator did not ask for.
  it("locks every rail action on a sealed day", async () => {
    render(<Provider><POSSellScreen date="2026-03-07" readOnly /></Provider>);
    await waitFor(() => expect(screen.getByTestId("pos-sell-screen")).toBeInTheDocument());
    const rail = screen.getByTestId("pos-control-rail");
    const buttons = within(rail).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button).toBeDisabled();
  });
});
